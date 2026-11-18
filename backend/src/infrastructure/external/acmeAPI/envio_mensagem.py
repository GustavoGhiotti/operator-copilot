from .token import *
from src.shared.errors.envio_mensagem_exceptions import EnvioMensagemException
import requests


class MensagemWhatsapp(AcmeAPI):
    def __init__(self):
        super().__init__()
        self.token = Token().obter_token()

    def enviar(self, canal:str, id_cedente:int, sid_template:str, numero_cliente:str, payload:dict):
        try: 
            url = f"{self.url_base}/digital/infobip/envio-mensagens-whatsapp"     
            headers = {"Authorization":  f"Bearer {self.token}"}

            body = {
                    "canal": canal,
                    "idCedente": id_cedente,
                    "sidTemplate": sid_template,
                    "telefoneCliente": numero_cliente,
                    "variaveis": payload 
                }


            response = requests.post(url=url, headers=headers, json=body, timeout=30)
            response.raise_for_status()

            try:
                response_data = response.json()
            except ValueError:
                raise EnvioMensagemException(
                    f"Resposta invalida ao enviar mensagem: {response.status_code} {response.text}"
                )

            if isinstance(response_data, list):
                if not response_data:
                    raise EnvioMensagemException("Resposta vazia ao enviar mensagem")
                result = response_data[0]
            elif isinstance(response_data, dict):
                result = response_data
            else:
                raise EnvioMensagemException(
                    f"Formato inesperado ao enviar mensagem: {response_data}"
                )

            if result.get("status") is not True:
                detalhe = result.get("msg") or result.get("erro") or result
                raise EnvioMensagemException(f"Erro ao enviar mensagem: {detalhe}")

            return result
             
        except EnvioMensagemException:
            raise
        except requests.RequestException as e:
            detalhe = e.response.text if e.response is not None else str(e)
            raise EnvioMensagemException(f"Erro HTTP ao enviar mensagem: {detalhe}")
        except Exception as e:
            raise EnvioMensagemException(f"Erro ao enviar mensagem: {e}")
