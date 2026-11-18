"""Visao de acesso atribuida por pessoa.

O caso que originou isto: Josielho, GERENTE DE TI no centro de custo TI. Dar a
ele a visao de gerencia exigia inserir cinco concessoes por funcao, e cada
excecao futura repetia o exercicio. Agora e uma linha: CPF -> visao.

A regra mais importante destes testes nao e o que a visao concede, e o que ela
NAO toca: quem nao tem visao atribuida tem de continuar exatamente como estava,
porque e assim que os 3.000 operadores seguem funcionando sem cadastro nenhum.
"""
import unittest

from src.application.services.permissao_service import (
    PermissaoError,
    PermissaoService,
)
from src.tests.permissao_seed_fake import (
    PERFIS_SEED,
    PermissaoRepositoryFake,
    permissoes_do_seed,
)


OPERADOR = {
    "CPF": "111", "NOME": "MARIA DA SILVA",
    "CENTRO_CUSTO": "COBRANCA GAMA", "FUNCAO": "OPERADOR(A) COBRADOR(A)",
}
SUPERVISOR = {
    "CPF": "222", "NOME": "BEATRIZ LIMA",
    "CENTRO_CUSTO": "COBRANCA GAMA", "FUNCAO": "SUPERVISOR(A) DE OPERACOES I",
}
GERENTE_TI = {
    "CPF": "333", "NOME": "JOSIELHO DELFINO DE MORAIS",
    "CENTRO_CUSTO": "TI", "FUNCAO": "GERENTE DE TI",
}
ANALISTA_QUALIDADE = {
    "CPF": "444", "NOME": "ANA MONITORA",
    "CENTRO_CUSTO": "QUALIDADE", "FUNCAO": "MONITOR DE TELEATENDIMENTO",
}

PESSOAS = [OPERADOR, SUPERVISOR, GERENTE_TI, ANALISTA_QUALIDADE]


def _servico(**kwargs):
    repo = PermissaoRepositoryFake(pessoas=PESSOAS, **kwargs)
    return PermissaoService(repo=repo), repo


def _areas(servico, pessoa):
    return servico.areas_para(
        funcao=pessoa["FUNCAO"],
        centro_custo=pessoa["CENTRO_CUSTO"],
        cpf=pessoa["CPF"],
    )


class SemVisaoAtribuidaTest(unittest.TestCase):
    """O teste que protege os operadores.

    Ninguem foi cadastrado, entao tudo tem de resolver pelo padrao do cargo --
    byte a byte o comportamento anterior a esta mudanca.
    """

    def test_operador_continua_sem_nada(self):
        servico, _ = _servico()

        self.assertEqual(_areas(servico, OPERADOR), set())

    def test_supervisor_continua_com_o_que_o_cargo_da(self):
        servico, _ = _servico()

        areas = _areas(servico, SUPERVISOR)

        self.assertIn("arena.supervisor", areas)
        self.assertIn("senhas.reset", areas)

    def test_gerente_de_ti_ja_alcanca_a_gerencia_pelo_cargo(self):
        """A migration 019 ja resolvia o Josielho -- so nao tinha sido publicada."""
        servico, _ = _servico()

        areas = _areas(servico, GERENTE_TI)

        self.assertIn("gerencia.gestao", areas)
        self.assertIn("gerencia.resultados", areas)

    def test_qualidade_mantem_os_comandos_de_avaliacao(self):
        """Regressao da decisao de deixar 'qualidade.avaliacao' fora do pacote.

        Quem esta no centro de custo QUALIDADE e nao recebeu visao atribuida
        continua alcancando pela regra legada do frontend. O pacote nao tira
        nada de ninguem sozinho.
        """
        servico, _ = _servico()

        areas = _areas(servico, ANALISTA_QUALIDADE)

        self.assertIn("aurora.insight", areas)
        self.assertIn("senhas.reset", areas)


class VisaoSubstituiTest(unittest.TestCase):
    def test_gerencia_entrega_o_pacote(self):
        servico, _ = _servico(atribuicoes={"333": "gerencia"})

        self.assertEqual(_areas(servico, GERENTE_TI), set(PERFIS_SEED["gerencia"]))

    def test_visao_substitui_e_nao_soma_ao_cargo(self):
        """O gerente de TI alcanca arena.observatorio pelo cargo.

        Com a visao Gerencia atribuida, ele passa a ter exatamente o pacote --
        e o observatorio sai. Somar em vez de substituir tornaria impossivel
        saber o que a pessoa ve olhando a tela.
        """
        servico, _ = _servico()
        self.assertIn("arena.observatorio", _areas(servico, GERENTE_TI))

        servico, _ = _servico(atribuicoes={"333": "gerencia"})
        self.assertNotIn("arena.observatorio", _areas(servico, GERENTE_TI))

    def test_visao_operador_reduz_um_supervisor(self):
        """E para isto que a visao Operador existe: tirar acesso pela tela."""
        servico, _ = _servico(atribuicoes={"222": "operador"})

        self.assertEqual(_areas(servico, SUPERVISOR), set())

    def test_desenvolvimento_recebe_tudo(self):
        servico, _ = _servico(atribuicoes={"333": "desenvolvimento"})

        areas = _areas(servico, GERENTE_TI)

        self.assertIn("acessos.gerenciar", areas)
        self.assertIn("qualidade.avaliacao", areas)

    def test_visao_de_um_nao_vaza_para_outro(self):
        servico, _ = _servico(atribuicoes={"333": "desenvolvimento"})

        self.assertEqual(_areas(servico, OPERADOR), set())

    def test_perfil_inexistente_nao_concede_nada(self):
        """Perfil apagado ou inativo nao pode virar 'acesso total' por engano."""
        servico, _ = _servico(atribuicoes={"333": "perfil_que_nao_existe"})

        self.assertEqual(_areas(servico, GERENTE_TI), set())

    def test_sem_a_migration_025_vale_o_padrao_do_cargo(self):
        """Entre o deploy e a migration, ninguem pode ficar sem acesso."""
        servico, _ = _servico(
            perfis_ausentes=True, atribuicoes={"333": "gerencia"}
        )

        self.assertIn("gerencia.gestao", _areas(servico, GERENTE_TI))
        self.assertIn("arena.observatorio", _areas(servico, GERENTE_TI))


class AjusteIndividualTest(unittest.TestCase):
    def test_ajuste_remove_uma_area_do_pacote(self):
        """'Gerencia, mas sem @Senhas'."""
        servico, _ = _servico(
            atribuicoes={"333": "gerencia"},
            ajustes={"333": {"senhas.reset": False}},
        )

        areas = _areas(servico, GERENTE_TI)

        self.assertNotIn("senhas.reset", areas)
        self.assertIn("gerencia.gestao", areas)

    def test_ajuste_acrescenta_area_fora_do_pacote(self):
        """'Qualidade, e tambem os quizes' -- o caso de qualidade.avaliacao."""
        servico, _ = _servico(
            atribuicoes={"444": "qualidade"},
            ajustes={"444": {"qualidade.avaliacao": True}},
        )

        self.assertIn("qualidade.avaliacao", _areas(servico, ANALISTA_QUALIDADE))

    def test_ajuste_vale_tambem_sem_visao_atribuida(self):
        """Excecao pontual sem precisar dar um pacote inteiro a pessoa."""
        servico, _ = _servico(ajustes={"111": {"aurora.insight": True}})

        self.assertEqual(_areas(servico, OPERADOR), {"aurora.insight"})


class AreasNegadasTest(unittest.TestCase):
    """A negacao explicita, que a tela precisa enxergar.

    `areas_do_usuario` devolve so o que a pessoa tem, e a ausencia nao diz se
    ela nunca teve ou se foi tirada. O frontend precisa da diferenca porque
    guarda regras legadas no formato `centro de custo OU area`: sem saber da
    negacao, ele reacende o comando que o gestor acabou de remover.
    """

    def test_negacao_aparece_na_lista(self):
        servico, _ = _servico(
            atribuicoes={"333": "gerencia"},
            ajustes={"333": {"senhas.reset": False}},
        )

        self.assertEqual(servico.areas_negadas("333"), {"senhas.reset"})

    def test_concessao_nao_entra_como_negacao(self):
        servico, _ = _servico(ajustes={"111": {"aurora.insight": True}})

        self.assertEqual(servico.areas_negadas("111"), set())

    def test_sem_ajuste_nenhum_nao_nega_nada(self):
        servico, _ = _servico()

        self.assertEqual(servico.areas_negadas("222"), set())

    def test_negacao_de_area_que_vinha_do_cargo(self):
        """O caso que a tela nao conseguia resolver.

        O supervisor recebe 'arena.supervisor' pela funcao, nao por visao.
        Negar tem de tirar -- e a negacao tem de ficar visivel, senao o
        frontend a reacende pela regra de funcao.
        """
        servico, _ = _servico(ajustes={"222": {"arena.supervisor": False}})

        self.assertNotIn("arena.supervisor", _areas(servico, SUPERVISOR))
        self.assertEqual(servico.areas_negadas("222"), {"arena.supervisor"})


class AdministracaoTest(unittest.TestCase):
    def test_definir_visao_registra_e_devolve_a_pessoa(self):
        servico, repo = _servico()

        pessoa = servico.definir_perfil("333", "gerencia", "999")

        self.assertEqual(repo.atribuicoes["333"], "gerencia")
        self.assertEqual(pessoa["perfil"], "gerencia")
        self.assertEqual(pessoa["origem"], "PERFIL")
        self.assertIn("gerencia.gestao", pessoa["areas"])

    def test_visao_desconhecida_e_recusada(self):
        servico, _ = _servico()

        with self.assertRaises(PermissaoError) as caso:
            servico.definir_perfil("333", "chefao", "999")

        self.assertEqual(caso.exception.status, 400)

    def test_cpf_inexistente_e_recusado(self):
        servico, _ = _servico()

        with self.assertRaises(PermissaoError) as caso:
            servico.definir_perfil("000", "gerencia", "999")

        self.assertEqual(caso.exception.status, 404)

    def test_remover_visao_devolve_ao_padrao_do_cargo(self):
        servico, repo = _servico(atribuicoes={"333": "operador"})
        self.assertEqual(_areas(servico, GERENTE_TI), set())

        pessoa = servico.remover_perfil("333")

        self.assertNotIn("333", repo.atribuicoes)
        self.assertEqual(pessoa["origem"], "PADRAO")
        self.assertIn("gerencia.gestao", pessoa["areas"])

    def test_remover_visao_limpa_os_ajustes(self):
        """Ajuste feito sobre uma visao que deixou de existir para a pessoa
        alteraria o padrao do cargo por uma decisao que ninguem lembra."""
        servico, repo = _servico(
            atribuicoes={"333": "gerencia"},
            ajustes={"333": {"senhas.reset": False}},
        )

        servico.remover_perfil("333")

        self.assertNotIn("333", repo.ajustes)
        self.assertIn("senhas.reset", _areas(servico, GERENTE_TI))

    def test_ajuste_sem_valor_apaga_a_excecao(self):
        servico, repo = _servico(
            atribuicoes={"333": "gerencia"},
            ajustes={"333": {"senhas.reset": False}},
        )

        servico.definir_ajuste("333", "senhas.reset", None, "999")

        self.assertEqual(repo.ajustes["333"], {})
        self.assertIn("senhas.reset", _areas(servico, GERENTE_TI))

    def test_ajuste_em_area_desconhecida_e_recusado(self):
        servico, _ = _servico()

        with self.assertRaises(PermissaoError) as caso:
            servico.definir_ajuste("333", "area.inventada", True, "999")

        self.assertEqual(caso.exception.status, 400)

    def test_listagem_marca_a_origem_da_visao(self):
        """Sem essa marca, remover a visao de alguem parece nao ter efeito."""
        servico, _ = _servico(atribuicoes={"333": "gerencia"})

        por_cpf = {p["cpf"]: p for p in servico.listar_pessoas({})["pessoas"]}

        self.assertEqual(por_cpf["333"]["origem"], "PERFIL")
        self.assertEqual(por_cpf["222"]["origem"], "PADRAO")

    def test_busca_ignora_o_recorte_de_quem_ja_tem_visao(self):
        """E a busca que alcanca alguem novo, fora da lista curta."""
        servico, _ = _servico()

        resultado = servico.listar_pessoas({"busca": "maria"})

        self.assertFalse(resultado["somente_com_visao"])

    def test_pacote_da_gerencia_e_o_combinado(self):
        servico, _ = _servico()

        perfis = {p["codigo"]: set(p["areas"]) for p in servico.listar_perfis()}

        self.assertEqual(perfis["gerencia"], {
            "senhas.reset", "gerencia.gestao",
            "gerencia.resultados", "aurora.insight",
        })
        self.assertEqual(perfis["operador"], set())


if __name__ == "__main__":
    unittest.main()
