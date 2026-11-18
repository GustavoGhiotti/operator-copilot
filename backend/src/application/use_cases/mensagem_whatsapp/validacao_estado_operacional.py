class MonitoriaBusinessError(PermissionError):
    def __init__(self, erro: str, mensagem: str, codigo: str, status_http: int):
        super().__init__(mensagem)
        self.erro = erro
        self.codigo = codigo
        self.status_http = status_http


class EstadoOperacionalInconsistenteError(MonitoriaBusinessError):
    def __init__(self, mensagem: str):
        super().__init__(
            erro="ESTADO_INCONSISTENTE_CONVERSA",
            mensagem=mensagem,
            codigo="MONITORIA_ESTADO_INVALIDO",
            status_http=409
        )


class ConflitoOperacionalError(MonitoriaBusinessError):
    def __init__(self, mensagem: str, codigo: str):
        super().__init__(
            erro="ATENDIMENTO_NAO_PERMITIDO",
            mensagem=mensagem,
            codigo=codigo,
            status_http=409
        )


class RecursoNaoEncontradoError(MonitoriaBusinessError):
    def __init__(self, mensagem: str, codigo: str):
        super().__init__(
            erro="RECURSO_NAO_ENCONTRADO",
            mensagem=mensagem,
            codigo=codigo,
            status_http=404
        )


class ConfiguracaoIntegracaoMetaError(MonitoriaBusinessError):
    def __init__(self, mensagem: str, codigo: str = "MONITORIA_META_CONFIGURACAO_INVALIDA"):
        super().__init__(
            erro="CONFIGURACAO_INTEGRACAO_META_INVALIDA",
            mensagem=mensagem,
            codigo=codigo,
            status_http=500
        )


class EnvioMensagemMetaError(MonitoriaBusinessError):
    def __init__(self, mensagem: str, codigo: str = "MONITORIA_ENVIO_META_FALHOU"):
        super().__init__(
            erro="FALHA_ENVIO_WHATSAPP_META",
            mensagem=mensagem,
            codigo=codigo,
            status_http=502
        )


def validar_estado_conversa_atendimento(
    conversa: dict | None,
    atendimento_ativo: dict | None
) -> None:
    if not conversa:
        return

    status_conversa = (conversa.get("STATUS_CONVERSA") or "").strip().upper()

    if status_conversa == "ABERTA" and atendimento_ativo:
        raise EstadoOperacionalInconsistenteError(
            "A conversa esta aberta, mas possui atendimento ativo."
        )

    if status_conversa == "EM_ATENDIMENTO" and not atendimento_ativo:
        raise EstadoOperacionalInconsistenteError(
            "A conversa esta em atendimento, mas nao possui atendimento ativo."
        )

    if status_conversa == "ENCERRADA" and atendimento_ativo:
        raise EstadoOperacionalInconsistenteError(
            "A conversa esta encerrada, mas possui atendimento ativo."
        )

    if status_conversa not in {"ABERTA", "EM_ATENDIMENTO", "ENCERRADA"}:
        raise EstadoOperacionalInconsistenteError(
            "A conversa possui um status operacional invalido."
        )
