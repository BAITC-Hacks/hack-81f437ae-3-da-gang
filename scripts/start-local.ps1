$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonExe = Join-Path $projectRoot '.tools/python/python.exe'
$nodeDir = Join-Path $projectRoot '.tools/node-v22.16.0-win-x64'
$pgBin = Join-Path $projectRoot '.tools/pgsql/bin'
$dataDir = Join-Path $projectRoot '.pgdata'
$logDir = Join-Path $projectRoot '.tools'
foreach ($required in @($pythonExe, "$nodeDir/node.exe", "$pgBin/pg_ctl.exe")) {
    if (!(Test-Path -LiteralPath $required)) { throw "Missing portable runtime: $required. See README for standard setup." }
}
$env:PATH = "$nodeDir;$pgBin;" + $env:PATH
$env:DATABASE_URL = 'postgresql+asyncpg://sana@127.0.0.1:55432/sana'
if (!(Test-Path -LiteralPath "$dataDir/PG_VERSION")) {
    & "$pgBin/initdb.exe" -D $dataDir -U sana --auth=trust --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
}
& "$pgBin/pg_ctl.exe" -D $dataDir status 2>$null
if ($LASTEXITCODE -ne 0) {
    & "$pgBin/pg_ctl.exe" -D $dataDir -l "$logDir/postgres.log" -o '-p 55432 -h 127.0.0.1' -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed' }
}
$exists = & "$pgBin/psql.exe" -h 127.0.0.1 -p 55432 -U sana -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='sana'"
if ($exists -ne '1') {
    & "$pgBin/createdb.exe" -h 127.0.0.1 -p 55432 -U sana sana
    if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }
}
Push-Location "$projectRoot/backend"
try {
    & $pythonExe -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
    & $pythonExe -m app.seed
    if ($LASTEXITCODE -ne 0) { throw 'Seed failed' }
} finally { Pop-Location }
$pidFile = Join-Path $logDir 'local-processes.json'
if (Test-Path $pidFile) { Write-Host 'Services already started; use stop-local.ps1 before restarting.'; exit 0 }
$backendProcess = Start-Process -FilePath $pythonExe -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' -WorkingDirectory "$projectRoot/backend" -WindowStyle Hidden -RedirectStandardOutput "$logDir/backend.log" -RedirectStandardError "$logDir/backend-error.log" -PassThru
$frontendProcess = Start-Process -FilePath "$nodeDir/node.exe" -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory "$projectRoot/frontend" -WindowStyle Hidden -RedirectStandardOutput "$logDir/frontend.log" -RedirectStandardError "$logDir/frontend-error.log" -PassThru
@{ backend = $backendProcess.Id; frontend = $frontendProcess.Id } | ConvertTo-Json | Set-Content $pidFile
Write-Host 'Frontend: http://localhost:5173 | API: http://127.0.0.1:8000/docs'
Write-Host 'Local PostgreSQL: 127.0.0.1:55432 (isolated demo cluster, trust auth on loopback only)'
