from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class ClientesPendentesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self, operador: str):
        query = """
                    SELECT 
                        a.NM_NOME AS NOME_CLIENTE,
                        a.NU_CPF_CNPJ AS CPF_CLIENTE,
                        b.DT_VENCIMENTO AS DATA_VENCIMENTO,
                        b.VL_ENTRADA AS VALOR_TOTAL,
                        b.NM_USUARIO AS NOME_OPERADOR
                    FROM TB_CARTEIRA a
                    JOIN TB_PARCELAS b 
                        ON a.ID_CLIENTE = b.ID_CLIENTE
                    WHERE 
                        b.NM_USUARIO LIKE ?
                        AND a.STATUS_ACORDO = 1
                        AND b.NU_PARCELA = 1
                        AND CAST(b.DT_VENCIMENTO AS DATE) = CAST(GETDATE() AS DATE)
                """

        return self.db.execute_fetch(query=query, parametros=(operador,), one=False)

class ListaCombateRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self, usuario: str):
        query = """
            SELECT *
            FROM base_Lista_combate WITH(NOLOCK)
            WHERE USUARIO LIKE ?
        """

        return self.db.execute_fetch(query=query,parametros=(f"%{usuario}%",),one=False)
    
class AtualizarObservacaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(
            ip_servidor=DB_HOST_66,
            banco="DB_COPILOT_ACME"
        )

    def atualizar_observacao(self, id_cliente: int, observacao: str) -> bool:
        query = """
                    UPDATE DB_COPILOT_ACME.dbo.Base_Lista_Combate
                        SET OBS_USUARIO = ?
                    WHERE ID_CLIENTE = ?
                """

        resultado = self.db.execute_commit(query=query, parametros=(observacao, id_cliente))

        return not isinstance(resultado, Exception)

    def registrar_log(self, id_cliente: int, carteira: str, descricao: str, comando: str, data) -> bool:
        query = """
                    INSERT INTO DB_COPILOT_ACME.dbo.TB_ACAO_PRODUCAO_COPILOT
                        (ID_CLIENTE, CARTEIRA, DESCRICAO, UPDATE_DATE, COMANDO)
                    VALUES
                        (?, ?, ?, ?, ?)
                """

        parametros = (id_cliente,carteira,descricao,data,comando)

        resultado = self.db.execute_commit(query=query,parametros=parametros)

        return not isinstance(resultado, Exception)



class AtualizarDescricaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(ip_servidor=DB_HOST_66,banco="DB_COPILOT_ACME")

    def atualizar_descricao(self,id_cliente: int,descricao: str) -> bool:
        query = """
            UPDATE DB_COPILOT_ACME.dbo.TB_PRODUCAO_COPILOT
               SET DESCRICAO = ?
             WHERE ID_CLIENTE = ?
        """

        resultado = self.db.execute_commit(query=query,parametros=(descricao,id_cliente))
        return not isinstance(resultado,Exception)

    def registrar_log(self,id_cliente: int,descricao: str,data,id_acordo: int,id_contrato: int,carteira: str,comando: str) -> bool:
        query = """
            INSERT INTO DB_COPILOT_ACME.dbo.TB_ACAO_PRODUCAO_COPILOT
                (ID_CLIENTE,DESCRICAO,UPDATE_DATE,ID_ACORDO,ID_CONTRATO,CARTEIRA,COMANDO)
            VALUES (?,?,?,?,?,?,?)
        """

        parametros = (id_cliente,descricao,data,id_acordo,id_contrato,carteira,comando)

        resultado = self.db.execute_commit(query=query,parametros=parametros)
        return not isinstance(resultado,Exception)
