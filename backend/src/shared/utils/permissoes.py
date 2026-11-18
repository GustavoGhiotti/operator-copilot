"""Normalizacao dos valores usados na permissao por area.

Espelha `normalizeCostCenter` do frontend: maiusculo, sem acento, espacos
colapsados. Precisa ser a mesma regra dos dois lados, porque o que a tela de
acessos grava aqui e o que o servidor compara depois -- se uma ponta tirar
acento e a outra nao, a concessao existe no banco e nunca concede nada.

Nao reaproveita `normalizar_texto` de monitoria_permissoes porque aquela mantem
acento e usa minusculo; misturar as duas convencoes na mesma comparacao e como
nao normalizar.
"""

import unicodedata


def normalizar_valor(valor) -> str:
    texto = str(valor or "")
    sem_acento = "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )
    return " ".join(sem_acento.upper().split())


def funcao_casa(funcao_do_usuario, valor_concedido) -> bool:
    """FUNCAO casa por prefixo.

    FUNCAO_COLABORADOR guarda o nivel junto do cargo ("SUPERVISOR(A) DE
    OPERACOES I") e trunca os nomes longos ("ESPECIALISTA DE RECUPERACAO DE").
    Igualdade reprovaria as duas coisas em silencio.
    """
    concedido = normalizar_valor(valor_concedido)
    if not concedido:
        return False
    return normalizar_valor(funcao_do_usuario).startswith(concedido)


def valor_exato_casa(valor_do_usuario, valor_concedido) -> bool:
    """CENTRO_CUSTO e CPF casam por igualdade.

    Prefixo aqui seria perigoso: o centro de custo 'TI' passaria a conceder
    para qualquer centro que comece com essas duas letras.
    """
    concedido = normalizar_valor(valor_concedido)
    if not concedido:
        return False
    return normalizar_valor(valor_do_usuario) == concedido
