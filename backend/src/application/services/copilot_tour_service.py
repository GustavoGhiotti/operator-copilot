from src.infrastructure.repositories.sql_copilot_tour_repository import (
    CopilotTourRepository,
)


class CopilotTourError(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


class CopilotTourService:
    """Estado do tour guiado de boas-vindas.

    Fonte da verdade e o banco. O front mantinha isso em localStorage, que e
    apagado no logout, no logout por inatividade e no interceptor de 401 — com
    JWT de 1 hora, o operador refazia o tour toda sessao.
    """

    # Avancar esta constante faz o tour reaparecer para todo mundo, sem
    # precisar apagar registro nenhum.
    VERSAO_TOUR = "copilot-2.0"

    def __init__(self, repo=None):
        self.repo = repo or CopilotTourRepository()

    def consultar(self, cpf):
        """`deve_exibir` e o unico campo que a tela precisa ler.

        Quando a tabela nao existe, ele vem `False`: sem lugar para gravar, o
        tour voltaria a cada carregamento da home, e um tour que nao para de
        aparecer e pior do que nao ter tour.
        """
        if not self.repo.estrutura_disponivel():
            return {
                "disponivel": False,
                "visto": False,
                "concluido": False,
                "deve_exibir": False,
            }

        registro = self.repo.obter_conclusao(cpf, self.VERSAO_TOUR)
        if not registro:
            return {
                "disponivel": True,
                "visto": False,
                "concluido": False,
                "deve_exibir": True,
            }

        return {
            "disponivel": True,
            "visto": True,
            "concluido": bool(registro.get("CONCLUIDO")),
            "deve_exibir": False,
        }

    def registrar(self, cpf, data):
        concluido = bool((data or {}).get("concluido"))
        if not self.repo.estrutura_disponivel():
            return {"registrado": False, "motivo": "estrutura_indisponivel"}

        self.repo.registrar_conclusao(cpf, self.VERSAO_TOUR, concluido)
        return {"registrado": True, "concluido": concluido}

    def reiniciar(self, cpf):
        """Chamado pelo comando @Tour: apaga a marca para rever tudo."""
        if not self.repo.estrutura_disponivel():
            return {"reiniciado": False, "motivo": "estrutura_indisponivel"}

        self.repo.remover_conclusao(cpf, self.VERSAO_TOUR)
        return {"reiniciado": True}
