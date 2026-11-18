from datetime import datetime, timezone
from .constantes_eventos import TIPO_EVENTO_MENSAGEM_RECEBIDA

class ReceberMensagemWhatsappUseCase:
    def __init__(self, repository):
        self.repository = repository

    def executar(self, payload: dict) -> dict:
        id_mensagem_provedor = payload["id_mensagem_provedor"]

        # Idempotência
        if self.repository.mensagem_existe(id_mensagem_provedor):
            return {
                "ok": True,
                "duplicada": True,
                "id_mensagem_provedor": id_mensagem_provedor
            }

        # Timestamps oficiais
        timestamp_valor = payload.get("timestamp")

        try:
            data_whatsapp = datetime.fromtimestamp(
                int(timestamp_valor),
                tz=timezone.utc
            )
        except (TypeError, ValueError):
            # fallback defensivo
            data_whatsapp = datetime.now(timezone.utc)

        agora_utc = datetime.now(timezone.utc)

        numero_empresa = payload["numero_destino"]
        numero_cliente = payload["numero_origem"]

        # Buscar conversa existente
        conversa = self.repository.obter_conversa_aberta(
            numero_empresa=numero_empresa,
            numero_cliente=numero_cliente
        )

        with self.repository.transacao():
            if conversa:
                id_conversa = conversa["ID_CONVERSA"]
            else:
                id_conversa = self.repository.criar_conversa(
                    numero_empresa=numero_empresa,
                    phone_number_id_meta=payload["id_conta_whatsapp"],
                    numero_cliente=numero_cliente,
                    data_evento=data_whatsapp
                )

            # Inserir mensagem (RECEBIDA)
            self.repository.inserir_mensagem_recebida({
                "id_conversa": id_conversa,
                "id_mensagem_provedor": id_mensagem_provedor,
                "id_conta_whatsapp": payload["id_conta_whatsapp"],
                "numero_origem": numero_cliente,
                "numero_destino": numero_empresa,
                "conteudo": payload.get("conteudo", ""),
                "status_mensagem": "received",
                "data_hora_whatsapp": data_whatsapp,
                "data_coleta_sistema": agora_utc
            })

            self.repository.inserir_evento(
                tipo_evento=TIPO_EVENTO_MENSAGEM_RECEBIDA,
                id_conversa=id_conversa,
                id_mensagem_provedor=id_mensagem_provedor,
                numero_empresa=numero_empresa,
                numero_cliente=numero_cliente,
                payload={
                    "direcao": "RECEBIDA",
                    "status_mensagem": "received"
                }
            )

        return {
            "ok": True,
            "duplicada": False,
            "id_mensagem_provedor": id_mensagem_provedor
        }
