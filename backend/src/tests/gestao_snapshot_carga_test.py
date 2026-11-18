"""Invariantes do SQL de carga do snapshot.

Sao asserções sobre o texto da query, não sobre o banco: cada uma trava um erro
que só apareceria depois de a carga rodar por ~20 minutos em produção, e que
custaria outros 20 para reproduzir.
"""
import re
import unittest

from src.infrastructure.repositories import sql_gestao_snapshot_repository as carga


# Delimitar a CTE por "),\" quebra assim que um comentario dentro dela contem
# um parentese. O corpo vai do nome dela ate o nome da seguinte.
_ORDEM_DAS_CTES = [
    "ALIAS_PROD", "ALIAS_CAD", "ROSTER_BRUTO", "ROSTER", "FECHAMENTO", "VEGA",
    "CONTATO", "ACESSO", "QUALIDADE", "META_ATUAL", "DIA_OPERADOR",
    "CARTEIRA_PRIMARIA", "MESES", "DIAS_UTEIS", "CHAVES", "ORIGEM",
]


def corpo_da_cte(sql: str, nome: str) -> str:
    inicio = sql.index(f"{nome} AS (")
    seguinte = _ORDEM_DAS_CTES[_ORDEM_DAS_CTES.index(nome) + 1]
    fim = sql.index(f"{seguinte} AS (", inicio)
    return sql[inicio:fim]


class LoteDoMergeTest(unittest.TestCase):
    def test_lote_comeca_com_set_nocount_on(self):
        """Sem isto o MERGE roda inteiro e o fetch do total estoura no fim.

        O lote tem DML antes do SELECT final. Sem SET NOCOUNT ON cada comando
        devolve um "resultado" de contagem, o pyodbc para no primeiro e o
        fetchone() levanta "Previous SQL was not a query" -- depois dos 20
        minutos de varredura, com a transacao inteira revertida.
        """
        primeira_linha_util = next(
            linha.strip()
            for linha in carga._MERGE_SNAPSHOT.splitlines()
            if linha.strip() and not linha.strip().startswith("--")
        )
        self.assertEqual(primeira_linha_util, "SET NOCOUNT ON;")

    def test_delete_do_merge_repete_o_predicado_da_janela(self):
        """A linha mais perigosa do arquivo.

        WHEN NOT MATCHED BY SOURCE sem o predicado da janela apaga todo o
        historico fora dela -- e o historico de recuperado nao e recuperavel,
        porque a origem so guarda ~3 meses.
        """
        trecho = carga._MERGE_SNAPSHOT.split("WHEN NOT MATCHED BY SOURCE")[1]
        trecho = trecho.split("THEN DELETE")[0]
        self.assertIn("DESTINO.DATA >= @DataIni", trecho)
        self.assertIn("DESTINO.DATA < @DataFim", trecho)

    def test_merge_usa_holdlock(self):
        """Sem HOLDLOCK o MERGE tem race de insert-insert sob concorrencia."""
        self.assertIn(
            "MERGE dbo.TB_GESTAO_OPERADOR_DIA WITH (HOLDLOCK)",
            carga._MERGE_SNAPSHOT,
        )

    def test_comparacoes_de_alias_declaram_collation(self):
        """A origem e CI_AS e TEXTO_CHAVE e CI_AI.

        Sem COLLATE explicito o SQL Server recusa a comparacao em vez de
        escolher um lado -- foi assim que a primeira carga morreu.
        """
        for sql in (carga._MERGE_SNAPSHOT, carga._DESCOBRIR_ALIAS):
            for ocorrencia in re.finditer(r"TEXTO_CHAVE\s*=", sql):
                trecho = sql[ocorrencia.start(): ocorrencia.start() + 260]
                self.assertIn(
                    "COLLATE Latin1_General_CI_AI",
                    trecho,
                    "comparacao com TEXTO_CHAVE sem COLLATE explicito",
                )

    def test_fechamento_vem_de_tb_parcelas(self):
        """INFORMACAO_PAGAMENTOS e janela rolante de ~2 meses.

        Medido: em 2026-07 ela guarda 1.015 linhas onde TB_PARCELAS guarda
        90.598. Usa-la para fechamento e o que faz o painel antigo desenhar uma
        queda de 99% que nunca aconteceu.
        """
        fechamento = corpo_da_cte(carga._MERGE_SNAPSHOT, "FECHAMENTO")
        self.assertIn("dbo.TB_PARCELAS", fechamento)
        self.assertNotIn("INFORMACAO_PAGAMENTOS", fechamento)

    def test_regua_de_valor_e_por_cedente_e_nao_por_carteira(self):
        """Espelha sql_arena_repository.py:764.

        A primeira versao disto guardava a regra na dimensao de carteira,
        marcando Mu e Pi. Errava duas vezes: deixava Zeta (71) e
        TETA Acme (77) de fora, e a dimensao agrupa por cliente, entao nem
        conseguia separar TETA Acme dos outros TETA. Reconciliado contra o
        banco: os cedentes 3, 60, 71 e 77 sao exatamente esses quatro.
        """
        for cte in ("FECHAMENTO", "VEGA"):
            trecho = corpo_da_cte(carga._MERGE_SNAPSHOT, cte)
            self.assertIn("ID_CEDENTE IN (3, 60, 71, 77)", trecho)

        # A dimensao nao pode voltar a opinar sobre isso.
        self.assertNotIn("REGRA_VALOR", carga._MERGE_SNAPSHOT)

    def test_vega_e_ancorado_em_data_pago(self):
        """O painel antigo soma VL_PAGO pela data do ACORDO, o que faz o numero
        de um dia passado nunca parar de mudar."""
        vega = corpo_da_cte(carga._MERGE_SNAPSHOT, "VEGA")
        self.assertIn("A.DATA_PAGO AS DIA", vega)
        self.assertIn("A.DATA_PAGO >= @DataIni", vega)

    def test_roster_e_deduplicado_por_nome(self):
        """O cadastro tem 3.102 CPFs para 3.094 nomes.

        Sem o ROW_NUMBER, o join da producao por nome multiplicaria a producao
        das pessoas homonimas.
        """
        self.assertIn("ROSTER AS (SELECT * FROM ROSTER_BRUTO WHERE RN = 1)",
                      carga._MERGE_SNAPSHOT)


class ContratoDoRepositorioTest(unittest.TestCase):
    def test_nao_usa_os_metodos_que_engolem_erro(self):
        """execute_fetch/execute_commit de SQLServerConnection capturam
        pyodbc.Error, imprimem e devolvem None. Num worker isso tornaria uma
        falha de carga indistinguivel de "nada mudou"."""
        import inspect

        fonte = inspect.getsource(carga.GestaoSnapshotRepository)
        self.assertNotIn("self.db.execute_fetch", fonte)
        self.assertNotIn("self.db.execute_commit", fonte)
        self.assertIn("self.db.begin_transaction()", fonte)


if __name__ == "__main__":
    unittest.main()
