# Shared identity checks keep a stale/reused PID from targeting an unrelated process.
function Get-LocalServiceProcess {
    param($Record, [string]$Executable, [string]$CommandMarker)
    if (!$Record) { return $null }
    $serviceId = if ($Record -is [int] -or $Record -is [long]) { [int]$Record } else { [int]$Record.id }
    if ($serviceId -le 0) { return $null }
    $serviceProcess = Get-Process -Id $serviceId -ErrorAction SilentlyContinue
    if (!$serviceProcess -or !$serviceProcess.Path -or ![string]::Equals($serviceProcess.Path, [IO.Path]::GetFullPath($Executable), [StringComparison]::OrdinalIgnoreCase)) { return $null }
    if ($Record.started_at -and $Record.started_at -ne $serviceProcess.StartTime.ToUniversalTime().ToString('o')) { return $null }
    $details = Get-CimInstance Win32_Process -Filter "ProcessId = $serviceId" -ErrorAction Stop
    if (!$details.CommandLine -or !$details.CommandLine.Contains($CommandMarker)) { return $null }
    return $serviceProcess
}

function Get-LocalServiceRecord {
    param($Process)
    if (!$Process) { return $null }
    return @{ id = $Process.Id; started_at = $Process.StartTime.ToUniversalTime().ToString('o') }
}

function Test-LocalServicePort {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try { return ($client.ConnectAsync('127.0.0.1', $Port).Wait(500) -and $client.Connected) }
    catch { return $false }
    finally { $client.Dispose() }
}

function Wait-LocalService {
    param([string]$Url, $Process)
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) { throw "Service exited before becoming ready: $Url. Check .tools logs." }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    throw "Service did not become ready: $Url. Check database/migrations and .tools logs."
}
