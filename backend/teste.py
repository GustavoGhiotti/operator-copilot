from src.application.negociacao_service import negociacao_parcelado
import asyncio



from src.application.services.enviar_mensagem_service import EnvioMensagemWhatsapp


EnvioMensagemWhatsapp(45675251,'5511900000002',).enviar("desligou")
EnvioMensagemWhatsapp(45675251,'5511900000002',).enviar("recusa")
EnvioMensagemWhatsapp(45675251,'5511900000002',).enviar("preventivo")
