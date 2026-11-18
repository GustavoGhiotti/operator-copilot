import os
import logging
from src.infrastructure.repositories.sql_mensagem_whatsapp_repository import *
from src.infrastructure.clients.twilio_client import TwilioClient
from src.shared.utils.env_load import *
from src.shared.errors.envio_mensagem_exceptions import *
from src.domain.entities.cedentes import Mu
from requests.auth import HTTPBasicAuth
import requests, json, re

from src.infrastructure.external.acmeAPI.boleto import Emitir, ConsultarDividasAtivas, ConsultarAcordos
from src.shared.errors.envio_mensagem_exceptions import EnvioMensagemException
from src.infrastructure.external.acmeAPI.envio_mensagem import MensagemWhatsapp
from werkzeug.datastructures.file_storage import FileStorage

class EnvioMensagemWhatsapp:
    def __init__(self, id_cliente:int, numero_cliente:str, operador:str, carteira:str=None, id_cedente:int=None, id_acordo:int=None):
        self.id_cliente = id_cliente
        self.numero_cliente = numero_cliente
        self.operador = operador
        self.carteira = carteira
        self.id_cedente = id_cedente
        self.id_acordo = id_acordo
        self.logger = LogEnvioWhatsappRepository()

    def preventivo(self,boleto:FileStorage=None) -> None:
        try: 
            if not self.logger.contar_envios_total_diario():
                raise EnvioMensagemException(
                    f"O limite diário foi atingido."
                    "Tente novamente amanhã."
                    )
            if boleto:
                result = DadosAcordoRepository().obter_dados(self.id_cliente, self.id_acordo)
                dados_envio = self._montar_dados_envio(result)
                url_boleto = Emitir().anexar_boleto(self.id_cliente, boleto, boleto.filename)
            else:
                result = DadosAcordoRepository().obter_dados(self.id_cliente, self.id_acordo)
                if not result:
                    raise EnvioMensagemException("Nao foi encontrado um acordo para emitir o boleto.")

                dados_envio = self._montar_dados_envio(result)
                # A parcela a emitir vem da API (verifica-divida-cedente),
                # que reflete a situacao atual do acordo. Usa a menor parcela
                # em aberto; se a API nao retornar, mantem o valor do banco.
                parcela_api = ConsultarAcordos().obter_menor_parcela(
                    self.id_cliente, result["ID_ACORDO"]
                )
                parcela_emitir = int(parcela_api or result.get("NU_PARCELA") or 1)
                url_boleto = Emitir().boleto(
                    self.id_cliente,
                    result["ID_ACORDO"],
                    result["ID_CEDENTE"],
                    parcela_emitir,
                )

            sid_template = "envio_preventivo_copilot"
            payload = { 
                "1": str(dados_envio["NM_CLIENTE"]).lower().capitalize(),
                "2": dados_envio["NM_CEDENTE_FORMATADO"],
                "url": url_boleto,
                }
        
            MensagemWhatsapp().enviar("preventivo",
                                    dados_envio["ID_CEDENTE"],
                                    sid_template,
                                    self.numero_cliente,
                                    payload
                                    )

            self._registrar_log("preventivo",
                                dados={
                                        "ID_CEDENTE": dados_envio["ID_CEDENTE"],
                                        "NM_CLIENTE": dados_envio["NM_CLIENTE"],
                                        "NM_CEDENTE_FORMATADO": dados_envio["NM_CEDENTE_FORMATADO"]
                                    },
                            response_text=str("Boleto enviado"),
                            sucesso=True)

        except EnvioMensagemException:
            raise
        except Exception:
            raise EnvioMensagemException("Erro ao enviar boleto")

    def _montar_dados_envio(self, result: dict=None) -> dict:
        if not result:
            carteira = self._obter_carteira_fallback()

            return {
                "ID_CEDENTE": carteira["ID_CEDENTE"],
                "NM_CLIENTE": carteira.get("NM_CLIENTE") or "Cliente",
                "NM_CEDENTE_FORMATADO": carteira["NM_CEDENTE_FORMATADO"],
            }

        carteira = CarteiraRepository.obter_carteira(result["ID_CEDENTE"])
        if carteira:
            result.update(carteira)

        result["NM_CEDENTE_FORMATADO"] = Mu.grupo(result["NM_CONTRATO_CEDENTE"]) if result["ID_CEDENTE"] == 3 else result["NM_CEDENTE_FORMATADO"]

        return result

    def _obter_carteira_fallback(self) -> dict:
        # A carteira e o cedente do operador são apenas informativos e não
        # identificam o cliente. Primeiro tenta o valor como ID_CLIENTE CollectSys.
        dados_cliente_ec = DadosAcordoRepository().obter_cliente(
            self.id_cliente
        )
        cpf_cnpj = (
            dados_cliente_ec.get("CPF_CNPJ")
            if dados_cliente_ec
            else None
        )

        # Se não existir no EasyCollector, UPSILON e SIRIUS utilizam o
        # próprio valor informado como CPF/CNPJ.
        documento = re.sub(r"\D", "", str(self.id_cliente or ""))
        # A API Acme também aceita CPF com zero inicial omitido (10 dígitos).
        if not dados_cliente_ec and len(documento) in (10, 11, 14):
            cpf_cnpj = documento

        dados_divida = (
            ConsultarDividasAtivas().obter_dados_cliente(cpf_cnpj)
            if cpf_cnpj
            else None
        )
        if dados_divida:
            id_cedente_divida = dados_divida.get("ID_CEDENTE")
            carteira = (
                CarteiraRepository.obter_carteira(id_cedente_divida)
                if id_cedente_divida
                else CarteiraRepository.obter_carteira_por_nome(
                    dados_divida.get("NM_CEDENTE")
                )
            )
            if carteira:
                return {
                    "ID_CEDENTE": (
                        id_cedente_divida
                        or carteira["ID_CEDENTE"]
                    ),
                    "NM_CLIENTE": dados_divida["NM_CLIENTE"],
                    "NM_CEDENTE_FORMATADO": carteira["NM_CEDENTE_FORMATADO"],
                }

        # Para CollectSys, os dados do EasyCollector também servem como fallback
        # quando a consulta à API Acme estiver indisponível.
        # Clientes da carteira 53 podem nao possuir divida ativa, mas ainda
        # estar cadastrados no EasyCollector. Para boleto anexado, permite o
        # envio usando o cedente e o primeiro nome registrados em TB_CLIENTE.
        cliente_sem_divida = DadosAcordoRepository().obter_cliente_sem_divida(
            self.id_cliente
        )
        if cliente_sem_divida and int(cliente_sem_divida.get("ID_CEDENTE") or 0) == 53:
            carteira = CarteiraRepository.obter_carteira(53)
            if carteira:
                return {
                    "ID_CEDENTE": 53,
                    "NM_CLIENTE": cliente_sem_divida.get("NM_CLIENTE") or "Cliente",
                    "NM_CEDENTE_FORMATADO": carteira["NM_CEDENTE_FORMATADO"],
                }

        if dados_cliente_ec:
            carteira = CarteiraRepository.obter_carteira(
                dados_cliente_ec["ID_CEDENTE"]
            )
            if carteira:
                return {
                    "ID_CEDENTE": dados_cliente_ec["ID_CEDENTE"],
                    "NM_CLIENTE": dados_cliente_ec["NM_CLIENTE"] or "Cliente",
                    "NM_CEDENTE_FORMATADO": carteira["NM_CEDENTE_FORMATADO"],
                }

        try:
            dados_cliente = DadosDesligouRepository().obter_dados(self.id_cliente)
        except Exception:
            dados_cliente = None

        if dados_cliente:
            return {
                "ID_CEDENTE": dados_cliente["ID_CEDENTE"],
                "NM_CEDENTE_FORMATADO": dados_cliente["NM_CEDENTE_FORMATADO"],
            }

        raise EnvioMensagemException(
            "Nao foi possivel identificar o cedente para enviar o boleto."
        )


    def _registrar_log(self, tipo_envio: str, dados: dict, response_text: str, sucesso: bool):
        self.logger.registrar_log_envio(
            operador=self.operador,
            id_cliente=self.id_cliente,
            numero_destino=self.numero_cliente,
            tipo_envio=tipo_envio,
            id_cedente=dados.get("ID_CEDENTE"),
            nm_cliente=dados.get("NM_CLIENTE"),
            nm_cedente=dados.get("NM_CEDENTE_FORMATADO"),
            status_envio="sucesso" if sucesso else "erro",
            response_raw=response_text
        )

    
class TotalEnvioMensagens:
    def obter(operador):
        result = LogEnvioWhatsappRepository().contar_por_tipo(operador=operador)

        return {"preventivo": result["preventivo"],
                "recusa": result["recusa"],
                "desligou": result["desligou"],
                "total": result["preventivo"] + result["recusa"] + result["desligou"]
                }


class EnvioBoletoService:
    def executar(self,data: dict):
        try:
            nome_cliente = data.get("nome_cliente")
            data_vencimento = data.get("data_vencimento")
            valor_acordo = data.get("valor_acordo")
            whatsapp = data.get("whatsapp")
            link_boleto = data.get("link_boleto")
            codigo_pix = data.get("codigo_pix")
            carteira = data.get("carteira")
            operador = data.get("operador")

            if not all([nome_cliente,data_vencimento,valor_acordo,whatsapp,link_boleto]):
                return {"erro":"Campos obrigatórios ausentes."}

            data_pt = f"{data_vencimento.split('-')[2]}/{data_vencimento.split('-')[1]}/{data_vencimento.split('-')[0]}"
            valor_pt = valor_acordo.replace(".",",")
            link_limpo = link_boleto.strip().replace("\n","").replace(" ","")
            numero_formatado = f"whatsapp:+55{whatsapp.strip().replace(' ','').replace('-','')}"

            payload = {
                "To":numero_formatado,
                "MessagingServiceSid":os.getenv("TWILIO_MESSAGING_SERVICE_SID"),
                "ContentSid":os.getenv("TWILIO_CONTENT_SID_BOLETO"),
                "ContentVariables":json.dumps({
                    "1":nome_cliente,
                    "2":data_pt,
                    "3":valor_pt,
                    "5":link_limpo,
                    "7":carteira,
                    "8":codigo_pix
                })
            }

            response = TwilioClient().enviar(payload)

            if response.get("sucesso"):
                EnvioBoletoRepository().registrar_log(operador,nome_cliente,whatsapp,valor_pt,data_pt,carteira,link_limpo,"SUCESSO",response.get("sid"),None,codigo_pix)

                return {
                    "mensagem":"Link do boleto enviado com sucesso via WhatsApp",
                    "sid":response.get("sid"),
                    "status":response.get("status")
                }

            EnvioBoletoRepository().registrar_log(operador,nome_cliente,whatsapp,valor_pt,data_pt,carteira,link_limpo,"ERRO",None,response.get("erro"),codigo_pix)

            return {"erro":"Falha no envio via Twilio","detalhe":response.get("erro")}

        except Exception as e:
            logging.exception("Erro ao enviar boleto")
            EnvioBoletoRepository().registrar_log(data.get("operador"),data.get("nome_cliente"),data.get("whatsapp"),data.get("valor_acordo"),data.get("data_vencimento"),data.get("carteira"),data.get("link_boleto"),"ERRO",None,str(e),data.get("codigo_pix"))
            return {"erro":str(e)}
