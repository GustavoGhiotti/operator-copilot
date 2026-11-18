"""Taxonomia dos temas de pergunta do operador.

A lista vivia duplicada dentro de `_classificar_pergunta`: uma vez no texto do
prompt e outra no set de validacao da resposta. Duas copias do mesmo dado que
podiam divergir em silencio, e o glossario do e-mail diario precisava de uma
terceira. Aqui ela existe uma vez so, com a definicao de cada tema junto.
"""

TEMAS_PERGUNTAS: dict[str, str] = {
    "Abertura": "Como iniciar o contato e se apresentar ao cliente.",
    "Negociação": "Condições de acordo, descontos, parcelamento e valores.",
    "Regras da carteira": "Políticas e limites específicos do cliente/carteira.",
    "Procedimentos": "Passo a passo operacional e fluxos internos.",
    "Argumentação": "Como responder objeções e conduzir o cliente ao acordo.",
    "Fechamento": "Confirmação do acordo e encerramento do atendimento.",
    "Sistemas": "Uso de discador, CRM e demais ferramentas.",
    "Cliente": "Dados cadastrais, histórico e situação do cliente.",
    "Desempenho": "Metas, produtividade e resultados do operador.",
    "Outros": "Perguntas que não se encaixam nos demais temas.",
}

TEMA_PADRAO = "Outros"


def temas_permitidos() -> set[str]:
    return set(TEMAS_PERGUNTAS)


def lista_temas_para_prompt() -> str:
    return "\n".join(f"        - {tema}" for tema in TEMAS_PERGUNTAS)
