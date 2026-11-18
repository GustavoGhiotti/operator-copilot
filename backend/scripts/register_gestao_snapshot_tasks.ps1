<#
    Agenda as duas cargas do snapshot de gestao.

    INTRADIA     a cada 15 min, 07:00-21:00. E a unica fonte de CPC do dia --
                 e o que a tela de Resultados Operacionais le.
    INCREMENTAL  1x/dia de madrugada, recomputando os ultimos N dias, porque
                 acordo e pagamento sao alterados retroativamente
                 (DT_CANCELAMENTO, DT_ATUALIZACAO).

    IMPORTANTE: rode antes a migration 020 (indice em TB_TABULACOES_HOJE_66).
    Sem ela cada execucao varre 18 GB e leva mais de 10 minutos, o que nao cabe
    numa janela de 15.
#>
param(
    [string]$TaskIntradia = "Copilot - Snapshot Gestao (intradia)",
    [string]$TaskIncremental = "Copilot - Snapshot Gestao (incremental)",
    [string]$PythonExecutable = "python",
    [string]$IncrementalAt = "03:30",
    [int]$DiasIncremental = 7,
    [int]$IntervaloMinutos = 15,
    [int]$HoraInicio = 7,
    [int]$HorasDeDuracao = 14
)

$ErrorActionPreference = "Stop"
$backendPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$workerPath = Join-Path $backendPath "src\workers\gestao_snapshot_worker.py"

if (-not (Test-Path -LiteralPath $workerPath)) {
    throw "Worker nao encontrado: $workerPath"
}

$pythonCommand = Get-Command $PythonExecutable -ErrorAction Stop

# --- intradia -------------------------------------------------------------
$acaoIntradia = New-ScheduledTaskAction `
    -Execute $pythonCommand.Source `
    -Argument "`"$workerPath`" --modo INTRADIA" `
    -WorkingDirectory $backendPath

$gatilhoIntradia = New-ScheduledTaskTrigger `
    -Daily `
    -At ([datetime]::Today.AddHours($HoraInicio))
$gatilhoIntradia.Repetition = (New-ScheduledTaskTrigger `
    -Once `
    -At ([datetime]::Today.AddHours($HoraInicio)) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervaloMinutos) `
    -RepetitionDuration (New-TimeSpan -Hours $HorasDeDuracao)).Repetition

# O limite de execucao e menor que o intervalo de proposito: se uma carga
# passar de 15 minutos, ela e cortada em vez de se acumular com a proxima. A
# trava no banco (indice unico em STATUS='EXECUTANDO') ja recusaria a segunda,
# mas cortar deixa o problema visivel no historico da tarefa.
$configIntradia = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes $IntervaloMinutos)

Register-ScheduledTask `
    -TaskName $TaskIntradia `
    -Action $acaoIntradia `
    -Trigger $gatilhoIntradia `
    -Settings $configIntradia `
    -Description "Atualiza TB_GESTAO_OPERADOR_DIA com o dia corrente." `
    -Force | Out-Null

# --- incremental ----------------------------------------------------------
$acaoIncremental = New-ScheduledTaskAction `
    -Execute $pythonCommand.Source `
    -Argument "`"$workerPath`" --modo INCREMENTAL --dias $DiasIncremental" `
    -WorkingDirectory $backendPath

$gatilhoIncremental = New-ScheduledTaskTrigger -Daily -At $IncrementalAt

$configIncremental = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName $TaskIncremental `
    -Action $acaoIncremental `
    -Trigger $gatilhoIncremental `
    -Settings $configIncremental `
    -Description "Recomputa os ultimos $DiasIncremental dias do snapshot de gestao." `
    -Force | Out-Null

Write-Output "Tarefas registradas:"
Write-Output "  '$TaskIntradia'    a cada $IntervaloMinutos min, a partir das ${HoraInicio}:00, por $HorasDeDuracao h."
Write-Output "  '$TaskIncremental' diariamente as $IncrementalAt, recomputando $DiasIncremental dias."
