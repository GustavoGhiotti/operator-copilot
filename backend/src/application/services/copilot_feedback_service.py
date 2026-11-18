from src.infrastructure.repositories.sql_copilot_feedback_repository import (
    CopilotFeedbackRepository,
)


class CopilotFeedbackError(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


class CopilotFeedbackService:
    """Regras do feedback que o operador deixa ao final do tour."""

    VERSAO_ATUAL = "copilot-2.0"
    LIMITE_COMENTARIO = 2000
    NOTAS_VALIDAS = {1, 2, 3, 4, 5}

    def __init__(self, repo=None):
        self.repo = repo or CopilotFeedbackRepository()

    @classmethod
    def _normalizar_nota(cls, bruto):
        if bruto in (None, ""):
            return None
        try:
            nota = int(bruto)
        except (TypeError, ValueError):
            raise CopilotFeedbackError("Nota invalida.")
        if nota not in cls.NOTAS_VALIDAS:
            raise CopilotFeedbackError("A nota precisa ficar entre 1 e 5.")
        return nota

    @classmethod
    def _normalizar_comentario(cls, bruto):
        # Colapsa espacos e quebras repetidas, mas preserva paragrafos: o
        # operador digita em campo livre e costuma dar Enter mais de uma vez.
        texto = str(bruto or "").strip()
        if len(texto) > cls.LIMITE_COMENTARIO:
            raise CopilotFeedbackError(
                f"O comentario passa de {cls.LIMITE_COMENTARIO} caracteres."
            )
        return texto or None

    def consultar(self, cpf):
        """O que esta pessoa ja respondeu — para a tela nao pedir de novo."""
        if not self.repo.estrutura_disponivel():
            return {"disponivel": False, "respondido": False}

        registro = self.repo.obter_feedback(cpf, self.VERSAO_ATUAL)
        if not registro:
            return {"disponivel": True, "respondido": False}

        return {
            "disponivel": True,
            "respondido": True,
            "nota": registro.get("NOTA"),
            "comentario": registro.get("COMENTARIO"),
        }

    def registrar(self, cpf, data):
        nota = self._normalizar_nota((data or {}).get("nota"))
        comentario = self._normalizar_comentario((data or {}).get("comentario"))

        if nota is None and comentario is None:
            raise CopilotFeedbackError(
                "Escreva um comentario ou escolha uma nota."
            )

        # Antes de gravar, porque prometer que salvou sem tabela seria pior
        # que avisar: a pessoa escreveu algo e merece saber que se perdeu.
        if not self.repo.estrutura_disponivel():
            return {
                "registrado": False,
                "motivo": "estrutura_indisponivel",
            }

        usuario = self.repo.obter_usuario(cpf) or {}
        self.repo.salvar_feedback(
            cpf,
            self.VERSAO_ATUAL,
            nota,
            comentario,
            usuario.get("NOME"),
            usuario.get("CENTRO_CUSTO"),
            usuario.get("FUNCAO"),
        )
        return {"registrado": True}
