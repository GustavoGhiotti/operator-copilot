param(
    [string]$TaskName = "Copilot - Aurora Insight Diario",
    [string]$PythonExecutable = "python",
    [string]$RunAt = "08:00"
)

$ErrorActionPreference = "Stop"
$backendPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$workerPath = Join-Path $backendPath "src\workers\aurora_insight_daily_report.py"

if (-not (Test-Path -LiteralPath $workerPath)) {
    throw "Worker não encontrado: $workerPath"
}

$pythonCommand = Get-Command $PythonExecutable -ErrorAction Stop
$action = New-ScheduledTaskAction `
    -Execute $pythonCommand.Source `
    -Argument "`"$workerPath`"" `
    -WorkingDirectory $backendPath
$trigger = New-ScheduledTaskTrigger -Daily -At $RunAt
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Envia o fechamento diário do Aurora Insight referente ao dia anterior." `
    -Force

Write-Output "Tarefa '$TaskName' registrada para executar diariamente às $RunAt."
