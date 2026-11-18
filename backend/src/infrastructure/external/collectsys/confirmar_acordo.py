from .dados_usuario import DadosUsuario
from src.shared.dividas_exception import ErroFormalizarAcordo
import requests

class ConfirmarAcordo(DadosUsuario):
    def __init__(self, servidor:str, id_cliente:int, xml_acordo:str):
        super().__init__(servidor)
        self.id_cliente = id_cliente
        self.xml_acordo = xml_acordo

    def formalizar(self) -> str:   
        url = self.url + "ConfirmarAcordo"

        headers = {'content-type': 'text/xml'}
        body = f"""<?xml version="1.0" encoding="utf-8"?>
                    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <ConfirmarAcordo xmlns="http://soap.collectsys.example/easycollectorws/">
                        <logonUsuario>{self.usuario}</logonUsuario>
                        <senhaUsuario>{self.senha}</senhaUsuario>
                        <idCliente>{self.id_cliente}</idCliente>
                        <acordoXml><![CDATA[{self.xml_acordo}]]></acordoXml>
                        </ConfirmarAcordo>
                    </soap:Body>
                    </soap:Envelope>
                """

        response = requests.post(url=url, data=body, headers=headers, verify=False)
        resultado = response.text.replace("&lt;","<").replace("&gt;",">")
        
        if "<RetornoErro>" in resultado:
                raise ErroFormalizarAcordo(mensagem=resultado)
            
        return resultado