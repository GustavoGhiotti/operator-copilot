from .dados_usuario import DadosUsuario
import requests

class EmitirBoleto(DadosUsuario):
  def __init__(self, *,servidor:str,id_cliente:int,id_acordo:int, parcela:int):
    super().__init__(servidor)
    self.id_cliente = id_cliente
    self.id_acordo = id_acordo
    self.parcela = parcela

  def emitir(self) -> str:
    url = self.url + "EmitirBoleto"

    headers = {'content-type': 'text/xml'}
    body = f"""<?xml version="1.0" encoding="utf-8"?>
                <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <EmitirBoleto xmlns="http://soap.collectsys.example/easycollectorws/">
                    <logonUsuario>{self.usuario}</logonUsuario>
                    <senhaUsuario>{self.senha}</senhaUsuario>
                    <idCliente>{self.id_cliente}</idCliente>
                    <idAcordo>{self.id_acordo}</idAcordo>
                    <parcela>{self.parcela}</parcela>
                    <TipoArquivoRetorno>pdf</TipoArquivoRetorno>
                    </EmitirBoleto>
                </soap:Body>
                </soap:Envelope>
            """

    response = requests.post(url, data=body, headers=headers, verify=False)
    resultado = response.text.replace("&lt;","<").replace("&gt;",">")
    
    return resultado
