from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class AgendamentosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def listar(self, usuario: str):
        query = """
            SELECT ID_AGENDAMENTO, NOME_CLIENTE, CPF_CLIENTE, EC, HORARIO_RETORNO, DATA_CRIACAO
            FROM TB_AGENDAMENTOS_RETORNO WITH (NOLOCK)
            WHERE USUARIO = ?
            ORDER BY HORARIO_RETORNO ASC
        """
        return self.db.execute_fetch(query=query, parametros=(usuario,), one=False)

    def criar(self, usuario, nome, cpf, ec, horario_formatado):
        query = """
            INSERT INTO TB_AGENDAMENTOS_RETORNO
                (USUARIO, NOME_CLIENTE, CPF_CLIENTE, EC, HORARIO_RETORNO, DATA_CRIACAO)
            VALUES
                (?, ?, ?, ?, CONVERT(DATETIME, ?, 120), GETDATE())
        """
        parametros = (usuario, nome, cpf, ec, horario_formatado)
        return self.db.execute_commit(query=query, parametros=parametros)

    def excluir(self, agendamento_id):
        query = "DELETE FROM TB_AGENDAMENTOS_RETORNO WHERE ID_AGENDAMENTO = ?"
        return self.db.execute_commit(query=query, parametros=(agendamento_id,))
