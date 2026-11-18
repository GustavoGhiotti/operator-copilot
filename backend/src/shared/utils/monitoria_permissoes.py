FUNCOES_OPERADOR_MONITORIA = {
    "operador(a) cobrador(a)",
    "negociador",
}

FUNCOES_SUPERVISOR_MONITORIA = {
    "supervisor(a) de operacoes i",
    "supervisor(a) de operacoes",
}


def normalizar_texto(valor) -> str:
    return " ".join(str(valor or "").lower().strip().split())


def possui_cargo(funcao: str, cargos) -> bool:
    funcao_normalizada = normalizar_texto(funcao)
    return any(normalizar_texto(cargo) in funcao_normalizada for cargo in cargos)


def cargo_base_e(funcao: str, cargo: str) -> bool:
    """Compara o cargo ignorando o que vem depois dele.

    FUNCAO_COLABORADOR guarda o nivel junto do cargo em varios registros
    ("SUPERVISOR(A) DE OPERACOES I"). Comparar com `==` reprova essas pessoas
    em silencio, entao a comparacao e por prefixo do valor normalizado.
    """
    return normalizar_texto(funcao).startswith(normalizar_texto(cargo))


def funcao_eh_operador_monitoria(funcao: str | None) -> bool:
    return possui_cargo(funcao or "", FUNCOES_OPERADOR_MONITORIA)


def funcao_eh_supervisor_monitoria(funcao: str | None) -> bool:
    return possui_cargo(funcao or "", FUNCOES_SUPERVISOR_MONITORIA)


def resolver_perfil_monitoria(funcao: str | None) -> str | None:
    if funcao_eh_operador_monitoria(funcao):
        return "OPERADOR"

    if funcao_eh_supervisor_monitoria(funcao):
        return "SUPERVISOR"

    return None
