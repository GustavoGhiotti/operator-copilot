<#
    Agenda a carga noturna do snapshot de gestao para UMA execucao.

    Nao e tarefa recorrente de proposito: ela cria o indice e recarrega os 16
    meses de historico, o que so precisa acontecer uma vez. A atualizacao do
    dia a dia e outro par de tarefas -- register_gestao_snapshot_tasks.ps1 --
    que deve ser registrado DEPOIS que esta rodar, porque o intradiario de 15
    minutos so cabe na janela com o indice criado.

    A saida vai para um arquivo, para voce ler de manha.
#>
param(
    [string]$TaskName = "Copilot - Carga noturna do snapshot de gestao",
    [string]$PythonExecutable = "python",
    [string]$RunAt = "22:00",
    [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"
$backendPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$scriptPath = Join-Path $backendPath "scripts\carga_noturna_gestao.py"

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "Script nao encontrado: $scriptPath"
}

if ([string]::IsNullOrWhiteSpace($LogPath)) {
    # Carimbo no nome: a execucao de 12/08 falhou por disco cheio, e o log
    # dela era a unica evidencia do que aconteceu. Nome fixo com ">" apagaria
    # a prova na tentativa seguinte.
    $carimbo = Get-Date -Format "yyyy-MM-dd_HHmm"
    $LogPath = Join-Path $backendPath "carga_noturna_gestao_$carimbo.log"
}

$pythonCommand = Get-Command $PythonExecutable -ErrorAction Stop

# cmd /c com redirecionamento: o Task Scheduler nao captura stdout sozinho, e
# sem o log nao ha como saber de manha o que aconteceu.
$argumento = '/c ""{0}" "{1}" > "{2}" 2>&1"' -f `
    $pythonCommand.Source, $scriptPath, $LogPath

$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument $argumento `
    -WorkingDirectory $backendPath

$trigger = New-ScheduledTaskTrigger -Once -At $RunAt

# 4 horas de teto: a estimativa e de 1h a 2h, e o limite existe so para a
# tarefa nao ficar pendurada se algo travar.
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Cria o indice de TB_TABULACOES_HOJE_66, recarrega o historico do snapshot de gestao e reconcilia." `
    -Force | Out-Null

Write-Output "Tarefa '$TaskName' registrada para hoje as $RunAt."
Write-Output "Saida em: $LogPath"
Write-Output ""
Write-Output "Para acompanhar durante a execucao:"
Write-Output "  Get-Content '$LogPath' -Wait -Tail 20"
Write-Output ""
Write-Output "Depois que ela terminar, registre a atualizacao recorrente:"
Write-Output "  .\scripts\register_gestao_snapshot_tasks.ps1"
