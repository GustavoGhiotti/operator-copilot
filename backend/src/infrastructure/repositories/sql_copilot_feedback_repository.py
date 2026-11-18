from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class CopilotFeedbackRepository:
    """Acesso a TB_COPILOT_FEEDBACK_VERSAO.

    Diferente da telemetria de uso, aqui NAO da para engolir a escrita em
    silencio quando a tabela nao existe: o operador escreveu um texto e espera
    que ele chegue em algum lugar. Por isso `estrutura_disponivel` e publico —
    o service consulta antes e responde honestamente que nao conseguiu salvar.
    """

    def __init__(self):
        self.db = SQLServerConnection(
            DB_HOST_66,
            "DB_COPILOT_ACME"
        )
        self._tem_estrutura = None

    def estrutura_disponivel(self):
        # Memoriza por instancia: cada consulta abre uma conexao nova, e sem
        # isto um unico envio faria dois round-trips so para checar schema.
        if self._tem_estrutura is None:
            linha = self.db.execute_fetch(
                query="""
                    SELECT CASE
                        WHEN OBJECT_ID(
                            'dbo.TB_COPILOT_FEEDBACK_VERSAO', 'U'
                        ) IS NULL THEN 0 ELSE 1
                    END AS disponivel
                """,
                parametros=(),
                one=True,
            )
            self._tem_estrutura = bool(linha and linha.get("disponivel"))
        return self._tem_estrutura

    def obter_usuario(self, cpf):
        return self.db.execute_fetch(
            query="""
                SELECT
                    CONVERT(VARCHAR(20), CPF_COLABORADOR) AS CPF,
                    LTRIM(RTRIM(NM_COLABORADOR)) AS NOME,
                    LTRIM(RTRIM(FUNCAO_COLABORADOR)) AS FUNCAO,
                    LTRIM(RTRIM(CENTRO_CUSTO)) AS CENTRO_CUSTO
                FROM login.TB_USUARIOS WITH(NOLOCK)
                WHERE CONVERT(VARCHAR(20), CPF_COLABORADOR) = ?
                  AND ISNULL(USUARIO_ATIVO, 1) = 1
            """,
            parametros=(str(cpf),),
            one=True,
        )

    def obter_feedback(self, cpf, versao):
        return self.db.execute_fetch(
            query="""
                SELECT NOTA, COMENTARIO, DATA_ENVIO
                FROM dbo.TB_COPILOT_FEEDBACK_VERSAO WITH (NOLOCK)
                WHERE CPF_COLABORADOR = ? AND VERSAO = ?
            """,
            parametros=(str(cpf), versao),
            one=True,
        )

    def salvar_feedback(
        self,
        cpf,
        versao,
        nota,
        comentario,
        nome,
        centro_custo,
        funcao,
    ):
        """Grava ou atualiza a opiniao da pessoa nesta versao.

        MERGE porque quem refizer o @Tour cai de novo nesta tela: repetir a
        mesma pessoa em varias linhas so atrapalharia a leitura.
        """
        transacao = self.db.begin_transaction()
        try:
            resultado = transacao.execute_commit(
                query="""
                MERGE dbo.TB_COPILOT_FEEDBACK_VERSAO AS destino
                USING (SELECT ? AS CPF, ? AS VERSAO) AS origem
                    ON destino.CPF_COLABORADOR = origem.CPF
                   AND destino.VERSAO = origem.VERSAO
                WHEN MATCHED THEN UPDATE SET
                    NOTA = ?,
                    COMENTARIO = ?,
                    NOME_SNAPSHOT = ?,
                    CENTRO_CUSTO_SNAPSHOT = ?,
                    FUNCAO_SNAPSHOT = ?,
                    DATA_ENVIO = SYSDATETIME()
                WHEN NOT MATCHED THEN INSERT (
                    CPF_COLABORADOR, VERSAO, NOTA, COMENTARIO,
                    NOME_SNAPSHOT, CENTRO_CUSTO_SNAPSHOT, FUNCAO_SNAPSHOT
                ) VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                parametros=(
                    str(cpf), versao,
                    nota, comentario, nome, centro_custo, funcao,
                    str(cpf), versao, nota, comentario,
                    nome, centro_custo, funcao,
                ),
            )
            transacao.commit()
            return resultado
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()
