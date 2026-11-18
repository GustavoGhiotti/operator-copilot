import time

from src.infrastructure.repositories.sql_login_repository import LoginRepository
from src.infrastructure.repositories.sql_permissao_repository import (
    PermissaoRepository,
)
from src.shared.utils.permissoes import (
    funcao_casa,
    normalizar_valor,
    valor_exato_casa,
)


class PermissaoError(Exception):
    def __init__(self, mensagem, status=403):
        super().__init__(mensagem)
        self.status = status


# Regra que valia antes da migracao 019, mantida como rede para o intervalo
# entre o deploy do codigo e a aplicacao da migracao -- que neste projeto sao
# dois passos manuais e separados. Sem isto, subir o backend antes de rodar o
# SQL tiraria o acesso de todo mundo de uma vez.
#
# Nao e uma segunda fonte de verdade: so responde quando a tabela nao existe.
_FUNCOES_ADMIN_LEGADO = (
    "SUPERVISOR(A) DE OPERACOES",
    "ASSISTENTE DE COORDENACAO",
    "SUPERVISOR(A) DE QUALIDADE",
    "COORDENADOR(A) QUALIDADE",
    "MONITOR DE TELEATENDIMENTO",
    "COORDENADOR(A) DE OPERACOES JR",
    "ASSISTENTE DE SUPERVISAO",
    "AUXILIAR ADMINISTRATIVO",
    "ASSISTENTE ADMINISTRATIVO",
    "INSTRUTOR DE TREINAMENTO JR",
    "ASSISTENTE DE DESENVOLVIMENTO",
)
_CENTROS_ADMIN_LEGADO = (
    "MARKETING",
    "GERENCIA OPERACIONAL",
    "PLANEJAMENTO",
    "DESENVOLVIMENTO",
    "TI",
    "QUALIDADE",
)

_CACHE_SEGUNDOS = 60


class _CacheConcessoes:
    """Cache curto em memoria das concessoes ativas e das visoes atribuidas.

    A tabela tem dezenas de linhas e muda raramente, mas e consultada em toda
    requisicao protegida; sem cache, cada chamada abriria uma conexao nova
    (nao ha pool). Um minuto e curto o bastante para uma revogacao surtir
    efeito sozinha, e a tela de acessos invalida na hora.
    """

    def __init__(self):
        self._itens = None
        self._expira_em = 0.0

    def obter(self, carregar):
        agora = time.monotonic()
        if self._itens is None or agora >= self._expira_em:
            self._itens = carregar()
            self._expira_em = agora + _CACHE_SEGUNDOS
        return self._itens

    def invalidar(self):
        self._itens = None
        self._expira_em = 0.0


_cache = _CacheConcessoes()
# Separado do anterior porque as duas leituras tem origens diferentes e
# invalidam juntas; manter dois evita recarregar as concessoes por causa de uma
# atribuicao individual, que e a escrita mais frequente da tela de acessos.
_cache_atribuicoes = _CacheConcessoes()


class PermissaoService:
    def __init__(self, repo=None):
        # Repositorio injetado nao usa o cache do modulo: o cache e global e
        # dois testes seguidos com concessoes diferentes leriam o mesmo dado.
        self._repo_injetado = repo is not None
        self.repo = repo or PermissaoRepository()

    def areas_para(self, *, funcao, centro_custo, cpf=None) -> set[str]:
        """Areas de um usuario ja carregado.

        Usado pelo login, que acabou de ler TB_USUARIOS e nao deve ler de novo.

        Resolve em tres camadas:

        1. Tem visao atribuida? Entao a visao E a resposta -- ela SUBSTITUI o
           padrao do cargo. E o que permite tambem reduzir alguem, marcando um
           supervisor como Operador.
        2. Senao, vale o padrao por funcao/centro de custo. E este caminho que
           mantem operador e supervisor funcionando sem nenhum cadastro: quem
           nao tem visao atribuida nao e afetado por nada disto.
        3. Ajustes individuais por cima, em qualquer um dos dois casos.
        """
        if not self.repo.estrutura_disponivel():
            return self._areas_legado(funcao=funcao, centro_custo=centro_custo)

        perfil, ajustes = self._atribuicao(cpf)

        if perfil is not None:
            areas = set(self._areas_do_perfil().get(perfil, set()))
        else:
            areas = self._areas_por_cargo(
                funcao=funcao, centro_custo=centro_custo, cpf=cpf
            )

        for area, concedida in ajustes.items():
            if concedida:
                areas.add(area)
            else:
                areas.discard(area)

        return areas

    def _areas_por_cargo(self, *, funcao, centro_custo, cpf) -> set[str]:
        """O padrao: concessoes de TB_PERMISSAO_VISAO que casam com a pessoa."""
        areas = set()
        for concessao in self._concessoes():
            tipo = str(concessao.get("TIPO") or "").upper()
            valor = concessao.get("VALOR")
            area = concessao.get("AREA")

            if not area:
                continue

            if tipo == "FUNCAO" and funcao_casa(funcao, valor):
                areas.add(area)
            elif tipo == "CENTRO_CUSTO" and valor_exato_casa(centro_custo, valor):
                areas.add(area)
            elif tipo == "CPF" and cpf is not None and valor_exato_casa(cpf, valor):
                areas.add(area)

        return areas

    def _atribuicao(self, cpf) -> tuple[str | None, dict]:
        """(codigo do perfil, ajustes) de um CPF. Ambos podem ser vazios."""
        if cpf is None or not self.repo.perfis_disponiveis():
            return None, {}

        chave = str(cpf).strip()
        if not chave:
            return None, {}

        perfil = None
        ajustes = {}
        for linha in self._atribuicoes():
            if str(linha.get("CPF_COLABORADOR") or "").strip() != chave:
                continue
            if linha.get("CODIGO_PERFIL"):
                perfil = linha["CODIGO_PERFIL"]
            elif linha.get("AREA"):
                ajustes[linha["AREA"]] = bool(linha.get("CONCEDIDA"))

        return perfil, ajustes

    def listar_perfis(self) -> list[dict]:
        """As visoes e o que cada uma contem, para a tela de acessos."""
        agrupado = {}
        for linha in self.repo.listar_perfis():
            codigo = linha.get("CODIGO")
            if codigo not in agrupado:
                agrupado[codigo] = {
                    "codigo": codigo,
                    "nome": linha.get("NOME"),
                    "descricao": linha.get("DESCRICAO"),
                    "ordem": int(linha.get("ORDEM_EXIBICAO") or 0),
                    "areas": [],
                }
            if linha.get("AREA"):
                agrupado[codigo]["areas"].append(linha["AREA"])

        return sorted(agrupado.values(), key=lambda item: (item["ordem"], item["codigo"]))

    def _areas_do_perfil(self) -> dict:
        mapa = {}
        for perfil in self.listar_perfis():
            mapa[perfil["codigo"]] = set(perfil["areas"])
        return mapa

    def areas_do_usuario(self, cpf) -> set[str]:
        usuario = self._usuario(cpf)
        return self.areas_para(
            funcao=usuario.get("FUNCAO_COLABORADOR"),
            centro_custo=usuario.get("CENTRO_CUSTO"),
            cpf=usuario.get("CPF_COLABORADOR"),
        )

    def areas_negadas(self, cpf) -> set[str]:
        """Areas negadas explicitamente na tela de acessos.

        A ausencia de uma area em `areas_do_usuario` nao distingue "nunca teve"
        de "foi tirada". O servidor nao precisa da diferenca -- ele so pergunta
        se a area esta presente --, mas a tela precisa: o frontend tem regras
        legadas por centro de custo e funcao no formato `regra OU area`, e sem
        saber da negacao ele reacende o comando que o gestor acabou de tirar.
        """
        _, ajustes = self._atribuicao(cpf)
        return {area for area, concedida in ajustes.items() if not concedida}

    def pode(self, cpf, area) -> bool:
        return area in self.areas_do_usuario(cpf)

    def exigir(self, cpf, area) -> None:
        if not self.pode(cpf, area):
            raise PermissaoError("Voce nao tem acesso a esta area.", 403)

    def invalidar_cache(self) -> None:
        _cache.invalidar()
        _cache_atribuicoes.invalidar()

    def _concessoes(self) -> list[dict]:
        if self._repo_injetado:
            return self.repo.listar_concessoes_ativas()
        return _cache.obter(self.repo.listar_concessoes_ativas)

    def _atribuicoes(self) -> list[dict]:
        if self._repo_injetado:
            return self.repo.listar_atribuicoes_ativas()
        return _cache_atribuicoes.obter(self.repo.listar_atribuicoes_ativas)

    # ---------------------------------------------------------------- #
    # Administracao: pessoas e suas visoes
    # ---------------------------------------------------------------- #

    def listar_pessoas(self, filtros) -> dict:
        pagina = max(1, self._inteiro(filtros.get("pagina"), 1))
        tamanho = min(100, max(1, self._inteiro(filtros.get("tamanho"), 25)))
        busca = (filtros.get("busca") or "").strip() or None
        perfil = (filtros.get("perfil") or "").strip() or None

        # A busca ignora o recorte "so quem tem visao": e ela que alcanca
        # qualquer um dos 3.102 quando se precisa conceder a alguem novo.
        somente_com_visao = busca is None and self._verdadeiro(
            filtros.get("somente_com_visao"), padrao=True
        )

        linhas = self.repo.listar_pessoas(
            busca=busca,
            codigo_perfil=perfil,
            somente_com_visao=somente_com_visao,
            offset=(pagina - 1) * tamanho,
            limite=tamanho,
        )

        return {
            "pagina": pagina,
            "tamanho": tamanho,
            "total": int(linhas[0].get("QT_TOTAL") or 0) if linhas else 0,
            "somente_com_visao": somente_com_visao,
            "pessoas": [self._mapear_pessoa(linha) for linha in linhas],
        }

    def obter_pessoa(self, cpf) -> dict:
        pessoa = self.repo.obter_pessoa(cpf)
        if not pessoa:
            raise PermissaoError("Colaborador nao encontrado.", 404)

        detalhe = self._mapear_pessoa(pessoa)
        detalhe["ajustes"] = {
            linha["AREA"]: bool(linha.get("CONCEDIDA"))
            for linha in self.repo.listar_ajustes(cpf)
        }
        return detalhe

    def definir_perfil(self, cpf, codigo_perfil, definido_por) -> dict:
        if not self.repo.obter_pessoa(cpf):
            raise PermissaoError("Colaborador nao encontrado.", 404)

        codigos = {perfil["codigo"] for perfil in self.listar_perfis()}
        if codigo_perfil not in codigos:
            raise PermissaoError("Visao desconhecida.", 400)

        self.repo.definir_perfil(
            cpf=cpf, codigo_perfil=codigo_perfil, definido_por=definido_por
        )
        self.invalidar_cache()
        return self.obter_pessoa(cpf)

    def remover_perfil(self, cpf) -> dict:
        if not self.repo.obter_pessoa(cpf):
            raise PermissaoError("Colaborador nao encontrado.", 404)

        self.repo.remover_perfil(cpf)
        self.invalidar_cache()
        return self.obter_pessoa(cpf)

    def definir_ajuste(self, cpf, area, concedida, definido_por) -> dict:
        if not self.repo.obter_pessoa(cpf):
            raise PermissaoError("Colaborador nao encontrado.", 404)

        areas_validas = {linha.get("AREA") for linha in self.repo.listar_areas()}
        if area not in areas_validas:
            raise PermissaoError("Area desconhecida.", 400)

        if concedida is None:
            # Sem valor, o ajuste deixa de existir e a area volta a acompanhar
            # o pacote da visao.
            self.repo.limpar_ajuste(cpf=cpf, area=area)
        else:
            self.repo.definir_ajuste(
                cpf=cpf, area=area, concedida=concedida, definido_por=definido_por
            )

        self.invalidar_cache()
        return self.obter_pessoa(cpf)

    def _mapear_pessoa(self, linha) -> dict:
        cpf = str(linha.get("CPF") or "").strip()
        perfil = linha.get("CODIGO_PERFIL")
        areas = self.areas_para(
            funcao=linha.get("FUNCAO"),
            centro_custo=linha.get("CENTRO_CUSTO"),
            cpf=cpf,
        )

        return {
            "cpf": cpf,
            "nome": linha.get("NOME"),
            "centro_custo": linha.get("CENTRO_CUSTO"),
            "funcao": linha.get("FUNCAO"),
            "perfil": perfil,
            # A tela distingue "voce escolheu isto" de "veio do cargo": sem
            # essa marca, remover a visao de alguem parece nao ter efeito.
            "origem": "PERFIL" if perfil else "PADRAO",
            "areas": sorted(areas),
        }

    @staticmethod
    def _inteiro(valor, padrao):
        try:
            return int(valor)
        except (TypeError, ValueError):
            return padrao

    @staticmethod
    def _verdadeiro(valor, padrao=False):
        if valor is None:
            return padrao
        return str(valor).strip().lower() in {"1", "true", "sim", "on", "yes"}

    def _usuario(self, cpf) -> dict:
        usuario = LoginRepository(str(cpf)).login()
        if not usuario:
            raise PermissaoError("Usuario nao encontrado.", 404)
        return usuario

    def _areas_legado(self, *, funcao, centro_custo) -> set[str]:
        centro = normalizar_valor(centro_custo)
        eh_admin = (
            centro in _CENTROS_ADMIN_LEGADO
            or any(funcao_casa(funcao, cargo) for cargo in _FUNCOES_ADMIN_LEGADO)
        )

        areas = set()
        if centro == "GERENCIA OPERACIONAL":
            areas.update({
                "gerencia.gestao",
                "gerencia.resultados",
                "arena.observatorio",
            })
        if funcao_casa(funcao, "GERENTE DE OPERACOES"):
            areas.add("gerencia.resultados")
        if centro == "DESENVOLVIMENTO":
            areas.update({"arena.observatorio", "acessos.gerenciar"})
        if "SUPERVISOR" in normalizar_valor(funcao):
            areas.add("arena.supervisor")
        if eh_admin:
            areas.add("senhas.reset")

        return areas
