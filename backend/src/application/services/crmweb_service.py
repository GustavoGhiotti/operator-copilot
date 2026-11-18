from datetime import date, datetime, timedelta, timezone

from src.infrastructure.repositories.sql_crmweb_repository import CrmwebRepository

repo = CrmwebRepository()
FUSO_SAO_PAULO = timezone(timedelta(hours=-3))


def calcular_datas_d9(data_base=None):
    if data_base is None:
        data_base = datetime.now(FUSO_SAO_PAULO).date()

    if not isinstance(data_base, date):
        raise TypeError("data_base deve ser uma data")

    return {
        "base": data_base.isoformat(),
        "d2": (data_base + timedelta(days=2)).isoformat(),
        "d4": (data_base + timedelta(days=4)).isoformat(),
        "d6": (data_base + timedelta(days=6)).isoformat(),
        "d9": (data_base + timedelta(days=9)).isoformat(),
    }


class RegistrarBuscaService:

    def executar(self, contrato, periodoAte, dataPagto, tipoPagto, usuario, buscarCoobrigado):

        try:

            id_busca = repo.criar(
                contrato.strip(),
                periodoAte.strip(),
                dataPagto.strip() if dataPagto else None,
                tipoPagto,
                usuario.strip(),
                buscarCoobrigado
            )

            return {
                "id_busca": id_busca,
                "status": "PENDENTE"
            }

        except Exception as e:

            return {
                "erro": "Erro ao criar pedido de consulta",
                "detalhe": str(e)
            }


class RegistrarBuscasD9Service:

    def executar(self, contrato, tipoPagto, usuario, buscarCoobrigado):
        try:
            if not contrato or not usuario or tipoPagto is None:
                raise ValueError("Campos obrigatorios nao informados")

            contrato = contrato.strip()
            usuario = usuario.strip()

            if len(contrato) != 12 or not contrato.isdigit():
                raise ValueError("Contrato deve conter exatamente 12 digitos")

            datas = calcular_datas_d9()
            buscas = repo.criar_d9(
                contrato,
                datas["base"],
                tipoPagto,
                usuario,
                buscarCoobrigado,
                datas,
            )

            busca_base = next(busca for busca in buscas if busca["marco"] == "base")

            return {
                "id_busca": busca_base["id_busca"],
                "status": "PENDENTE1",
                "periodo_ate": datas["base"],
                "datas": datas,
                "buscas": buscas,
            }
        except Exception as e:
            return {
                "erro": "Erro ao criar pedidos D+9",
                "detalhe": str(e),
            }


class BuscarDadosCacheService:

    def executar(self, contrato, periodoAte, dataPagto, tipoPagto, buscarCoobrigado):

        try:
            dados = repo.buscar_cache(
                contrato.strip(),
                periodoAte.strip(),
                dataPagto.strip() if dataPagto else None,
                tipoPagto,
                buscarCoobrigado
            )

            return dados
        
        except Exception as e:

            return {
                "erro": "Erro ao buscar dados",
                "detalhe": str(e)
            }
        
class BuscarDadosService:

    def executar(self, id_busca):

        try:
            dados = repo.buscar_dados(
                id_busca.strip()
            )

            return dados
        
        except Exception as e:

            return {
                "erro": "Erro ao buscar dados",
                "detalhe": str(e)
            }
