from datetime import datetime, timezone
from .constantes_eventos import TIPO_EVENTO_STATUS_ATUALIZADO

class ReceberStatusMensagemWhatsapp:
    def __init__(self, repository):
        self.repository = repository

        # Precedencia: maior = mais final
        self._precedencia = {
            "sent": 1,
            "delivered": 2,
            "read": 3,
            "failed": 3
        }

        self._status_finais = {"read", "failed"}

    def executar(self, evento: dict) -> dict:
        id_mensagem_provedor = evento["id_mensagem_provedor"]
        novo_status = (evento.get("novo_status") or "").strip().lower()

        # Status desconhecido
        if novo_status not in self._precedencia:
            return {
                "ok": True,
                "atualizado": False,
                "motivo": "mensagem_nao_encontrada",
                "id_mensagem_provedor": id_mensagem_provedor,
                "novo_status": novo_status
            }
        
        # Busca status atual
        status_atual = self.repository.obter_status_mensagem(id_mensagem_provedor)
        if not status_atual:
            return {
                "ok": True,
                "atualizado": False,
                "motivo": "mensagem_nao_encontrada",
                "id_mensagem_provedor": id_mensagem_provedor,
                "novo_status": novo_status
            }
        
        status_atual = status_atual.strip().lower()

        # Se já está em estado final, nunca muda
        if status_atual in self._status_finais:
            return {
                "ok": True,
                "atualizado": False,
                "motivo": "estado_final",
                "id_mensagem_provedor": id_mensagem_provedor,
                "status_atual": status_atual,
                "novo_status": novo_status
            }
        
        # Caso especial: status inicial (ex: received)
        if status_atual not in self._precedencia:
            atualizado = True
        else:
            nivel_atual = self._precedencia[status_atual]
            nivel_novo = self._precedencia[novo_status]

            if nivel_novo <= nivel_atual:
                return {
                    "ok": True,
                    "atualizado": False,
                    "motivo": "regressao_ou_duplicado",
                    "id_mensagem_provedor": id_mensagem_provedor,
                    "status_atual": status_atual,
                    "novo_status": novo_status
                }

            atualizado = True

        error_code = evento.get("error_code")
        error_message = evento.get("error_message")
        data_evento = self._epoch_para_utc(evento.get("timestamp"))

        with self.repository.transacao():
            self.repository.atualizar_status_mensagem(
                id_mensagem_provedor=id_mensagem_provedor,
                novo_status=novo_status,
                data_evento=data_evento,
                error_code=error_code,
                error_message=error_message
            )

            conversa = self.repository.obter_conversa_por_mensagem(id_mensagem_provedor)

            if conversa:
                self.repository.inserir_evento(
                    tipo_evento=TIPO_EVENTO_STATUS_ATUALIZADO,
                    id_conversa=conversa["ID_CONVERSA"],
                    id_mensagem_provedor=id_mensagem_provedor,
                    numero_empresa=conversa["NUMERO_EMPRESA"],
                    numero_cliente=conversa["NUMERO_CLIENTE"],
                    payload={
                        "status_anterior": status_atual,
                        "novo_status": novo_status
                    }
                )

        return {
            "ok": True,
            "atualizado": atualizado,
            "id_mensagem_provedor": id_mensagem_provedor,
            "status_atual": status_atual,
            "novo_status": novo_status
        }
    
    @staticmethod
    def _epoch_para_utc(valor) -> datetime:
        try:
            return datetime.fromtimestamp(int(valor), tz=timezone.utc)
        except Exception:
            # Se vier invalido não trava o webhook
            return datetime.now(timezone.utc)
    
