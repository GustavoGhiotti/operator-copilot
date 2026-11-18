from .dados_usuario import DadosUsuario
import requests

class Tabular(DadosUsuario):
  def __init__(self, *,servidor:str,id_cliente:int, id_acao:int, descricao_acao:str, 
               ddd:int,telefone:int):
    
    super().__init__(servidor)
    self.id_cliente = id_cliente
    self.id_acao = id_acao
    self.descricao_acao = descricao_acao
    self.ddd = ddd
    self.telefone = telefone

  def acao(self) -> str:
    url = self.url + "InserirAcao"

    headers = {'content-type': 'text/xml'}
    body = f"""<?xml version="1.0" encoding="utf-8"?>
                <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                  <soap:Body>
                    <InserirAcao xmlns="http://soap.collectsys.example/easycollectorws/">
                      <logonUsuario>{self.usuario}</logonUsuario>
                      <senhaUsuario>{self.senha}</senhaUsuario>
                      <idCliente>{self.id_cliente}</idCliente>
                      <idAcao>{self.id_acao}</idAcao>
                      <descricaoAcao>{self.descricao_acao}</descricaoAcao>
                      <ddd>{self.ddd}</ddd>
                      <telefone>{self.telefone}</telefone>
                    </InserirAcao>
                  </soap:Body>
                </soap:Envelope>
            """
    
    response = requests.post(url, data=body, headers=headers, verify=False)
    return response.text.replace("&lt;","<").replace("&gt;",">")

  def acaoComDetalhes(self, nmDetalhe, vlrDetalhe, qtdDetalhe) -> str:
    url = ""
    if self.servidor == "1":
      url = "http://10.0.0.64/easycollectorws/easycollectorWs.asmx?op=InserirAcaoComDetalhe"
    else:
      url = "http://10.0.0.18/easycollectorws/easycollectorWs.asmx?op=InserirAcaoComDetalhe"

    detalhesXML = ""
    for i in range(qtdDetalhe):
      detalhesXML += f'''
            <AcaoDetalheWebService>
                <NomeDetalhe>{nmDetalhe[i]}</NomeDetalhe>
                <ValorDetalhe>{vlrDetalhe[i]}</ValorDetalhe>
            </AcaoDetalheWebService>
        '''


    headers = {'content-type': 'text/xml'}
    body = f'''<?xml version="1.0" encoding="utf-8"?>
                   <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                     <soap:Body>
                       <InserirAcaoComDetalhe xmlns="http://soap.collectsys.example/easycollectorws/">
                         <logonUsuario>{self.usuario}</logonUsuario>
                         <senhaUsuario>{self.senha}</senhaUsuario>
                         <idCliente>{self.id_cliente}</idCliente>
                         <idAcao>{self.id_acao}</idAcao>
                         <descricaoAcao>{self.descricao_acao}</descricaoAcao>
                         <ddd>{self.ddd}</ddd>
                         <telefone>{self.telefone}</telefone>
                         <detalhesXml><![CDATA[<ArrayOfAcaoDetalheWebService>{detalhesXML}</ArrayOfAcaoDetalheWebService>]]></detalhesXml>
                       </InserirAcaoComDetalhe>
                     </soap:Body>
                   </soap:Envelope>
             '''
    response = requests.post(url, data=body, headers=headers, verify=False)
    return response.text.replace("&lt;", "<").replace("&gt;", ">")