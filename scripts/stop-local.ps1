$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pidFile = Join-Path $projectRoot '.tools/local-processes.json'
if (Test-Path -LiteralPath $pidFile) {
    $processIds = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
    foreach ($processId in @($processIds.backend, $processIds.frontend)) {
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($process -and $process.Path -and $process.Path.StartsWith("$projectRoot\.tools\", [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Process -Id $processId
        }
    }
    Remove-Item -LiteralPath $pidFile
}
& "$projectRoot/.tools/pgsql/bin/pg_ctl.exe" -D "$projectRoot/.pgdata" -m fast -w stop
