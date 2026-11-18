"""Quem alcanca cada area do sistema.

O caso que originou isto: a visao da gerencia era liberada por
CENTRO_CUSTO = 'GERENCIA OPERACIONAL' em seis arquivos diferentes. O gerente de
TI e o especialista de recuperacao respondem pela mesma visao e nao estao
lotados naquele centro -- ficavam de fora, e incluir cada um exigia editar
codigo em varios pontos. A concessao virou linha em TB_PERMISSAO_VISAO.

Estes testes travam as tres armadilhas que fariam a tabela conceder errado em
silencio: o valor truncado no cadastro, o padding, e o prefixo escapando para
onde nao devia.
"""
import unittest

from src.application.services.permissao_service import (
    PermissaoError,
    PermissaoService,
)
from src.tests.permissao_seed_fake import (
    CONCESSOES_SEED,
    PermissaoRepositoryFake,
)


def _servico(**kwargs):
    repo = PermissaoRepositoryFake(**kwargs)
    return PermissaoService(repo=repo), repo


class AreasDaGerenciaTest(unittest.TestCase):
    PACOTE = {
        "gerencia.gestao",
        "gerencia.resultados",
        "arena.observatorio",
        "senhas.reset",
        # Era uma regra negativa no frontend que barrava justamente a
        # Gerencia Operacional: quem cobra o resultado do operador nao
        # alcancava a meta (@Ideal) nem a auditoria.
        "supervisao.operacao",
        # Era CENTRO_CUSTO in (QUALIDADE, PLANEJAMENTO): quem responde pelo
        # resultado nao via a leitura que a IA faz da propria operacao.
        "aurora.insight",
    }

    def _areas(self, funcao, centro_custo="COBRANCA GAMA"):
        servico, _ = _servico()
        return servico.areas_para(funcao=funcao, centro_custo=centro_custo)

    def test_gerente_de_operacoes_recebe_o_pacote(self):
        self.assertTrue(self.PACOTE.issubset(self._areas("GERENTE DE OPERACOES")))

    def test_gerente_de_operacoes_sr_recebe_pelo_prefixo(self):
        """A concessao guarda 'GERENTE DE OPERACOES'; SR e JR vem pelo prefixo.

        Gravar as tres seria ruido na tela de acessos, e igualdade reprovaria
        quem tem o nivel junto do cargo.
        """
        self.assertTrue(
            self.PACOTE.issubset(self._areas("GERENTE DE OPERACOES SR"))
        )
        self.assertTrue(
            self.PACOTE.issubset(self._areas("GERENTE DE OPERACOES JR"))
        )

    def test_gerente_de_ti_recebe_fora_do_centro_de_custo_da_gerencia(self):
        """O que a regra antiga nao alcancava: centro de custo 'TI'."""
        self.assertTrue(
            self.PACOTE.issubset(self._areas("GERENTE DE TI", centro_custo="TI"))
        )

    def test_especialista_de_recuperacao_com_valor_truncado(self):
        """O cadastro guarda 'ESPECIALISTA DE RECUPERACAO DE' — truncado.

        Igualdade reprovaria essa pessoa sem erro nenhum aparecer na tela.
        """
        self.assertTrue(
            self.PACOTE.issubset(
                self._areas("ESPECIALISTA DE RECUPERACAO DE")
            )
        )

    def test_padding_do_cadastro_nao_atrapalha(self):
        """FUNCAO_COLABORADOR vem com espacos a direita direto do banco."""
        self.assertTrue(
            self.PACOTE.issubset(
                self._areas("GERENTE DE OPERACOES          ")
            )
        )


class CompatibilidadeComOAcessoAtualTest(unittest.TestCase):
    def test_gerencia_operacional_mantem_o_que_tinha(self):
        servico, _ = _servico()

        areas = servico.areas_para(
            funcao="ASSISTENTE DE COORDENACAO",
            centro_custo="GERENCIA OPERACIONAL",
        )

        self.assertIn("gerencia.gestao", areas)
        self.assertIn("gerencia.resultados", areas)
        self.assertIn("arena.observatorio", areas)
        self.assertIn("senhas.reset", areas)

    def test_centro_de_custo_com_acento_e_reconhecido(self):
        servico, _ = _servico()

        areas = servico.areas_para(
            funcao="ANALISTA",
            centro_custo="Gerência Operacional",
        )

        self.assertIn("gerencia.gestao", areas)

    def test_desenvolvimento_mantem_observatorio_e_ganha_acessos(self):
        servico, _ = _servico()

        areas = servico.areas_para(
            funcao="ANALISTA DE DESENVOLVIMENTO PL",
            centro_custo="DESENVOLVIMENTO",
        )

        self.assertIn("arena.observatorio", areas)
        self.assertIn("acessos.gerenciar", areas)

    def test_qualidade_e_planejamento_mantem_o_aurora_insight(self):
        """Quem ja tinha o comando nao pode perder por causa da area nova."""
        servico, _ = _servico()

        for centro in ("QUALIDADE", "PLANEJAMENTO"):
            areas = servico.areas_para(funcao="ANALISTA", centro_custo=centro)
            self.assertIn("aurora.insight", areas, centro)

    def test_supervisor_mantem_a_criacao_de_campanhas(self):
        servico, _ = _servico()

        areas = servico.areas_para(
            funcao="SUPERVISOR(A) DE OPERACOES I",
            centro_custo="COBRANCA GAMA",
        )

        self.assertIn("arena.supervisor", areas)


class QuemContinuaDeForaTest(unittest.TestCase):
    def test_operador_nao_alcanca_nenhuma_area(self):
        servico, _ = _servico()

        areas = servico.areas_para(
            funcao="OPERADOR(A) COBRADOR(A)",
            centro_custo="COBRANCA GAMA",
        )

        self.assertEqual(areas, set())

    def test_gerente_nao_cria_campanha_na_arena(self):
        """Alcance e controle sao eixos diferentes: a gerencia so acompanha."""
        servico, _ = _servico()

        areas = servico.areas_para(
            funcao="GERENTE DE TI",
            centro_custo="TI",
        )

        self.assertIn("arena.observatorio", areas)
        self.assertNotIn("arena.supervisor", areas)

    def test_supervisor_nao_recebe_a_area_de_supervisao(self):
        """Parece contraintuitivo, e nao e.

        'supervisao.operacao' existe so para desfazer a regra negativa que
        barrava a gerencia. O supervisor nunca esteve entre os barrados: ele
        alcanca @Ideal e @Auditoria pelo caminho antigo, que segue valendo.
        Conceder aqui tambem criaria duas fontes para a mesma resposta.
        """
        servico, _ = _servico()

        areas = servico.areas_para(
            funcao="SUPERVISOR(A) DE OPERACOES",
            centro_custo="COBRANCA GAMA",
        )

        self.assertNotIn("supervisao.operacao", areas)

    def test_gerente_de_ti_nao_administra_acessos(self):
        servico, _ = _servico()

        areas = servico.areas_para(funcao="GERENTE DE TI", centro_custo="TI")

        self.assertNotIn("acessos.gerenciar", areas)

    def test_centro_de_custo_nao_casa_por_prefixo(self):
        """'TI' concede senhas.reset; 'TI SUPORTE' e outro centro.

        Prefixo em centro de custo faria uma concessao vazar para todo centro
        que comecasse com as mesmas letras.
        """
        servico, _ = _servico()

        areas = servico.areas_para(funcao="ANALISTA", centro_custo="TI SUPORTE")

        self.assertEqual(areas, set())

    def test_funcao_em_branco_nao_vira_permissao(self):
        """Uma lacuna no cadastro nao deve conceder nada."""
        servico, _ = _servico()

        areas = servico.areas_para(funcao="", centro_custo="")

        self.assertEqual(areas, set())

    def test_concessao_inativa_nao_concede(self):
        """O repositorio so devolve ativas; revogar tem que tirar o acesso.

        O centro de custo aqui e 'COBRANCA GAMA' e nao 'TI' de proposito: 'TI'
        esta no pacote legado do @Senhas e concederia senhas.reset por outro
        caminho, escondendo a revogacao que este teste quer provar.
        """
        ativas = [
            item for item in CONCESSOES_SEED
            if not (item[0] == "FUNCAO" and item[1] == "GERENTE DE TI")
        ]
        servico, _ = _servico(concessoes=ativas)

        areas = servico.areas_para(
            funcao="GERENTE DE TI",
            centro_custo="COBRANCA GAMA",
        )

        self.assertEqual(areas, set())


class ConcessaoPorCpfTest(unittest.TestCase):
    def test_cpf_concede_sem_mexer_na_funcao_da_pessoa(self):
        servico, _ = _servico(
            concessoes=CONCESSOES_SEED + [("CPF", "12345678900", "gerencia.gestao")]
        )

        areas = servico.areas_para(
            funcao="OPERADOR(A) COBRADOR(A)",
            centro_custo="COBRANCA GAMA",
            cpf="12345678900",
        )

        self.assertEqual(areas, {"gerencia.gestao"})

    def test_cpf_de_outra_pessoa_nao_concede(self):
        servico, _ = _servico(
            concessoes=CONCESSOES_SEED + [("CPF", "12345678900", "gerencia.gestao")]
        )

        areas = servico.areas_para(
            funcao="OPERADOR(A) COBRADOR(A)",
            centro_custo="COBRANCA GAMA",
            cpf="99999999999",
        )

        self.assertEqual(areas, set())


class MigracaoAindaNaoAplicadaTest(unittest.TestCase):
    """Sem a tabela, vale a regra antiga -- e nao 'ninguem tem acesso'.

    O deploy do codigo e a aplicacao da migration sao dois passos manuais e
    separados neste projeto. Tratar a ausencia da tabela como resposta tiraria
    o acesso da empresa inteira no intervalo entre os dois.
    """

    def test_gerencia_operacional_continua_entrando(self):
        servico, _ = _servico(estrutura_ausente=True)

        areas = servico.areas_para(
            funcao="ASSISTENTE DE COORDENACAO",
            centro_custo="GERENCIA OPERACIONAL",
        )

        self.assertIn("gerencia.gestao", areas)
        self.assertIn("arena.observatorio", areas)

    def test_supervisor_continua_criando_campanha(self):
        servico, _ = _servico(estrutura_ausente=True)

        areas = servico.areas_para(
            funcao="SUPERVISOR(A) DE OPERACOES",
            centro_custo="COBRANCA GAMA",
        )

        self.assertIn("arena.supervisor", areas)
        self.assertIn("senhas.reset", areas)

    def test_gerente_de_ti_ainda_nao_entra(self):
        """A migration e que entrega isto; antes dela, nao existe."""
        servico, _ = _servico(estrutura_ausente=True)

        areas = servico.areas_para(funcao="GERENTE DE TI", centro_custo="TI")

        self.assertNotIn("gerencia.gestao", areas)

    def test_operador_continua_de_fora(self):
        servico, _ = _servico(estrutura_ausente=True)

        areas = servico.areas_para(
            funcao="OPERADOR(A) COBRADOR(A)",
            centro_custo="COBRANCA GAMA",
        )

        self.assertEqual(areas, set())


class ExigirTest(unittest.TestCase):
    def test_exigir_levanta_403_para_quem_nao_tem(self):
        servico, _ = _servico()
        servico._usuario = lambda cpf: {
            "FUNCAO_COLABORADOR": "OPERADOR(A) COBRADOR(A)",
            "CENTRO_CUSTO": "COBRANCA GAMA",
            "CPF_COLABORADOR": "123",
        }

        with self.assertRaises(PermissaoError) as caso:
            servico.exigir("123", "senhas.reset")

        self.assertEqual(caso.exception.status, 403)

    def test_exigir_passa_para_quem_tem(self):
        servico, _ = _servico()
        servico._usuario = lambda cpf: {
            "FUNCAO_COLABORADOR": "GERENTE DE TI",
            "CENTRO_CUSTO": "TI",
            "CPF_COLABORADOR": "123",
        }

        servico.exigir("123", "senhas.reset")

    def test_repositorio_injetado_nao_usa_o_cache_global(self):
        """O cache e de modulo: dois cenarios seguidos leriam o mesmo dado."""
        servico, repo = _servico()

        servico.areas_para(funcao="GERENTE DE TI", centro_custo="TI")
        servico.areas_para(funcao="GERENTE DE TI", centro_custo="TI")

        self.assertEqual(repo.leituras, 2)


if __name__ == "__main__":
    unittest.main()
