import requests

from src.application.use_cases.mensagem_whatsapp.validacao_estado_operacional import (
    ConfiguracaoIntegracaoMetaError,
    EnvioMensagemMetaError,
)
from src.shared.utils.env_load import META_ACCESS_TOKEN, META_GRAPH_API_VERSION


class MetaWhatsappClient:
    BASE_URL = "https://graph.facebook.com"
    TIMEOUT_SECONDS = 15

    def __init__(
        self,
        *,
        access_token: str | None = META_ACCESS_TOKEN,
        api_version: str = META_GRAPH_API_VERSION,
    ):
        self.access_token = access_token
        self.api_version = api_version

    def enviar_texto(
        self,
        *,
        phone_number_id: str,
        numero_destino: str,
        conteudo: str,
    ) -> dict:
        if not self.access_token:
            raise ConfiguracaoIntegracaoMetaError(
                "META_ACCESS_TOKEN nao configurado no ambiente do Copilot."
            )

        if not phone_number_id:
            raise ConfiguracaoIntegracaoMetaError(
                "PHONE_NUMBER_ID_META nao configurado para o numero de envio."
            )

        url = f"{self.BASE_URL}/{self.api_version}/{phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        body = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": numero_destino,
            "type": "text",
            "text": {
                "body": conteudo,
            },
        }

        try:
            response = requests.post(
                url,
                headers=headers,
                json=body,
                timeout=self.TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            raise EnvioMensagemMetaError(
                "Falha de comunicacao com a Meta ao enviar mensagem."
            ) from exc

        try:
            response_json = response.json() if response.content else {}
        except ValueError:
            response_json = {}
        if response.status_code >= 400:
            erro = ((response_json.get("error") or {}) if isinstance(response_json, dict) else {})
            mensagem = erro.get("message") or response.text or "Falha ao enviar mensagem para a Meta."
            codigo = erro.get("code")
            subcodigo = erro.get("error_subcode")
            detalhe_codigo = (
                f" code={codigo} subcode={subcodigo}"
                if codigo or subcodigo
                else ""
            )
            raise EnvioMensagemMetaError(f"{mensagem}{detalhe_codigo}")

        mensagens = response_json.get("messages") or []
        if not mensagens:
            raise EnvioMensagemMetaError(
                "Meta nao retornou o identificador da mensagem enviada."
            )

        id_mensagem = mensagens[0].get("id")
        if not id_mensagem:
            raise EnvioMensagemMetaError(
                "Meta nao retornou um wamid valido para a mensagem enviada."
            )

        return {
            "id_mensagem_provedor": id_mensagem,
            "response": response_json,
        }
