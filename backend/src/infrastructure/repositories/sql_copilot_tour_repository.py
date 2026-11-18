from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class CopilotTourRepository:
    """Acesso a TB_COPILOT_TOUR_CONCLUSAO.

    `estrutura_disponivel` e publico porque o service precisa saber a diferenca
    entre "esta pessoa ainda nao viu o tour" e "nao consigo responder isso" —
    sao decisoes opostas na tela.
    """

    def __init__(self):
        self.db = SQLServerConnection(
            DB_HOST_66,
            "DB_COPILOT_ACME"
        )
        self._tem_estrutura = None

    def estrutura_disponivel(self):
        # Memoriza por instancia: cada consulta abre conexao nova, e sem isto
        # um unico carregamento da home faria dois round-trips so de schema.
        if self._tem_estrutura is None:
            linha = self.db.execute_fetch(
                query="""
                    SELECT CASE
                        WHEN OBJECT_ID(
                            'dbo.TB_COPILOT_TOUR_CONCLUSAO', 'U'
                        ) IS NULL THEN 0 ELSE 1
                    END AS disponivel
                """,
                parametros=(),
                one=True,
            )
            self._tem_estrutura = bool(linha and linha.get("disponivel"))
        return self._tem_estrutura

    def obter_conclusao(self, cpf, versao):
        return self.db.execute_fetch(
            query="""
                SELECT CONCLUIDO, DATA_REGISTRO
                FROM dbo.TB_COPILOT_TOUR_CONCLUSAO WITH (NOLOCK)
                WHERE CPF_COLABORADOR = ? AND VERSAO_TOUR = ?
            """,
            parametros=(str(cpf), versao),
            one=True,
        )

    def registrar_conclusao(self, cpf, versao, concluido):
        """MERGE: quem pulou e depois refez pelo @Tour vira 'concluido'."""
        return self._executar_commit(
            query="""
                MERGE dbo.TB_COPILOT_TOUR_CONCLUSAO AS destino
                USING (SELECT ? AS CPF, ? AS VERSAO) AS origem
                    ON destino.CPF_COLABORADOR = origem.CPF
                   AND destino.VERSAO_TOUR = origem.VERSAO
                WHEN MATCHED THEN UPDATE SET
                    CONCLUIDO = ?,
                    DATA_REGISTRO = SYSDATETIME()
                WHEN NOT MATCHED THEN INSERT (
                    CPF_COLABORADOR, VERSAO_TOUR, CONCLUIDO
                ) VALUES (?, ?, ?);
            """,
            parametros=(
                str(cpf), versao,
                1 if concluido else 0,
                str(cpf), versao, 1 if concluido else 0,
            ),
        )

    def remover_conclusao(self, cpf, versao):
        """Usado pelo comando @Tour, que faz o operador rever tudo."""
        return self._executar_commit(
            query="""
                DELETE FROM dbo.TB_COPILOT_TOUR_CONCLUSAO
                WHERE CPF_COLABORADOR = ? AND VERSAO_TOUR = ?
            """,
            parametros=(str(cpf), versao),
        )

    def _executar_commit(self, *, query, parametros):
        """Confirma a escrita ou propaga o erro para a rota HTTP."""
        transacao = self.db.begin_transaction()
        try:
            resultado = transacao.execute_commit(
                query=query,
                parametros=parametros,
            )
            transacao.commit()
            return resultado
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()
