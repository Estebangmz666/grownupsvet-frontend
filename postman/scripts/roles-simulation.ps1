[CmdletBinding()]
param(
    [ValidateSet('Start', 'Stop', 'Status')]
    [string]$Action = 'Start',
    [ValidateSet('normal', 'unavailable')]
    [string]$Mode = 'normal'
)

$ErrorActionPreference = 'Stop'
$simulationPort = 4900
$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runtimeDirectory = Join-Path $repositoryRoot 'postman\.runtime'
$processRecordPath = Join-Path $runtimeDirectory 'roles-process.json'
$outputPath = Join-Path $runtimeDirectory 'roles.ndjson'
$errorPath = Join-Path $runtimeDirectory 'roles.err'

function Get-SimulationListener {
    Get-NetTCPConnection -LocalPort $simulationPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Get-OwnedSimulationProcess {
    if (-not (Test-Path -LiteralPath $processRecordPath)) { return $null }
    $processRecord = Get-Content -LiteralPath $processRecordPath -Raw | ConvertFrom-Json
    $simulationProcess = Get-Process -Id $processRecord.processId -ErrorAction SilentlyContinue
    if ($null -eq $simulationProcess) { return $null }
    $recordedStartTime = ([datetime]$processRecord.startTimeUtc).ToUniversalTime()
    if ($simulationProcess.StartTime.ToUniversalTime().Ticks -ne $recordedStartTime.Ticks) { return $null }
    $listener = Get-SimulationListener
    if ($null -eq $listener -or $listener.OwningProcess -ne $simulationProcess.Id) { return $null }
    return $simulationProcess
}

if ($Action -eq 'Status') {
    $ownedProcess = Get-OwnedSimulationProcess
    if ($null -eq $ownedProcess) { Write-Output 'La simulación administrada no está escuchando.' }
    else { Write-Output "Simulación activa en http://127.0.0.1:$simulationPort/api/v1 (PID $($ownedProcess.Id))." }
    return
}

if ($Action -eq 'Stop') {
    $ownedProcess = Get-OwnedSimulationProcess
    if ($null -eq $ownedProcess) {
        Write-Output 'No hay un proceso de simulación administrado que se pueda detener.'
        return
    }
    & taskkill.exe /PID $ownedProcess.Id /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo detener el árbol del proceso de simulación.' }
    Remove-Item -LiteralPath $processRecordPath
    Write-Output "Simulación detenida en el puerto $simulationPort. Los registros permanecen en postman/.runtime/."
    return
}

if ($null -ne (Get-SimulationListener)) {
    if ($null -ne (Get-OwnedSimulationProcess)) {
        throw 'La simulación ya está activa. Deténla antes de reiniciarla o cambiar de escenario.'
    }
    throw "El puerto $simulationPort está ocupado por otro proceso; no se detuvo ni se cambió el puerto."
}

$postmanCommand = Get-Command postman -ErrorAction Stop
$versionText = (& $postmanCommand.Source --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or [version]$versionText -lt [version]'1.70.0') {
    throw 'Se necesita Postman CLI 1.70.0 o posterior.'
}
$simulationName = if ($Mode -eq 'unavailable') { 'roles-unavailable.sim.yaml' } else { 'roles.sim.yaml' }
$simulationPath = Join-Path $repositoryRoot "postman\simulations\$simulationName"
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
$simulationArguments = @('simulation', 'run', ('"{0}"' -f $simulationPath), '--port', "$simulationPort", '--output', 'ndjson', '--no-history')
$launcher = Start-Process -FilePath $postmanCommand.Source -ArgumentList $simulationArguments `
    -WorkingDirectory $repositoryRoot -WindowStyle Hidden -RedirectStandardOutput $outputPath `
    -RedirectStandardError $errorPath -PassThru

$deadline = [DateTime]::UtcNow.AddSeconds(30)
do {
    Start-Sleep -Milliseconds 250
    $listener = Get-SimulationListener
    $hasListeningEvent = (Test-Path -LiteralPath $outputPath) -and
        (Select-String -LiteralPath $outputPath -Pattern '"listening"' -Quiet)
    if ($null -ne $listener -and $hasListeningEvent) {
        $simulationProcess = Get-Process -Id $listener.OwningProcess
        @{
            processId = $simulationProcess.Id
            startTimeUtc = $simulationProcess.StartTime.ToUniversalTime().ToString('O')
            launcherProcessId = $launcher.Id
            port = $simulationPort
            mode = $Mode
            simulationPath = $simulationPath
        } | ConvertTo-Json | Set-Content -LiteralPath $processRecordPath -Encoding utf8
        Write-Output "Simulación $Mode activa: http://127.0.0.1:$simulationPort/api/v1"
        Write-Output 'Registros locales ignorados por Git: postman/.runtime/roles.ndjson y roles.err.'
        return
    }
} while ([DateTime]::UtcNow -lt $deadline)

throw 'La simulación no confirmó listening en 30 segundos. Revisa postman/.runtime/roles.err; no se acredita un arranque correcto.'
