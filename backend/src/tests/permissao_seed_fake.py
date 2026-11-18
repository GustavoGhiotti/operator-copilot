"""Espelho em memoria do seed da migration 019.

Nao e um test file (o pytest so coleta `*_test.py`): e a base que os testes de
Arena e de permissao usam para nao repetir a mesma lista de concessoes em cinco
arquivos. Espelhar o seed em vez de inventar concessoes de mentira e o que faz
esses testes falharem quando alguem mudar a migration e esquecer a regra.

Se voce alterar `019_permissao_visao.sql`, altere aqui junto.
"""

CONCESSOES_SEED = [
    ("CENTRO_CUSTO", "GERENCIA OPERACIONAL", "gerencia.gestao"),
    ("CENTRO_CUSTO", "GERENCIA OPERACIONAL", "supervisao.operacao"),
    ("CENTRO_CUSTO", "GERENCIA OPERACIONAL", "aurora.insight"),
    ("CENTRO_CUSTO", "QUALIDADE", "aurora.insight"),
    ("CENTRO_CUSTO", "PLANEJAMENTO", "aurora.insight"),
    ("CENTRO_CUSTO", "GERENCIA OPERACIONAL", "gerencia.resultados"),
    ("FUNCAO", "GERENTE DE OPERACOES", "gerencia.resultados"),
    ("CENTRO_CUSTO", "DESENVOLVIMENTO", "arena.observatorio"),
    ("CENTRO_CUSTO", "GERENCIA OPERACIONAL", "arena.observatorio"),
    ("FUNCAO", "SUPERVISOR", "arena.supervisor"),
    ("CENTRO_CUSTO", "DESENVOLVIMENTO", "acessos.gerenciar"),
    ("CENTRO_CUSTO", "MARKETING", "senhas.reset"),
    ("CENTRO_CUSTO", "GERENCIA OPERACIONAL", "senhas.reset"),
    ("CENTRO_CUSTO", "PLANEJAMENTO", "senhas.reset"),
    ("CENTRO_CUSTO", "DESENVOLVIMENTO", "senhas.reset"),
    ("CENTRO_CUSTO", "TI", "senhas.reset"),
    ("CENTRO_CUSTO", "QUALIDADE", "senhas.reset"),
    ("FUNCAO", "SUPERVISOR(A) DE OPERACOES", "senhas.reset"),
    ("FUNCAO", "ASSISTENTE DE COORDENACAO", "senhas.reset"),
    ("FUNCAO", "SUPERVISOR(A) DE QUALIDADE", "senhas.reset"),
    ("FUNCAO", "COORDENADOR(A) QUALIDADE", "senhas.reset"),
    ("FUNCAO", "MONITOR DE TELEATENDIMENTO", "senhas.reset"),
    ("FUNCAO", "COORDENADOR(A) DE OPERACOES JR", "senhas.reset"),
    ("FUNCAO", "ASSISTENTE DE SUPERVISAO", "senhas.reset"),
    ("FUNCAO", "AUXILIAR ADMINISTRATIVO", "senhas.reset"),
    ("FUNCAO", "ASSISTENTE ADMINISTRATIVO", "senhas.reset"),
    ("FUNCAO", "INSTRUTOR DE TREINAMENTO JR", "senhas.reset"),
    ("FUNCAO", "ASSISTENTE DE DESENVOLVIMENTO", "senhas.reset"),
]

# O que a migration 019 vem entregar: as quatro funcoes de gerencia, com o
# pacote completo, independente do centro de custo em que estejam lotadas.
CONCESSOES_SEED += [
    ("FUNCAO", funcao, area)
    for funcao in (
        "GERENTE DE OPERACOES",
        "GERENTE DE TI",
        "ESPECIALISTA DE RECUPERACAO",
    )
    for area in (
        "gerencia.gestao",
        "gerencia.resultados",
        "arena.observatorio",
        "senhas.reset",
        "supervisao.operacao",
        "aurora.insight",
    )
]


# Espelho do seed da migration 025. `operador` nao aparece de proposito: a
# visao existe justamente para nao conceder nada.
PERFIS_SEED = {
    "operador": [],
    "supervisor": ["senhas.reset", "arena.supervisor", "supervisao.operacao"],
    "qualidade": ["senhas.reset", "qualidade.monitoria", "aurora.insight"],
    "gerencia": [
        "senhas.reset", "gerencia.gestao", "gerencia.resultados", "aurora.insight",
    ],
    "desenvolvimento": [
        "acessos.gerenciar", "arena.observatorio", "arena.supervisor",
        "gerencia.gestao", "gerencia.resultados", "qualidade.avaliacao",
        "qualidade.monitoria", "aurora.insight", "senhas.reset",
        "supervisao.operacao",
    ],
}

_NOMES_DOS_PERFIS = {
    "operador": "Operador",
    "supervisor": "Supervisor",
    "qualidade": "Qualidade",
    "gerencia": "Gerência",
    "desenvolvimento": "Desenvolvimento",
}


class PermissaoRepositoryFake:
    """Repositorio de permissao em memoria.

    `estrutura_ausente=True` simula o ambiente onde a migration ainda nao
    rodou, para exercitar a regra de fallback do servico.
    """

    def __init__(
        self,
        concessoes=None,
        estrutura_ausente=False,
        perfis_ausentes=False,
        atribuicoes=None,
        ajustes=None,
        pessoas=None,
    ):
        self.concessoes = (
            CONCESSOES_SEED if concessoes is None else list(concessoes)
        )
        self.estrutura_ausente = estrutura_ausente
        self.perfis_ausentes = perfis_ausentes
        # {cpf: codigo_perfil}
        self.atribuicoes = dict(atribuicoes or {})
        # {cpf: {area: bool}}
        self.ajustes = {k: dict(v) for k, v in (ajustes or {}).items()}
        self.pessoas = list(pessoas or [])
        self.leituras = 0

    def estrutura_disponivel(self):
        return not self.estrutura_ausente

    def perfis_disponiveis(self):
        return not self.perfis_ausentes

    def listar_concessoes_ativas(self):
        self.leituras += 1
        return [
            {"TIPO": tipo, "VALOR": valor, "AREA": area}
            for tipo, valor, area in self.concessoes
        ]

    def listar_perfis(self):
        linhas = []
        for ordem, (codigo, areas) in enumerate(PERFIS_SEED.items(), start=1):
            if not areas:
                linhas.append({
                    "CODIGO": codigo, "NOME": _NOMES_DOS_PERFIS[codigo],
                    "DESCRICAO": "", "ORDEM_EXIBICAO": ordem * 10,
                    "ATIVO": True, "AREA": None,
                })
                continue
            for area in areas:
                linhas.append({
                    "CODIGO": codigo, "NOME": _NOMES_DOS_PERFIS[codigo],
                    "DESCRICAO": "", "ORDEM_EXIBICAO": ordem * 10,
                    "ATIVO": True, "AREA": area,
                })
        return linhas

    def listar_atribuicoes_ativas(self):
        linhas = [
            {"CPF_COLABORADOR": cpf, "CODIGO_PERFIL": perfil,
             "AREA": None, "CONCEDIDA": None}
            for cpf, perfil in self.atribuicoes.items()
        ]
        for cpf, areas in self.ajustes.items():
            for area, concedida in areas.items():
                linhas.append({
                    "CPF_COLABORADOR": cpf, "CODIGO_PERFIL": None,
                    "AREA": area, "CONCEDIDA": concedida,
                })
        return linhas

    def listar_areas(self):
        vistas = {area for _, _, area in self.concessoes}
        for areas in PERFIS_SEED.values():
            vistas.update(areas)
        return [{"AREA": area, "DESCRICAO": "", "ATIVO": True}
                for area in sorted(vistas)]

    def obter_pessoa(self, cpf):
        for pessoa in self.pessoas:
            if str(pessoa.get("CPF")) == str(cpf):
                return {**pessoa, "CODIGO_PERFIL": self.atribuicoes.get(str(cpf))}
        return None

    def listar_pessoas(self, **kwargs):
        return [
            {**pessoa,
             "CODIGO_PERFIL": self.atribuicoes.get(str(pessoa.get("CPF"))),
             "QT_TOTAL": len(self.pessoas)}
            for pessoa in self.pessoas
        ]

    def listar_ajustes(self, cpf):
        return [
            {"AREA": area, "CONCEDIDA": concedida}
            for area, concedida in self.ajustes.get(str(cpf), {}).items()
        ]

    def definir_perfil(self, *, cpf, codigo_perfil, definido_por):
        self.atribuicoes[str(cpf)] = codigo_perfil

    def remover_perfil(self, cpf):
        self.atribuicoes.pop(str(cpf), None)
        self.ajustes.pop(str(cpf), None)
        return 1

    def definir_ajuste(self, *, cpf, area, concedida, definido_por):
        self.ajustes.setdefault(str(cpf), {})[area] = bool(concedida)

    def limpar_ajuste(self, *, cpf, area):
        return self.ajustes.get(str(cpf), {}).pop(area, None)


def permissoes_do_seed(**kwargs):
    """Servico de permissao apoiado no seed, para injetar em outros services."""
    from src.application.services.permissao_service import PermissaoService

    return PermissaoService(repo=PermissaoRepositoryFake(**kwargs))
