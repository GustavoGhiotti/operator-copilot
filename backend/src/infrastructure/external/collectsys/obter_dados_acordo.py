from .dados_usuario import DadosUsuario
import requests

class DadosAcordo(DadosUsuario):
    def __init__(self, servidor:str, id_cliente:int, id_acordo:int):
        super().__init__(servidor)
        self.id_cliente = id_cliente
        self.id_acordo = id_acordo


    def obter_acordo(self):
        url = self.url + "ConsultarAcordo"

        headers = {"Content-Type" : "text/xml; charset=utf-8"}
        body = f"""<?xml version="1.0" encoding="utf-8"?>
                    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                        <ConsultarAcordo xmlns="http://soap.collectsys.example/easycollectorws/">
                        <logonUsuario>{self.usuario}</logonUsuario>
                        <senhaUsuario>{self.senha}</senhaUsuario>
                        <idCliente>{self.id_cliente}</idCliente>
                        <idAcordo>{self.id_acordo}</idAcordo>
                        </ConsultarAcordo>
                    </soap:Body>
                    </soap:Envelope>
                """

        response = requests.post(url=url, headers=headers, data=body, verify=False)
        return response.text.replace("&lt;","<").replace("&gt;",">")

    def obter_faturas(self) -> str:
        url = self.url + "ConsultarAcordoFaturas"

        headers = {"Content-type": "text/xml; charset=utf-8"}
        body = f"""<?xml version="1.0" encoding="utf-8"?>
                    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                        <soap:Body>
                            <ConsultarAcordoFaturas xmlns="http://soap.collectsys.example/easycollectorws/">
                            <logonUsuario>{self.usuario}</logonUsuario>
                            <senhaUsuario>{self.senha}</senhaUsuario>
                            <idCliente>{self.id_cliente}</idCliente>
                            <idAcordo>{self.id_acordo}</idAcordo>
                            </ConsultarAcordoFaturas>
                        </soap:Body>
                    </soap:Envelope>
                """

        response = requests.post(url=url, data=body, headers=headers, verify=False)
        return response.text.replace("&lt;","<").replace("&gt;",">")
    
