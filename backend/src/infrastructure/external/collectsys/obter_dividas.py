from .dados_usuario import DadosUsuario
import requests

class ObterDivida(DadosUsuario):
    def __init__(self, servidor:str):
        super().__init__(servidor)

    def consultar_por_cpf(self, cpf: str):
        url = self.url + "ObterDividaAtivaPorCPF" 

        headers = {'content-type': 'text/xml'}
        body = (f'''<?xml version="1.0" encoding="utf-8"?>
                <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                <soap:Body>
                    <ObterDividaAtivaPorCPF xmlns="http://soap.collectsys.example/easycollectorws/">
                        <logonUsuario>{self.usuario}</logonUsuario>
                        <senhaUsuario>{self.senha}</senhaUsuario>
                        <cpfCnpj>{cpf}</cpfCnpj>
                    </ObterDividaAtivaPorCPF>
                </soap:Body>
                </soap:Envelope>''')
        response = requests.post(url, data=body, headers=headers, verify=False)
        return response.text.replace("&lt;","<").replace("&gt;",">")

    def consultar_por_id(self, id_cliente: int):
        url = self.url + "ObterDividaAtiva"

        headers = {'content-type': 'text/xml'}
        body = f"""<?xml version="1.0" encoding="utf-8"?>
                <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                    <soap:Body>
                    <ObterDividaAtiva xmlns="http://soap.collectsys.example/easycollectorws/">
                        <logonUsuario>{self.usuario}</logonUsuario>
                        <senhaUsuario>{self.senha}</senhaUsuario>
                        <idCliente>{id_cliente}</idCliente>
                    </ObterDividaAtiva>
                    </soap:Body>
                </soap:Envelope>
                """
                
        response = requests.post(url, data=body, headers=headers, verify=False)
        return response.text.replace("&lt;","<").replace("&gt;",">")
