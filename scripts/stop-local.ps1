$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/local-services.ps1"
$projectRoot = Split-Path $PSScriptRoot -Parent
$pidFile = Join-Path $projectRoot '.tools/local-processes.json'
if (Test-Path -LiteralPath $pidFile) {
    $processIds = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    $services = @(
        @{ record = $processIds.backend; executable = (Join-Path $projectRoot '.tools/python/python.exe'); marker = 'app.main:app' },
        @{ record = $processIds.frontend; executable = (Join-Path $projectRoot '.tools/node-v22.16.0-win-x64/node.exe'); marker = 'node_modules/vite/bin/vite.js' }
    )
    foreach ($service in $services) {
        $serviceProcess = Get-LocalServiceProcess $service.record $service.executable $service.marker
        if ($serviceProcess) {
            Stop-Process -Id $serviceProcess.Id
            if (!$serviceProcess.WaitForExit(5000)) { throw 'Service did not stop in time' }
        }
    }
    Remove-Item -LiteralPath $pidFile
}
if (Test-Path -LiteralPath "$projectRoot/.pgdata/PG_VERSION") {
    & "$projectRoot/.tools/pgsql/bin/pg_ctl.exe" -D "$projectRoot/.pgdata" status 2>$null
    if ($LASTEXITCODE -eq 0) {
        & "$projectRoot/.tools/pgsql/bin/pg_ctl.exe" -D "$projectRoot/.pgdata" -m fast -w stop
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL shutdown failed' }
    }
}
