from src.infrastructure.repositories.sql_acordos_repository import ListaAcordosRepository


class ListaAcordosService:
    def executar(self,usuario:str):
        resultado = ListaAcordosRepository().buscar(usuario)

        if not resultado:
            return None

        colunas = [
            "NM_USUARIO","NM_LOGIN_DISCADOR","CPF_CNPJ_INT","ID_CLIENTE",
            "ID_ACORDO","ID_CONTRATO","CARTEIRA","GRUPO","DATA_ACORDO","DATA_PAGO",
            "NU_PLANO","VL_ENTRADA","VL_PARCELA","VL_ACORDO","VL_RISCO",
            "DT_VENCIMENTO","STATUS_ACORDO","PREVENTIVO","DESCRICAO",
            "DATA_ATUALIZACAO","QUEBRA"
        ]

        dados = []
        for linha in resultado:
            dados.append({col: linha.get(col) for col in colunas})

        return dados
