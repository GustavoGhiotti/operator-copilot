from datetime import datetime

from src.application.services.auditoria_audio_service import AuditoriaAudioService
from src.infrastructure.repositories.sql_auditoria_repository import AuditoriaRepository
from src.infrastructure.repositories.sql_login_repository import LoginRepository
from src.shared.utils.monitoria_permissoes import normalizar_texto, possui_cargo


class AuditoriaPermissionError(PermissionError):
    pass


def usuario_pode_supervisionar(usuario: dict) -> bool:
    funcao = normalizar_texto(usuario.get("FUNCAO_COLABORADOR"))
    centro = normalizar_texto(usuario.get("CENTRO_CUSTO"))
    return "qualidade" in centro or possui_cargo(funcao, [
        "supervisor(a) de operacoes", "assistente de coordenacao",
        "supervisor(a) de qualidade", "coordenador(a) qualidade",
        "monitor de teleatendimento", "coordenador(a) de operacoes jr",
        "assistente de supervisao", "instrutor de treinamento jr",
        "gerente de operacoes jr", "gerente de operacoes sr",
    ])


def usuario_pode_acessar_delta(usuario: dict) -> bool:
    centro = normalizar_texto(usuario.get("CENTRO_CUSTO"))
    funcao = normalizar_texto(usuario.get("FUNCAO_COLABORADOR"))
    return (
        "delta" in centro
        or "qualidade" in centro
        or "treinamento" in centro
        or "monitor de teleatendimento" in funcao
        or "instrutor de treinamento" in funcao
    )


class AuditoriaService:
    def __init__(self):
        self.repo = AuditoriaRepository()
        self.audio = AuditoriaAudioService()

    @staticmethod
    def obter_usuario(cpf: str) -> dict:
        usuario = LoginRepository(cpf).login()
        if not usuario:
            raise AuditoriaPermissionError("Usuário autenticado não encontrado.")
        return usuario

    def criar(self, cpf_autenticado: str, request) -> int:
        usuario = self.obter_usuario(cpf_autenticado)
        centro = str(usuario.get("CENTRO_CUSTO") or "")
        if not usuario_pode_acessar_delta(usuario):
            raise AuditoriaPermissionError("A Auditoria ainda está disponível apenas para o Banco Delta.")

        cpf_operador = str(request.form.get("cpf_operador") or cpf_autenticado).strip()
        alvo = usuario
        if cpf_operador != str(cpf_autenticado):
            if not usuario_pode_supervisionar(usuario) or not usuario_pode_acessar_delta(usuario):
                raise AuditoriaPermissionError("Você não pode enviar auditorias para outro operador.")
            alvo = self.obter_usuario(cpf_operador)
            if "delta" not in str(alvo.get("CENTRO_CUSTO") or "").lower():
                raise AuditoriaPermissionError("O operador selecionado não pertence ao Banco Delta.")

        try:
            data_ligacao = datetime.fromisoformat(str(request.form.get("data_ligacao") or ""))
        except ValueError as exc:
            raise ValueError("Informe uma data válida para a ligação.") from exc

        audio = self.audio.validar_e_salvar(request.files.get("audio"))
        dados = {
            "cpf_operador": str(alvo["CPF_COLABORADOR"]),
            "nome_operador": str(alvo["NM_COLABORADOR"]),
            "data_ligacao": data_ligacao,
            "campanha": self._clean(request.form.get("campanha"), 200),
            "identificador_cliente": self._clean(request.form.get("identificador_cliente"), 200),
            "identificador_externo": self._clean(request.form.get("identificador_externo"), 200),
            "observacao": self._clean(request.form.get("observacao"), 2000),
        }
        try:
            return self.repo.criar(usuario=usuario, dados=dados, audio=audio)
        except Exception:
            self.audio.remover(audio["caminho"])
            raise

    @staticmethod
    def _clean(value, max_length: int):
        text = str(value or "").strip()
        return text[:max_length] or None

    def autorizar(self, cpf: str, audit_id: int) -> tuple[dict, dict]:
        usuario = self.obter_usuario(cpf)
        result = self.repo.obter_resultado(audit_id)
        if not result:
            raise LookupError("Auditoria não encontrada.")
        if result["cpf_operador"] != str(cpf) and not (
            usuario_pode_supervisionar(usuario) and usuario_pode_acessar_delta(usuario)
        ):
            raise AuditoriaPermissionError("Você não possui acesso a esta auditoria.")
        return usuario, result
