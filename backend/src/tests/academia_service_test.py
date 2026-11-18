import json
import unittest
from datetime import date, timedelta

from src.application.services.academia_service import (
    AcademiaService,
    AcademiaServiceError,
)


QUIZ_GABARITO = json.dumps({
    "nota_minima": 70,
    "perguntas": [
        {
            "id": "p1",
            "enunciado": "Qual o primeiro passo do atendimento?",
            "explicacao": "A saudação padroniza a abertura.",
            "alternativas": [
                {"id": "p1-a1", "texto": "Saudar o cliente", "correta": True},
                {"id": "p1-a2", "texto": "Encerrar a ligação", "correta": False},
            ],
        },
        {
            "id": "p2",
            "enunciado": "Quando registrar a tabulação?",
            "explicacao": "Sempre ao final do contato.",
            "alternativas": [
                {"id": "p2-a1", "texto": "Nunca", "correta": False},
                {"id": "p2-a2", "texto": "Ao final do contato", "correta": True},
            ],
        },
    ],
}, ensure_ascii=False)


class AcademiaRepositoryFake:
    def __init__(self):
        self.liberada = True
        self.anotacao = ""
        self.progresso_salvo = None
        self.primeira_concluida = False
        self.status_matricula = "EM_ANDAMENTO"
        self.tentativas = []
        self.melhores_tentativas = []
        self.prazos = []
        self.certificado = None
        self.certificados_emitidos = []
        self.tem_quiz = True
        self.tem_atribuicao = True
        self.tem_certificado = True

    def obter_usuario(self, cpf):
        return {
            "cpf": str(cpf),
            "nome": "Operador Teste",
            "centro_custo": "PLANEJAMENTO",
        }

    def obter_curso(self, id_curso, cpf, centro_custo):
        base = {
            "curso_id": id_curso,
            "curso_titulo": "Fundamentos",
            "curso_descricao": "Curso teste",
            "capa_url": None,
            "nivel": "INICIANTE",
            "carga_horaria_min": 20,
            "matricula_id": 7,
            "status_matricula": self.status_matricula,
            "modulo_id": 10,
            "modulo_titulo": "Módulo 1",
            "modulo_descricao": None,
            "modulo_ordem": 1,
            "aula_descricao": None,
            "aula_tipo": "VIDEO",
            "comando": None,
            "duracao_min": 5,
            "obrigatoria": 1,
            "favorita": 0,
        }
        return [
            {
                **base,
                "aula_id": 101,
                "aula_titulo": "Vídeo inicial",
                "conteudo_url": "https://video.test/aula.mp4",
                "conteudo_texto": None,
                "aula_ordem": 1,
                "percentual": 100 if self.primeira_concluida else 25,
                "concluida": 1 if self.primeira_concluida else 0,
            },
            {
                **base,
                "aula_id": 102,
                "aula_titulo": "Quiz da aula",
                "aula_tipo": "QUIZ",
                "conteudo_url": None,
                "conteudo_texto": QUIZ_GABARITO,
                "aula_ordem": 2,
                "percentual": 0,
                "concluida": 0,
            },
        ]

    def aula_da_matricula(self, id_aula, cpf, centro_custo):
        return {"matricula_id": 7, "curso_id": 1, "aula_id": id_aula}

    def aula_liberada(self, id_matricula, id_aula):
        return self.liberada

    def salvar_progresso(self, id_matricula, id_aula, percentual, concluida):
        self.progresso_salvo = (id_matricula, id_aula, percentual, concluida)

    def estrutura_anotacoes_disponivel(self):
        return True

    def obter_anotacao(self, id_matricula, id_aula):
        return {"conteudo": self.anotacao, "atualizado_em": None}

    def salvar_anotacao(self, id_matricula, id_aula, conteudo):
        self.anotacao = conteudo

    # --- quiz ---------------------------------------------------------

    def estrutura_quiz_disponivel(self):
        return self.tem_quiz

    def obter_aula_avaliativa(self, id_aula):
        if id_aula == 102:
            return {
                "id": 102,
                "tipo": "QUIZ",
                "conteudo_texto": QUIZ_GABARITO,
            }
        return {"id": id_aula, "tipo": "VIDEO", "conteudo_texto": None}

    def registrar_tentativa_quiz(self, id_matricula, id_aula, dados):
        self.tentativas.append((id_matricula, id_aula, dados))
        return {"id": len(self.tentativas)}

    def contar_tentativas_quiz(self, id_matricula, id_aula):
        return len(self.tentativas)

    def listar_melhores_tentativas(self, id_matricula):
        return self.melhores_tentativas

    def obter_nota_media_matricula(self, id_matricula):
        return 90.0

    # --- atribuicao ---------------------------------------------------

    def estrutura_atribuicao_disponivel(self):
        return self.tem_atribuicao

    def listar_prazos_do_usuario(self, cpf):
        return self.prazos

    # --- certificado --------------------------------------------------

    def estrutura_certificado_disponivel(self):
        return self.tem_certificado

    def obter_certificado_por_matricula(self, id_matricula):
        return self.certificado

    def obter_dados_certificado(self, id_matricula):
        return {
            "cpf": "123",
            "nome": "Operador Teste",
            "centro_custo": "PLANEJAMENTO",
            "curso_titulo": "Fundamentos",
            "carga_horaria_min": 20,
            "total_aulas": 2,
        }

    def emitir_certificado(self, id_matricula, codigo, dados):
        self.certificados_emitidos.append((id_matricula, codigo, dados))
        self.certificado = {
            "codigo": codigo,
            "nome": dados["nome"],
            "centro_custo": dados["centro_custo"],
            "curso_titulo": dados["curso_titulo"],
            "carga_horaria_min": dados["carga_horaria_min"],
            "total_aulas": dados["total_aulas"],
            "nota_final": dados["nota_final"],
            "emitido_em": None,
        }
        return {"codigo": codigo}


def service_with_fake():
    service = AcademiaService.__new__(AcademiaService)
    service.repo = AcademiaRepositoryFake()
    return service


class AcademiaServiceTest(unittest.TestCase):
    def test_curso_bloqueia_e_oculta_conteudo_das_aulas_seguintes(self):
        service = service_with_fake()

        curso = service.obter_curso("123", 1)
        primeira, segunda = curso["modulos"][0]["aulas"]

        self.assertFalse(primeira["bloqueada"])
        self.assertEqual(
            primeira["conteudo_url"],
            "https://video.test/aula.mp4"
        )
        self.assertTrue(segunda["bloqueada"])
        self.assertIsNone(segunda["conteudo_texto"])

    def test_backend_recusa_progresso_de_aula_bloqueada(self):
        service = service_with_fake()
        service.repo.liberada = False

        with self.assertRaises(AcademiaServiceError) as context:
            service.salvar_progresso("123", 102, 10, False)

        self.assertEqual(context.exception.status, 409)
        self.assertIsNone(service.repo.progresso_salvo)

    def test_anotacao_e_salva_por_matricula_e_aula(self):
        service = service_with_fake()

        resultado = service.salvar_anotacao(
            "123",
            101,
            "  Ponto importante  "
        )

        self.assertEqual(resultado["conteudo"], "Ponto importante")
        self.assertEqual(service.repo.anotacao, "Ponto importante")


class AcademiaQuizTest(unittest.TestCase):
    def test_gabarito_nao_e_enviado_ao_aluno(self):
        service = service_with_fake()
        service.repo.primeira_concluida = True

        curso = service.obter_curso("123", 1)
        quiz_aula = curso["modulos"][0]["aulas"][1]

        self.assertFalse(quiz_aula["bloqueada"])
        # O JSON bruto (que carrega "correta") nunca acompanha a aula.
        self.assertIsNone(quiz_aula["conteudo_texto"])

        serializado = json.dumps(quiz_aula, ensure_ascii=False)
        self.assertNotIn("correta", serializado)
        self.assertNotIn("explicacao", serializado)

        alternativas = quiz_aula["quiz"]["perguntas"][0]["alternativas"]
        self.assertEqual({"id", "texto"}, set(alternativas[0].keys()))

    def test_quiz_nao_pode_ser_concluido_pelo_progresso(self):
        service = service_with_fake()

        with self.assertRaises(AcademiaServiceError) as context:
            service.salvar_progresso("123", 102, 100, True)

        self.assertEqual(context.exception.status, 409)
        self.assertIsNone(service.repo.progresso_salvo)

    def test_quiz_aprovado_registra_tentativa_e_conclui_a_aula(self):
        service = service_with_fake()

        resultado = service.responder_quiz(
            "123",
            102,
            {"p1": "p1-a1", "p2": "p2-a2"}
        )

        self.assertEqual(resultado["nota"], 100.0)
        self.assertEqual(resultado["acertos"], 2)
        self.assertTrue(resultado["aprovada"])
        self.assertTrue(resultado["registrado"])
        self.assertEqual(len(service.repo.tentativas), 1)
        self.assertEqual(service.repo.progresso_salvo, (7, 102, 100, True))

    def test_quiz_reprovado_registra_tentativa_sem_concluir(self):
        service = service_with_fake()

        resultado = service.responder_quiz(
            "123",
            102,
            {"p1": "p1-a2", "p2": "p2-a1"}
        )

        self.assertEqual(resultado["nota"], 0.0)
        self.assertFalse(resultado["aprovada"])
        self.assertEqual(len(service.repo.tentativas), 1)
        self.assertIsNone(service.repo.progresso_salvo)

    def test_correcao_devolve_a_resposta_certa_e_a_explicacao(self):
        service = service_with_fake()

        resultado = service.responder_quiz("123", 102, {"p1": "p1-a2"})
        primeira = resultado["correcao"][0]

        self.assertFalse(primeira["acertou"])
        self.assertEqual(primeira["resposta_correta"], "p1-a1")
        self.assertEqual(
            primeira["explicacao"],
            "A saudação padroniza a abertura."
        )

    def test_responder_aula_que_nao_e_quiz_e_recusado(self):
        service = service_with_fake()

        with self.assertRaises(AcademiaServiceError) as context:
            service.responder_quiz("123", 101, {})

        self.assertEqual(context.exception.status, 400)

    def test_quiz_funciona_sem_a_tabela_de_tentativas(self):
        service = service_with_fake()
        service.repo.tem_quiz = False

        resultado = service.responder_quiz(
            "123",
            102,
            {"p1": "p1-a1", "p2": "p2-a2"}
        )

        self.assertTrue(resultado["aprovada"])
        self.assertFalse(resultado["registrado"])
        self.assertEqual(service.repo.tentativas, [])


class AcademiaPrazoTest(unittest.TestCase):
    def test_prazo_vencido_e_sinalizado_no_curso(self):
        service = service_with_fake()
        service.repo.prazos = [{
            "curso_id": 1,
            "data_limite": date.today() - timedelta(days=1),
            "origem": "ATRIBUIDA",
            "obrigatoria": 1,
        }]

        curso = service.obter_curso("123", 1)

        self.assertTrue(curso["obrigatoria"])
        self.assertEqual(curso["situacao_prazo"], "VENCIDO")

    def test_prazo_proximo_alerta_o_aluno(self):
        service = service_with_fake()
        service.repo.prazos = [{
            "curso_id": 1,
            "data_limite": date.today() + timedelta(days=2),
            "origem": "ATRIBUIDA",
            "obrigatoria": 1,
        }]

        curso = service.obter_curso("123", 1)

        self.assertEqual(curso["situacao_prazo"], "VENCE_EM_BREVE")

    def test_curso_concluido_ignora_o_prazo(self):
        service = service_with_fake()
        service.repo.status_matricula = "CONCLUIDO"
        service.repo.prazos = [{
            "curso_id": 1,
            "data_limite": date.today() - timedelta(days=10),
            "origem": "ATRIBUIDA",
            "obrigatoria": 1,
        }]

        curso = service.obter_curso("123", 1)

        self.assertEqual(curso["situacao_prazo"], "CONCLUIDO")

    def test_sem_estrutura_de_atribuicao_o_curso_nao_tem_prazo(self):
        service = service_with_fake()
        service.repo.tem_atribuicao = False

        curso = service.obter_curso("123", 1)

        self.assertIsNone(curso["situacao_prazo"])
        self.assertFalse(curso["obrigatoria"])

    def test_catalogo_ordena_vencidos_na_frente(self):
        service = service_with_fake()
        service.repo.listar_catalogo = lambda cpf, centro: [
            {"id": 1, "titulo": "Em dia", "nivel": "INICIANTE"},
            {"id": 2, "titulo": "Vencido", "nivel": "INICIANTE"},
        ]
        service.repo.prazos = [
            {
                "curso_id": 1,
                "data_limite": date.today() + timedelta(days=30),
                "origem": "ATRIBUIDA",
                "obrigatoria": 1,
            },
            {
                "curso_id": 2,
                "data_limite": date.today() - timedelta(days=2),
                "origem": "ATRIBUIDA",
                "obrigatoria": 1,
            },
        ]

        catalogo = service.listar_catalogo("123")

        self.assertEqual(
            [curso["titulo"] for curso in catalogo["cursos"]],
            ["Vencido", "Em dia"]
        )


class AcademiaCertificadoTest(unittest.TestCase):
    def test_certificado_e_emitido_ao_concluir_o_curso(self):
        service = service_with_fake()
        service.repo.status_matricula = "CONCLUIDO"

        curso = service.obter_curso("123", 1)

        self.assertIsNotNone(curso["certificado"])
        self.assertTrue(curso["certificado"]["codigo"].startswith("ACAD-"))
        self.assertEqual(curso["certificado"]["nota_final"], 90.0)
        self.assertEqual(len(service.repo.certificados_emitidos), 1)

    def test_certificado_nao_e_reemitido(self):
        service = service_with_fake()
        service.repo.status_matricula = "CONCLUIDO"

        primeiro = service.obter_curso("123", 1)["certificado"]
        segundo = service.obter_curso("123", 1)["certificado"]

        self.assertEqual(primeiro["codigo"], segundo["codigo"])
        self.assertEqual(len(service.repo.certificados_emitidos), 1)

    def test_curso_em_andamento_nao_gera_certificado(self):
        service = service_with_fake()

        curso = service.obter_curso("123", 1)

        self.assertIsNone(curso["certificado"])
        self.assertEqual(service.repo.certificados_emitidos, [])

    def test_emitir_certificado_exige_curso_concluido(self):
        service = service_with_fake()
        service.repo.obter_matricula_concluida = lambda cpf, curso: None

        with self.assertRaises(AcademiaServiceError) as context:
            service.emitir_certificado("123", 1)

        self.assertEqual(context.exception.status, 409)


if __name__ == "__main__":
    unittest.main()
