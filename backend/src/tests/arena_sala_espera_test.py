"""Regras da sala de espera: iniciar antes do prazo, incluir gente e fechar.

Em unittest, e nao no estilo do `arena_service_test.py` vizinho: aquele arquivo
usa funcoes soltas do pytest, que nao esta instalado — os 24 testes de la nunca
executam no `unittest discover`. Estes rodam.
"""
import unittest

from src.application.services.arena_service import (
    ArenaServiceError,
    ArenaSupervisorService,
)


class SalaEsperaRepositoryFake:
    def __init__(self, status_sessao="AGUARDANDO", presentes=1,
                 status_campanha="FINALIZADA"):
        self.status_sessao = status_sessao
        self.status_campanha = status_campanha
        self.presentes = presentes
        self.adicionados = []
        self.fechadas = []
        self.iniciadas = []
        self.arquivadas = []
        self.desarquivadas = []
        self.listagens = []

    # --- usuario -------------------------------------------------------
    def obter_usuario(self, cpf):
        return {
            "cpf": cpf,
            "nome": "BEATRIZ LIMA SANTOS",
            # Com sufixo de nivel de proposito: e o formato real do banco.
            "funcao": "SUPERVISOR(A) DE OPERACOES I",
            "centro_custo": "VEGA",
        }

    # --- resolucao de publico -----------------------------------------
    def listar_operadores_por_centros(self, centros):
        if not centros:
            return []
        return [{"cpf": "111", "nome": "Do Centro", "centro_custo": "VEGA"}]

    def listar_operadores_por_cpfs(self, cpfs):
        return [
            {"cpf": c, "nome": f"Operador {c}", "centro_custo": "VEGA"}
            for c in cpfs
        ]

    # --- operacoes da sala --------------------------------------------
    def iniciar_sessao(self, id_sessao, cpf):
        if self.status_sessao != "AGUARDANDO":
            raise ValueError("SESSAO_JA_INICIADA")
        if not self.presentes:
            raise ValueError("SALA_VAZIA")
        self.iniciadas.append(id_sessao)
        return 42

    def adicionar_participantes(self, id_sessao, cpf, participantes):
        if self.status_sessao != "AGUARDANDO":
            raise ValueError("SESSAO_JA_INICIADA")
        self.adicionados.append((id_sessao, participantes))
        return len(participantes)

    def fechar_sala(self, id_sessao, cpf):
        if self.status_sessao != "AGUARDANDO":
            raise ValueError("SESSAO_JA_INICIADA")
        self.fechadas.append(id_sessao)
        return 42

    def arquivar_campanha(self, id_campanha, cpf):
        if self.status_campanha == "ARQUIVADA":
            raise ValueError("CAMPANHA_JA_ARQUIVADA")
        if self.status_campanha in ("SALA_ABERTA", "EM_ANDAMENTO"):
            raise ValueError("CAMPANHA_EM_JOGO")
        self.arquivadas.append(id_campanha)
        return self.status_campanha

    def desarquivar_campanha(self, id_campanha, cpf):
        if self.status_campanha != "ARQUIVADA":
            raise ValueError("CAMPANHA_NAO_ARQUIVADA")
        self.desarquivadas.append(id_campanha)
        return "FINALIZADA"

    def listar_campanhas_supervisor(self, cpf, incluir_arquivadas=False):
        self.listagens.append(incluir_arquivadas)
        return []

    # --- estado devolvido apos as operacoes ----------------------------
    def obter_acesso_sessao(self, id_sessao, cpf, observador=False):
        return {
            "id": id_sessao,
            "id_campanha": 42,
            "status": self.status_sessao,
            "cpf_criador": "123",
            "id_participante": None,
            "status_participante": None,
            # 0 porque a janela ainda esta aberta: o inicio preguicoso de
            # `obter_estado_sessao` nao deve disparar durante estes testes,
            # senao mascara o que estamos medindo.
            "pode_iniciar": 0,
            "supervisor": 1,
        }

    def obter_estado_sessao(self, id_sessao):
        return {
            "id": id_sessao,
            "id_campanha": 42,
            "titulo": "Bingo da equipe",
            "status": self.status_sessao,
            "tipo_jogo": "BINGO",
            "entrada_aberta": True,
            "participantes": [],
        }


class SalaEsperaTest(unittest.TestCase):
    def _servico(self, **kwargs):
        servico = ArenaSupervisorService()
        servico.repo = SalaEsperaRepositoryFake(**kwargs)
        return servico, servico.repo

    # --- iniciar antes do prazo ---------------------------------------
    def test_inicia_antes_do_prazo_com_gente_na_sala(self):
        """O que o supervisor pediu: não esperar os 5 minutos à toa."""
        servico, repo = self._servico(presentes=3)

        servico.iniciar_sessao("123", 77)

        self.assertEqual(repo.iniciadas, [77])

    def test_recusa_iniciar_com_a_sala_vazia(self):
        servico, repo = self._servico(presentes=0)

        with self.assertRaises(ArenaServiceError) as caso:
            servico.iniciar_sessao("123", 77)

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.iniciadas, [])

    def test_recusa_iniciar_sessao_ja_em_andamento(self):
        servico, _ = self._servico(status_sessao="EM_ANDAMENTO")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.iniciar_sessao("123", 77)

        self.assertEqual(caso.exception.status, 409)

    # --- adicionar participantes --------------------------------------
    def test_adiciona_por_centro_de_custo(self):
        servico, repo = self._servico()

        servico.adicionar_participantes("123", 77, {"centros_custo": ["VEGA"]})

        _, participantes = repo.adicionados[0]
        self.assertEqual(len(participantes), 1)
        self.assertEqual(participantes[0]["origem_selecao"], "LOTE_CENTRO_CUSTO")

    def test_adiciona_operador_avulso_por_cpf(self):
        servico, repo = self._servico()

        servico.adicionar_participantes("123", 77, {"cpfs": ["999"]})

        _, participantes = repo.adicionados[0]
        self.assertEqual(participantes[0]["cpf"], "999")
        self.assertEqual(participantes[0]["origem_selecao"], "INDIVIDUAL")

    def test_recusa_adicionar_sem_ninguem_selecionado(self):
        servico, repo = self._servico()

        with self.assertRaises(ArenaServiceError) as caso:
            servico.adicionar_participantes("123", 77, {})

        self.assertEqual(caso.exception.status, 400)
        self.assertEqual(repo.adicionados, [])

    def test_recusa_adicionar_com_a_partida_em_andamento(self):
        servico, repo = self._servico(status_sessao="EM_ANDAMENTO")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.adicionar_participantes("123", 77, {"cpfs": ["999"]})

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.adicionados, [])

    # --- fechar a sala -------------------------------------------------
    def test_fecha_a_sala_em_espera(self):
        servico, repo = self._servico()

        resultado = servico.fechar_sala("123", 77)

        self.assertTrue(resultado["fechada"])
        self.assertEqual(resultado["id_campanha"], 42)
        self.assertEqual(repo.fechadas, [77])

    def test_recusa_fechar_partida_em_andamento(self):
        """Partida rodando se encerra pelo jogo, não pela sala de espera."""
        servico, repo = self._servico(status_sessao="EM_ANDAMENTO")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.fechar_sala("123", 77)

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.fechadas, [])

    # --- arquivamento --------------------------------------------------
    def test_arquiva_campanha_finalizada(self):
        servico, repo = self._servico()

        resultado = servico.arquivar_campanha("123", 42)

        self.assertTrue(resultado["arquivada"])
        self.assertEqual(resultado["status_anterior"], "FINALIZADA")
        self.assertEqual(repo.arquivadas, [42])

    def test_recusa_arquivar_campanha_em_jogo(self):
        """Sumir com uma partida rodando tiraria a tela de quem esta jogando."""
        servico, repo = self._servico(status_campanha="EM_ANDAMENTO")

        with self.assertRaises(ArenaServiceError) as caso:
            servico.arquivar_campanha("123", 42)

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.arquivadas, [])

    def test_recusa_arquivar_sala_aberta(self):
        servico, repo = self._servico(status_campanha="SALA_ABERTA")

        with self.assertRaises(ArenaServiceError):
            servico.arquivar_campanha("123", 42)

        self.assertEqual(repo.arquivadas, [])

    def test_desarquiva_devolvendo_ao_status_anterior(self):
        servico, repo = self._servico(status_campanha="ARQUIVADA")

        resultado = servico.desarquivar_campanha("123", 42)

        self.assertFalse(resultado["arquivada"])
        self.assertEqual(resultado["status"], "FINALIZADA")
        self.assertEqual(repo.desarquivadas, [42])

    def test_recusa_desarquivar_o_que_nao_esta_arquivado(self):
        servico, repo = self._servico()

        with self.assertRaises(ArenaServiceError) as caso:
            servico.desarquivar_campanha("123", 42)

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.desarquivadas, [])

    def test_listagem_esconde_arquivadas_por_padrao(self):
        servico, repo = self._servico()

        servico.listar_campanhas("123")

        self.assertEqual(repo.listagens, [False])

    def test_listagem_pode_incluir_arquivadas(self):
        servico, repo = self._servico()

        servico.listar_campanhas("123", incluir_arquivadas=True)

        self.assertEqual(repo.listagens, [True])

    # --- permissao -----------------------------------------------------
    def test_operador_nao_fecha_sala(self):
        servico, repo = self._servico()
        servico.repo.obter_usuario = lambda cpf: {
            "cpf": cpf,
            "nome": "Operador",
            "funcao": "OPERADOR(A) COBRADOR(A)",
            "centro_custo": "VEGA",
        }

        with self.assertRaises(ArenaServiceError) as caso:
            servico.fechar_sala("123", 77)

        self.assertEqual(caso.exception.status, 403)
        self.assertEqual(repo.fechadas, [])


if __name__ == "__main__":
    unittest.main()
