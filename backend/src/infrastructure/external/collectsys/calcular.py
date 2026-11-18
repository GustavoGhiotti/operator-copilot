from .dados_usuario import DadosUsuario
from datetime import date, timedelta, datetime
from src.infrastructure.database.database_dados_collectsys import DataBaseCollectSys
from src.infrastructure.services.env_load import conexao_65
from src.infrastructure.services.utils import extrair_tag
from io import BytesIO
import gzip
import requests
import holidays
import re

config = conexao_65("easycollector")

class Calcular(DadosUsuario):
    def __init__(self, servidor:str, id_cliente:int, id_cedente:int, plano:int,valor_entrada:float,
                 xml_divida:str, vencimento = None):
        super().__init__(servidor)
        self.id_cliente = id_cliente
        self.id_cedente = id_cedente
        self.plano = plano
        self.valor_entrada = valor_entrada
        self.vencimento = vencimento
        self.xml_divida = xml_divida


    def calcular_acordo(self) -> str:
        url = self.url + "CalcularAcordo"

        match self.id_cedente:
            case 3:
                desconto = 200
            case _:
                desconto = 100      

        if not self.vencimento:
            self.vencimento = date.today() + timedelta(days=7)
        
        data_vencimento = validacao_dia_util(self.vencimento)
        def calcular() -> str:
            headers = {'content-type': 'text/xml'}
            body = (f'''<?xml version="1.0" encoding="utf-8"?>
                <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                    <CalcularAcordo xmlns="http://soap.collectsys.example/easycollectorws/">
                        <logonUsuario>{self.usuario}</logonUsuario>
                        <senhaUsuario>{self.senha}</senhaUsuario>
                        <idCliente>{self.id_cliente}</idCliente>
                        <plano>{self.plano}</plano>
                        <dataEntrada>{data_vencimento}</dataEntrada>
                        <valorEntradaDiferenciada>{self.valor_entrada}</valorEntradaDiferenciada>
                        <percentualDesconto>{desconto}</percentualDesconto>
                        <taxaJuros>0</taxaJuros>
                        <tipoCalculo>1</tipoCalculo>
                        <dividaXml><![CDATA[{self.xml_divida}]]></dividaXml>
                    </CalcularAcordo>
                    </soap:Body>
                </soap:Envelope>''')
            
            response = requests.post(url, data=body, headers=headers, verify=False, stream=True)
            resultado = response.text.replace("&lt;", "<").replace("&gt;", ">")

            return resultado

        resultado = calcular()

        if "<RetornoErro>" in resultado and "data" in resultado.lower():
            data_vencimento = capturar_data(resultado)
            
            resultado = calcular()
            
            return resultado

        else:
            return resultado      
                   


    def calcular_acordo_com_detalhes(self, politica:str=None) -> str:
        url = self.url + "CalcularAcordo"

        match self.id_cedente:
            case 51:
                desconto = 100
                detalhe = [["SIMULATION_ID", "", 1292, "Acordo", "Manual"],
                           ["IOF_ACORDO", "",743, "Acordo", "Manual"],
                           ["TIPO PAGAMENTO BANCOALFA", "BOLETO", 2812, "Acordo", "Manual"]]
            case 60:
                politica = DataBaseCollectSys(config).obter_politica(self.id_cliente)
                desconto = 200
                detalhe = [ ["MEIO DE PAGAMENTO", "BOLETO_PIX", 1000,"Acordo", "Manual"],
                            ["TIPO NEGOCIACAO", "ACORDO", 912, "Acordo", "Manual"],
                            ["POLITICA NEGOCIACAO", politica["NM_DETALHE_VALOR"], 1065,"Acordo", "Manual"],
                            ["TIPO DE ENVIO DESCONTO", "ENVIAR MORA E PRINCIPAL", 1002, "Acordo", "Manual"]
                        ]
            case _:
                desconto = 100      


        def gerar_detalhe() -> str:
            acordo_detalhe = ""
                    
            for nome_detalhe, valor, id_detalhe, tipo_detalhe, origem in detalhe:
                acordo_detalhe +=  f"""<AcordoDetalhe> 
                                            <Nome>{nome_detalhe}</Nome>
                                            <Valor>{valor}</Valor> 
                                            <IdDetalhe>{id_detalhe}</IdDetalhe> 
                                            <TipoDetalhe>{tipo_detalhe}</TipoDetalhe>
                                            <TipoOrigemDetalhe>{origem}</TipoOrigemDetalhe>
                                        </AcordoDetalhe>
                                    """

            return f"<ArrayOfAcordoDetalhe>{acordo_detalhe}</ArrayOfAcordoDetalhe>"


        detalhe_calculo = gerar_detalhe()

        if not self.vencimento:
            self.vencimento = date.today() + timedelta(days=7)
        
        data_vencimento = validacao_dia_util(self.vencimento)
        
        def calcular() -> str:
            headers = {'content-type': 'text/xml'}
            
            body = f"""<?xml version="1.0" encoding="utf-8"?>
                  <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                      <CalcularAcordoComDetalhe xmlns="http://soap.collectsys.example/easycollectorws/">
                                <logonUsuario>{self.usuario}</logonUsuario>
                                <senhaUsuario>{self.senha}</senhaUsuario>
                                <idCliente>{self.id_cliente}</idCliente>
                                <plano>{self.plano}</plano>
                                <dataEntrada>{data_vencimento}</dataEntrada>
                                <valorEntradaDiferenciada>{self.valor_entrada}</valorEntradaDiferenciada>
                                <percentualDesconto>{desconto}</percentualDesconto>
                                <taxaJuros>0</taxaJuros>
                                <tipoCalculo>0</tipoCalculo>
                                <dataDemaisParcelas>1900-01-01</dataDemaisParcelas>
                                <valorHonorarios>0</valorHonorarios>
                                <idEquipeAprovador>0</idEquipeAprovador>
                                <intervaloVencimento>0</intervaloVencimento>
                                <dividaXml><![CDATA[{self.xml_divida}]]></dividaXml>
                                <detalheCalculoXml><![CDATA[{detalhe_calculo}]]></detalheCalculoXml>
                            </CalcularAcordoComDetalhe>
                            </soap:Body>
                        </soap:Envelope>
                    """
            
            response = requests.post(url, data=body, headers=headers, verify=False, stream=True)
            return response.text.replace("&lt;", "<").replace("&gt;", ">")

        resultado = calcular()

        if "<RetornoErro>" in resultado and "data" in resultado.lower():
            data_vencimento = capturar_data(resultado)

            resultado = calcular()

        
        return resultado

    def calcular_divida(self) -> str:
        url = self.url + "CalcularDivida"

        headers = {'content-type': 'text/xml'}
        body = f"""<?xml version="1.0" encoding="utf-8"?>
                        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                            <soap:Body>
                            <CalcularDivida xmlns="http://soap.collectsys.example/easycollectorws/">
                                <logonUsuario>{self.usuario}</logonUsuario>
                                <senhaUsuario>{self.senha}</senhaUsuario>
                                <idCliente>{self.id_cliente}</idCliente>
                                <percentualDesconto>0</percentualDesconto>
                                <tipoCalculo>0</tipoCalculo>
                                <dividaXml><![CDATA[{self.xml_divida}]]></dividaXml>
                            </CalcularDivida> 
                            </soap:Body>
                        </soap:Envelope>
                """
        
        response = requests.post(url, data=body, headers=headers, verify=False, stream=True)
        resultado = response.text.replace("&lt;", "<").replace("&gt;", ">")
        return resultado

    def obter_parcelamento_max(self) -> str:
        url = self.url + "ObterPlanoMaximoAcordo"

        headers = {'content-type': 'text/xml'}
        body =  f"""<?xml version="1.0" encoding="utf-8"?>
                    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <ObterPlanoMaximoAcordo xmlns="http://soap.collectsys.example/easycollectorws/">
                            <logonUsuario>{self.usuario}</logonUsuario>
                            <senhaUsuario>{self.senha}</senhaUsuario>
                            <dividaXml><![CDATA[{self.xml_divida}]]></dividaXml>
                        </ObterPlanoMaximoAcordo>
                    </soap:Body>
                    </soap:Envelope>
                """

        response = requests.post(url, data=body, headers=headers, verify=False)
        resultado = response.text.replace("&lt;", "<").replace("&gt;", ">")
        return resultado
    

def validacao_dia_util(dia) -> date:
    feriados = holidays.BR()

    while (dia.weekday() in [5, 6]) or (dia in feriados):
    # Ajusta o vencimento para o dia anterior
        dia = dia - timedelta(days=1)

    return dia


def capturar_data(resultado:str) -> date:
    # Expressão regular para capturar datas no formato DD/MM/AAAA ou AAAA-MM-DD
    regex_datas = r'\b\d{2}/\d{2}/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b'
    # Encontrar todas as datas no texto
    data_encontrada = re.findall(regex_datas, resultado)
    data = data_encontrada[0] 

    if "/" in data:  # Formato DD/MM/AAAA
        data = datetime.strptime(data, '%d/%m/%Y')
    else:
        data = datetime.strptime(data_encontrada[0], '%Y-%m-%d') 

    data_vencimento = validacao_dia_util(data)

    return data_vencimento.strftime('%Y-%m-%d')


def capturar_parcelamento_max(resultado:str) -> int:
    try: 
        mensagem = extrair_tag(resultado, "<Mensagem>", "</Mensagem>")
        parcelamento = re.findall(r"\d+", mensagem)

        valores_encontrados = []
        valores_encontrados.extend([int (x) for x in parcelamento])
        
        return max(valores_encontrados)
    except Exception:
        return None