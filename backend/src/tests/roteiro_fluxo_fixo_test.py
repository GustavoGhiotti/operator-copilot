"""Fluxos fixos: os que alimentam as abas do roteiro do operador.

Apagar ou renomear um deles deixa a aba em branco para todos os operadores, e
nada na tela avisava disso -- o botao de excluir era igual ao dos roteiros
comuns. A protecao mora no servidor porque a tela nao e a unica porta: o
endpoint aceita DELETE de qualquer lugar.
"""
import unittest
from unittest.mock import patch

from src.application.services.roteiro_service import (
    AtualizarFluxoService,
    CriarFluxoService,
    DefinirAbaRoteiroService,
    ExcluirFluxoService,
    ExcluirMensagemService,
    ListarAbasRoteiroService,
    ListarFluxosService,
    normalizar_nome_fluxo,
    rotulo_fluxo_fixo,
)


FLUXOS = [
    {
        "ID_FLUXO": "F2D0138C",
        "PRODUTO": "Tabulações",
        "TIPO_CLIENTE": "Tabulações",
        "TIPO_LIGACAO": "Tabulações",
    },
    {
        "ID_FLUXO": "61EBDDA3",
        "PRODUTO": "Situaçoes Adversas",
        "TIPO_CLIENTE": "Situaçoes Adversas",
        "TIPO_LIGACAO": "Situaçoes Adversas",
    },
    {
        "ID_FLUXO": "COMUM-01",
        "PRODUTO": "Habitacional",
        "TIPO_CLIENTE": "Juridica",
        "TIPO_LIGACAO": "Ligação Receptiva",
    },
]


class RepoFake:
    def __init__(self, abas=None, tem_tabela_aba=True):
        self.deletados = []
        self.atualizados = []
        self.abas = abas or []
        self.tem_tabela_aba = tem_tabela_aba
        self.vinculos = []

    def listar_fluxos(self, **_):
        return list(FLUXOS)

    def estrutura_aba_disponivel(self):
        return self.tem_tabela_aba

    def listar_abas(self):
        return list(self.abas)

    def definir_aba(self, aba, id_fluxo, atualizado_por):
        self.vinculos.append((aba, id_fluxo, atualizado_por))

    def deletar_fluxo(self, id_fluxo):
        self.deletados.append(id_fluxo)
        return 1

    def atualizar_fluxo(self, tipo_ligacao, tipo_cliente, produto, id_fluxo):
        self.atualizados.append((tipo_ligacao, tipo_cliente, produto, id_fluxo))
        return 1

    def fluxo_existe(self, _):
        return {"existe": 1}


def _com_repo(repo):
    return patch(
        "src.application.services.roteiro_service.RoteiroRepository",
        return_value=repo,
    )


class NormalizacaoTest(unittest.TestCase):
    def test_ignora_acento_vega_e_espaco_sobrando(self):
        self.assertEqual(
            normalizar_nome_fluxo("  Banco de Argumentação  "),
            "banco_de_argumentacao",
        )

    def test_reconhece_o_nome_cadastrado_e_o_nome_da_aba(self):
        """O banco guarda "Situaçoes Adversas"; a tela nasceu com o outro."""
        self.assertEqual(rotulo_fluxo_fixo("Situaçoes Adversas"), "Outras Situações")
        self.assertEqual(rotulo_fluxo_fixo("outras_situacoes"), "Outras Situações")

    def test_roteiro_comum_nao_e_fixo(self):
        self.assertIsNone(rotulo_fluxo_fixo("Habitacional", "Juridica", "Ativa"))


class ExclusaoTest(unittest.TestCase):
    def test_recusa_excluir_fluxo_fixo(self):
        repo = RepoFake()
        with _com_repo(repo):
            corpo, status = ExcluirFluxoService().executar("F2D0138C")

        self.assertEqual(status, 409)
        self.assertIn("Tabulações", corpo["erro"])
        self.assertEqual(repo.deletados, [], "nao pode chegar no banco")

    def test_recusa_mesmo_com_o_nome_do_cadastro(self):
        repo = RepoFake()
        with _com_repo(repo):
            _, status = ExcluirFluxoService().executar("61EBDDA3")

        self.assertEqual(status, 409)
        self.assertEqual(repo.deletados, [])

    def test_roteiro_comum_continua_excluivel(self):
        repo = RepoFake()
        with _com_repo(repo):
            resultado = ExcluirFluxoService().executar("COMUM-01")

        self.assertNotIsInstance(resultado, tuple, "nao deveria virar erro")
        self.assertEqual(repo.deletados, ["COMUM-01"])


class RenomeacaoTest(unittest.TestCase):
    """Renomear apaga a aba tao bem quanto excluir: ela acha pelo nome."""

    def test_recusa_renomear_para_fora_da_aba(self):
        repo = RepoFake()
        with _com_repo(repo):
            corpo, status = AtualizarFluxoService().executar(
                "F2D0138C",
                {"tipo_ligacao": "Outra", "tipo_cliente": "Outra", "produto": "Outra"},
            )

        self.assertEqual(status, 409)
        self.assertIn("Tabulações", corpo["erro"])
        self.assertEqual(repo.atualizados, [])

    def test_permite_trocar_entre_nomes_da_mesma_aba(self):
        """"Situaçoes Adversas" -> "Outras Situações" continua sendo a aba."""
        repo = RepoFake()
        with _com_repo(repo):
            resultado = AtualizarFluxoService().executar(
                "61EBDDA3",
                {
                    "tipo_ligacao": "Outras Situacoes",
                    "tipo_cliente": "Outras Situacoes",
                    "produto": "Outras Situacoes",
                },
            )

        self.assertNotIsInstance(resultado, tuple)
        self.assertEqual(len(repo.atualizados), 1)

    def test_roteiro_comum_continua_renomeavel(self):
        repo = RepoFake()
        with _com_repo(repo):
            resultado = AtualizarFluxoService().executar(
                "COMUM-01",
                {"tipo_ligacao": "Ativa", "tipo_cliente": "Fisica", "produto": "Consig"},
            )

        self.assertNotIsInstance(resultado, tuple)
        self.assertEqual(len(repo.atualizados), 1)


class NomeEmBrancoTest(unittest.TestCase):
    """Como nasceram os fluxos sem nome que apareceram no banco.

    As tres colunas sao NOT NULL, mas string vazia passa e nada validava. O
    fluxo resultante some dos combos (que filtram vazio), vira uma linha em
    branco na lista do builder e nenhuma aba consegue acha-lo -- mesmo tendo
    conteudo dentro. Foi o que aconteceu com o fluxo dos Canais de Atendimento.
    """

    def test_nao_cria_fluxo_com_nome_vazio(self):
        repo = RepoFake()
        repo.criados = []
        repo.criar_fluxo = lambda *a: repo.criados.append(a)

        with _com_repo(repo):
            corpo, status = CriarFluxoService().executar(
                {"tipo_ligacao": "", "tipo_cliente": "  ", "produto": ""}
            )

        self.assertEqual(status, 400)
        self.assertEqual(repo.criados, [])
        for termo in ("tipo de ligação", "tipo de cliente", "produto"):
            self.assertIn(termo, corpo["erro"])

    def test_nao_cria_com_apenas_um_campo_faltando(self):
        repo = RepoFake()
        repo.criados = []
        repo.criar_fluxo = lambda *a: repo.criados.append(a)

        with _com_repo(repo):
            _, status = CriarFluxoService().executar(
                {"tipo_ligacao": "Ativa", "tipo_cliente": "Fisica", "produto": ""}
            )

        self.assertEqual(status, 400)
        self.assertEqual(repo.criados, [])

    def test_nao_apaga_o_nome_de_um_fluxo_existente(self):
        """O autosave do builder reenvia os nomes a cada edicao de mensagem."""
        repo = RepoFake()
        with _com_repo(repo):
            _, status = AtualizarFluxoService().executar(
                "COMUM-01",
                {"tipo_ligacao": "", "tipo_cliente": "", "produto": ""},
            )

        self.assertEqual(status, 400)
        self.assertEqual(repo.atualizados, [], "nao pode chegar no banco")


class ListagemTest(unittest.TestCase):
    def test_marca_quais_sao_fixos_para_a_tela(self):
        repo = RepoFake()
        with _com_repo(repo):
            fluxos = ListarFluxosService().executar()

        por_id = {f["id_fluxo"]: f for f in fluxos}
        self.assertTrue(por_id["F2D0138C"]["fixo"])
        self.assertEqual(por_id["61EBDDA3"]["rotulo_fixo"], "Outras Situações")
        self.assertFalse(por_id["COMUM-01"]["fixo"])
        self.assertIsNone(por_id["COMUM-01"]["rotulo_fixo"])


class ExclusaoDeMensagemTest(unittest.TestCase):
    """A FK cuida das opcoes DA mensagem; o destino e por conta do codigo.

    TB_OPCAO aponta para TB_MENSAGEM por dois caminhos e o SQL Server so aceita
    ON DELETE em um deles. Sem soltar as referencias antes, apagar uma mensagem
    do meio do fluxo deixaria botoes apontando para o vazio.
    """

    def test_solta_as_referencias_antes_de_apagar(self):
        repo = RepoFake()
        ordem = []
        repo.soltar_referencias_para_mensagem = lambda i: ordem.append(("soltar", i))
        repo.deletar_mensagem = lambda i: (ordem.append(("apagar", i)), 1)[1]

        with _com_repo(repo):
            resultado = ExcluirMensagemService().executar("MSG-1")

        self.assertNotIsInstance(resultado, tuple)
        self.assertEqual(ordem, [("soltar", "MSG-1"), ("apagar", "MSG-1")])

    def test_mensagem_inexistente_ainda_devolve_404(self):
        repo = RepoFake()
        repo.soltar_referencias_para_mensagem = lambda i: 0
        repo.deletar_mensagem = lambda i: 0

        with _com_repo(repo):
            _, status = ExcluirMensagemService().executar("MSG-SUMIU")

        self.assertEqual(status, 404)


class NomeUnicoTest(unittest.TestCase):
    """O trio produto + cliente + ligacao e o que o operador escolhe.

    Repetido, dois roteiros viram a mesma opcao no filtro e nao ha como saber
    qual abre. Aconteceu de verdade: tres fluxos distintos -- incluindo o das
    Outras Situacoes -- ficaram todos como "Habitacional / Fisica / Ativa".
    """

    def test_nao_cria_com_trio_ja_usado(self):
        repo = RepoFake()
        repo.criados = []
        repo.criar_fluxo = lambda *a: repo.criados.append(a)

        with _com_repo(repo):
            corpo, status = CriarFluxoService().executar(
                {
                    "tipo_ligacao": "Ligação Receptiva",
                    "tipo_cliente": "Juridica",
                    "produto": "Habitacional",
                }
            )

        self.assertEqual(status, 409)
        self.assertIn("Habitacional", corpo["erro"])
        self.assertEqual(repo.criados, [])

    def test_compara_ignorando_acento_e_vega(self):
        repo = RepoFake()
        repo.criados = []
        repo.criar_fluxo = lambda *a: repo.criados.append(a)

        with _com_repo(repo):
            _, status = CriarFluxoService().executar(
                {
                    "tipo_ligacao": "  ligacao   RECEPTIVA ",
                    "tipo_cliente": "JURÍDICA",
                    "produto": "habitacional",
                }
            )

        self.assertEqual(status, 409)

    def test_permite_trio_novo(self):
        repo = RepoFake()
        repo.criados = []
        repo.criar_fluxo = lambda *a: repo.criados.append(a)
        repo.criar_mensagem = lambda *a: None

        with _com_repo(repo):
            resultado = CriarFluxoService().executar(
                {
                    "tipo_ligacao": "Ativa",
                    "tipo_cliente": "Fisica",
                    "produto": "Consignado",
                }
            )

        self.assertNotIsInstance(resultado, tuple)
        self.assertEqual(len(repo.criados), 1)

    def test_nao_deixa_renomear_por_cima_de_outro(self):
        repo = RepoFake()
        with _com_repo(repo):
            _, status = AtualizarFluxoService().executar(
                "COMUM-01",
                {
                    "tipo_ligacao": "Tabulações",
                    "tipo_cliente": "Tabulações",
                    "produto": "Tabulações",
                },
            )

        self.assertEqual(status, 409)
        self.assertEqual(repo.atualizados, [])

    def test_salvar_sem_mudar_o_nome_continua_passando(self):
        """Senao o autosave travaria justo nos fluxos que ja estao repetidos."""
        repo = RepoFake()
        with _com_repo(repo):
            resultado = AtualizarFluxoService().executar(
                "COMUM-01",
                {
                    "tipo_ligacao": "Ligação Receptiva",
                    "tipo_cliente": "Juridica",
                    "produto": "Habitacional",
                },
            )

        self.assertNotIsInstance(resultado, tuple)
        self.assertEqual(len(repo.atualizados), 1)


class AbasDoRoteiroTest(unittest.TestCase):
    """Qual fluxo alimenta cada aba.

    O vinculo explicito existe porque a deducao pelo nome falhava calada: a aba
    de Canais apontava para o nada enquanto o conteudo dela vivia num fluxo sem
    nome, que nome nenhum jamais alcançaria.
    """

    def _abas(self, repo):
        with _com_repo(repo):
            return {item["aba"]: item for item in ListarAbasRoteiroService().executar()}

    def test_sem_vinculo_cai_no_nome_como_antes(self):
        abas = self._abas(RepoFake(abas=[]))

        self.assertEqual(abas["tabulacoes"]["id_fluxo"], "F2D0138C")
        self.assertEqual(abas["tabulacoes"]["origem"], "nome")
        self.assertEqual(abas["outras_situacoes"]["id_fluxo"], "61EBDDA3")

    def test_aba_sem_fluxo_nenhum_e_declarada(self):
        abas = self._abas(RepoFake(abas=[]))

        self.assertIsNone(abas["canais_de_atendimento"]["id_fluxo"])
        self.assertEqual(abas["canais_de_atendimento"]["origem"], "sem-fluxo")

    def test_vinculo_vence_a_deducao_por_nome(self):
        """O ponto do recurso: apontar a aba para um fluxo de outro nome."""
        repo = RepoFake(abas=[{"ABA": "canais_de_atendimento", "ID_FLUXO": "COMUM-01"}])

        abas = self._abas(repo)

        self.assertEqual(abas["canais_de_atendimento"]["id_fluxo"], "COMUM-01")
        self.assertEqual(abas["canais_de_atendimento"]["origem"], "vinculo")

    def test_vinculo_para_fluxo_apagado_volta_para_o_nome(self):
        repo = RepoFake(abas=[{"ABA": "tabulacoes", "ID_FLUXO": "JA-NAO-EXISTE"}])

        abas = self._abas(repo)

        self.assertEqual(abas["tabulacoes"]["id_fluxo"], "F2D0138C")
        self.assertEqual(abas["tabulacoes"]["origem"], "nome")

    def test_sem_a_tabela_tudo_funciona_pelo_nome(self):
        abas = self._abas(RepoFake(abas=[], tem_tabela_aba=False))

        self.assertEqual(abas["tabulacoes"]["id_fluxo"], "F2D0138C")
        self.assertFalse(abas["tabulacoes"]["editavel"])

    def test_recusa_aba_desconhecida(self):
        repo = RepoFake()
        with _com_repo(repo):
            _, status = DefinirAbaRoteiroService().executar("inventada", "COMUM-01")

        self.assertEqual(status, 400)
        self.assertEqual(repo.vinculos, [])

    def test_recusa_vincular_sem_a_tabela(self):
        repo = RepoFake(tem_tabela_aba=False)
        with _com_repo(repo):
            corpo, status = DefinirAbaRoteiroService().executar(
                "tabulacoes", "COMUM-01"
            )

        self.assertEqual(status, 409)
        self.assertIn("roteiro_abas.sql", corpo["erro"])
        self.assertEqual(repo.vinculos, [])

    def test_desvincular_grava_nulo(self):
        repo = RepoFake()
        with _com_repo(repo):
            resultado = DefinirAbaRoteiroService().executar("tabulacoes", "")

        self.assertNotIsInstance(resultado, tuple)
        self.assertEqual(repo.vinculos, [("tabulacoes", None, "")])


if __name__ == "__main__":
    unittest.main()
