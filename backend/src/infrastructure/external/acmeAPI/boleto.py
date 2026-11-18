from .token import *
from src.shared.errors.acme_api_exceptions import *
import json

class Emitir(AcmeAPI):
    def __init__(self):
        super().__init__()
        self.token = Token().obter_token()

    def boleto(self, id_cliente, id_acordo:int, id_cedente:str, parcela:int):
        try: 
            url = f"{self.url_base}/acme/emitir-boleto"
            headers = {"Authorization":  f"Bearer {self.token}"}
            payload =   {
                            "idCliente": id_cliente,
                            "idAcordo": id_acordo,
                            "idCedente": id_cedente,
                            "parcela": parcela
                        }

            response = requests.post(url=url, headers=headers,json=payload)
            result = json.loads(response.text)

            # O DTO atual retorna boleto.urlBoleto; aceita também o padrão V2
            # com urlBoleto na raiz para manter a migração retrocompatível.
            dados_boleto = result.get("boleto") or result
            url_boleto = dados_boleto.get("urlBoleto")
            if not url_boleto:
                raise EmissaoBoletoException(
                    f"Resposta inesperada ao emitir boleto: "
                    f"{response.status_code} {response.text}"
                )

            return url_boleto
        
        except EmissaoBoletoException:
            raise
        except Exception as e:
            raise EmissaoBoletoException("Erro ao baixar o boleto")
            
    def anexar_boleto(self, id_cliente:int, arquivo_boleto, nome_arquivo:str=None):
        try:
            url = f"{self.url_base}/upload/upload-arquivo"
            headers = {"Authorization": f"Bearer {self.token}"}
            files = {"file": (nome_arquivo, arquivo_boleto, "application/pdf")}
            data = {"idCliente": id_cliente}

            response = requests.post(url=url, headers=headers, files=files, data=data)
            try:
                result = response.json()
            except ValueError:
                raise EmissaoBoletoException(
                    f"Resposta invalida do upload: {response.status_code} {response.text}"
                )

            # Legacy retorna boleto.urlBoleto; o DTO V2 retorna urlBoleto
            # diretamente na raiz.
            dados_boleto = result.get("boleto") or result
            url_boleto = dados_boleto.get("urlBoleto")
            if not url_boleto:
                raise EmissaoBoletoException(
                    f"Resposta inesperada do upload: {response.status_code} {response.text}"
                )

            return url_boleto

        except EmissaoBoletoException:
            raise 
        except Exception as e:
            print(e)
            raise EmissaoBoletoException("Erro ao anexar o boleto")

class Gerar(AcmeAPI):
    def __init__(self):
        super().__init__()
        self.token = Token().obter_token()

    def anexar_boleto(self, id_cliente:int, arquivo_boleto, nome_arquivo:str=None):
        try:
            url = f"{self.url_base}/upload/upload-arquivo"
            headers = {"Authorization": f"Bearer {self.token}"}
            files = {"file": (nome_arquivo, arquivo_boleto, "application/pdf")}
            data = {"idCliente": id_cliente}

            response = requests.post(url=url, headers=headers, files=files, data=data)
            try:
                result = response.json()
            except ValueError:
                raise EmissaoBoletoException(
                    f"Resposta invalida do upload: {response.status_code} {response.text}"
                )

            # Compatível com Legacy (boleto.urlBoleto) e V2 (urlBoleto).
            dados_boleto = result.get("boleto") or result
            url_boleto = dados_boleto.get("urlBoleto")
            if not url_boleto:
                raise EmissaoBoletoException(
                    f"Resposta inesperada do upload: {response.status_code} {response.text}"
                )

            return url_boleto

        except EmissaoBoletoException:
            raise 
        except Exception as e:
            print(e)
            raise EmissaoBoletoException("Erro ao anexar o boleto")


class ConsultarAcordos(AcmeAPI):
    def __init__(self):
        super().__init__()
        self.token = Token().obter_token()

    def acordos_ativos(self, id_cliente, cedente: str = "COPILOT"):
        try:
            url = f"{self.url_base}/acme/verifica-divida-cedente"
            headers = {
                "Authorization": f"Bearer {self.token}",
                "idCliente": str(id_cliente),
                "cedente": "COPILOT",
            }

            response = requests.get(url=url, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()

            if not result.get("status"):
                return []

            contratos = result.get("contratos") or {}
            if isinstance(contratos, dict):
                contratos_iteraveis = contratos.values()
            else:
                contratos_iteraveis = contratos

            acordos = []
            acordos_adicionados = set()

            for contrato in contratos_iteraveis:
                contrato_dados = contrato.get("contratos") if "contratos" in contrato else contrato
                if not isinstance(contrato_dados, dict):
                    continue

                grupo = contrato_dados.get("grupo")
                for parcela in contrato_dados.get("parcelas") or []:
                    id_acordo = parcela.get("idAcordo")
                    if not id_acordo or id_acordo in acordos_adicionados:
                        continue

                    acordos_adicionados.add(id_acordo)
                    acordos.append({
                        "ID_ACORDO": id_acordo,
                        "NU_PARCELA": parcela.get("parcela") or 1,
                        "DT_PAGAMENTO": parcela.get("dataVencimento"),
                        "VL_PARCELA": parcela.get("valor"),
                        "GRUPO": grupo,
                    })

            return acordos

        except Exception as e:
            print(e)
            raise EmissaoBoletoException("Erro ao consultar acordos na API Acme")

    def obter_menor_parcela(self, id_cliente, id_acordo: int):
        """Consulta a API verifica-divida-cedente e retorna o menor numero de
        parcela do acordo informado. Retorna None quando o acordo nao possui
        parcelas no retorno (deixando o chamador decidir o fallback)."""
        try:
            url = f"{self.url_base}/acme/verifica-divida-cedente"
            headers = {
                "Authorization": f"Bearer {self.token}",
                "idCliente": str(id_cliente),
                "cedente": "COPILOT",
            }

            response = requests.get(url=url, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()

            if not result.get("status"):
                return None

            contratos = result.get("contratos") or {}
            if isinstance(contratos, dict):
                contratos_iteraveis = contratos.values()
            else:
                contratos_iteraveis = contratos

            parcelas_acordo = []
            for contrato in contratos_iteraveis:
                contrato_dados = contrato.get("contratos") if "contratos" in contrato else contrato
                if not isinstance(contrato_dados, dict):
                    continue

                for parcela in contrato_dados.get("parcelas") or []:
                    if int(parcela.get("idAcordo") or 0) != int(id_acordo):
                        continue
                    numero = parcela.get("parcela")
                    if numero is not None:
                        parcelas_acordo.append(int(numero))

            return min(parcelas_acordo) if parcelas_acordo else None

        except Exception as e:
            print(f"Erro ao consultar menor parcela na API Acme: {e}")
            return None


class ConsultarDividasAtivas(AcmeAPI):
    def __init__(self):
        super().__init__()
        self.token = Token().obter_token()

    def obter_dados_cliente(self, cpf_cnpj: str):
        try:
            url = f"{self.url_base}/acme/obter-dividas-ativa"
            headers = {
                "Authorization": f"Bearer {self.token}",
                "cpfCnpj": str(cpf_cnpj),
            }

            response = requests.get(url=url, headers=headers, timeout=30)
            response.raise_for_status()
            result = response.json()

            cliente = result.get("cliente") or {}
            dividas = result.get("dividas") or []
            if isinstance(dividas, dict):
                dividas = dividas.values()

            for divida in dividas:
                if not isinstance(divida, dict):
                    continue

                id_cedente = divida.get("idCedente") or divida.get("ID_CEDENTE")
                nome_cedente = divida.get("cedente") or divida.get("NM_CEDENTE")
                if id_cedente or nome_cedente:
                    dados = {
                        "NM_CLIENTE": (
                            cliente.get("nome")
                            or cliente.get("nomeCompleto")
                            or "Cliente"
                        ),
                        "NM_CEDENTE": nome_cedente,
                    }
                    if id_cedente:
                        dados["ID_CEDENTE"] = int(id_cedente)
                    return dados

            print(
                "Cedente nao encontrado no retorno de dividas ativas "
                f"para o cliente {cpf_cnpj}. Retorno: {result}"
            )
            return None
        except (TypeError, ValueError) as e:
            print(
                "Cedente invalido no retorno de dividas ativas "
                f"para o cliente {cpf_cnpj}: {e}"
            )
            return None
        except Exception as e:
            print(f"Erro ao consultar cedente nas dividas ativas: {e}")
            return None

    def obter_cedente(self, cpf_cnpj: str):
        dados_cliente = self.obter_dados_cliente(cpf_cnpj)
        return dados_cliente.get("ID_CEDENTE") if dados_cliente else None
