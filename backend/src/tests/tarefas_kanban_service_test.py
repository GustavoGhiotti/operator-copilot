import unittest
from datetime import date, datetime, timedelta

from src.application.services.tarefas_kanban_service import (
    TarefasKanbanError,
    TarefasKanbanService,
)
from src.tests.permissao_seed_fake import permissoes_do_seed


QUADRO_PESSOAL = "11111111-1111-1111-1111-111111111111"
QUADRO_EQUIPE = "22222222-2222-2222-2222-222222222222"
EQUIPE = "33333333-3333-3333-3333-333333333333"


class TarefasRepositoryFake:
    def __init__(self):
        self.tem_papeis = True
        self.papeis = {}
        self.membros_aceitos = set()
        self.equipes_do_dono = set()
        self.checklists_pedidos = []
        self.checklists_em_lote = 0
        self.notificacoes = []
        self.tarefas_criadas = []
        self.papeis_definidos = []
        self.quadros = {
            QUADRO_PESSOAL: {
                "ID": QUADRO_PESSOAL,
                "NOME": "Meu planejamento",
                "TIPO": "PESSOAL",
                "COR": "#8b5cf6",
                "FAVORITO": 1,
                "CPF_CRIADOR": "111",
                "ID_EQUIPE": None,
                "SUPERVISOR_CPF": None,
            },
            QUADRO_EQUIPE: {
                "ID": QUADRO_EQUIPE,
                "NOME": "Equipe",
                "TIPO": "EQUIPE",
                "COR": "#0ea5e9",
                "FAVORITO": 1,
                "CPF_CRIADOR": "999",
                "ID_EQUIPE": EQUIPE,
                "SUPERVISOR_CPF": "999",
            },
        }
        # (nome, função, centro de custo) — títulos reais da coluna
        # FUNCAO_COLABORADOR, com o preenchimento à direita que ela traz.
        self.usuarios = {
            "111": (
                "Ana", "ANALISTA DE PLANEJAMENTO SR   ", "PLANEJAMENTO"
            ),
            "222": ("Bruno", "ANALISTA DE MIS PL", "PLANEJAMENTO"),
            "333": ("Carla", "OPERADOR(A) COBRADOR(A)       ", "COBRANCA"),
            "444": (
                "Diego", "ESPECIALISTA DE RECUPERACAO DE", "COBRANCA"
            ),
            "555": ("Elza", "NEGOCIADOR |                  ", "COBRANCA"),
            "999": ("Gestor", "SUPERVISOR(A) DE OPERACOES    ", "COBRANCA"),
        }

    # --- usuário -------------------------------------------------------

    def obter_usuario(self, cpf):
        dados = self.usuarios.get(str(cpf))
        if not dados:
            return None
        return {
            "CPF": str(cpf),
            "NOME": dados[0],
            "FUNCAO": dados[1],
            "CENTRO_CUSTO": dados[2],
        }

    # --- checklist -----------------------------------------------------

    def listar_checklist(self, id_todo):
        self.checklists_pedidos.append(id_todo)
        return []

    def listar_checklists_em_lote(self, ids):
        self.checklists_em_lote += 1
        return {item: [] for item in ids}

    # --- papéis --------------------------------------------------------

    def estrutura_papeis_disponivel(self):
        return self.tem_papeis

    def obter_papel_no_quadro(self, quadro_id, cpf):
        return self.papeis.get((str(quadro_id), str(cpf)))

    def definir_papel_no_quadro(self, quadro_id, cpf, papel, por):
        self.papeis[(str(quadro_id), str(cpf))] = papel
        self.papeis_definidos.append((str(quadro_id), str(cpf), papel))
        return 1

    def remover_membro_quadro(self, quadro_id, cpf):
        return int(self.papeis.pop((str(quadro_id), str(cpf)), None) is not None)

    def listar_membros_quadro(self, quadro_id):
        return [
            {
                "CPF": cpf,
                "PAPEL": papel,
                "DT_CRIACAO": None,
                "NOME": self.usuarios.get(cpf, ("?",))[0],
                "FUNCAO": "",
                "CENTRO_CUSTO": "",
            }
            for (quadro, cpf), papel in self.papeis.items()
            if quadro == str(quadro_id)
        ]

    # --- quadros e equipes ---------------------------------------------

    def obter_quadro(self, quadro_id):
        return self.quadros.get(str(quadro_id))

    def criar_quadro(self, nome, tipo, cpf_criador, cor, equipe_id=None):
        novo = "44444444-4444-4444-4444-444444444444"
        self.quadros[novo] = {
            "ID": novo,
            "NOME": nome,
            "TIPO": tipo,
            "COR": cor,
            "FAVORITO": 1,
            "CPF_CRIADOR": str(cpf_criador),
            "ID_EQUIPE": equipe_id,
            "SUPERVISOR_CPF": None,
        }
        return {"ID": novo}

    def usuario_eh_membro_aceito(self, equipe_id, cpf):
        return (str(equipe_id), str(cpf)) in self.membros_aceitos

    def obter_equipe_supervisor(self, equipe_id, cpf):
        if (str(equipe_id), str(cpf)) in self.equipes_do_dono:
            return {"ID": str(equipe_id)}
        return None

    def criar_equipe(self, nome, cpf, centro_custo):
        return {"ID": EQUIPE}

    def enviar_convites(self, equipe_id, cpfs):
        self.convites_enviados = list(cpfs)
        return len(cpfs)

    def obter_lista(self, lista_id):
        return {"ID": lista_id, "ID_QUADRO": QUADRO_PESSOAL, "STATUS_BASE": None}

    def listar_listas(self, quadro_id):
        return [{
            "ID": "lista-1",
            "NOME": "Caixa de entrada",
            "COR": "#94a3b8",
            "ORDEM": 0,
            "STATUS_BASE": "caixa_entrada",
        }]

    def criar_lista(self, *args, **kwargs):
        return {"ID": "lista-1"}

    # --- tarefas -------------------------------------------------------

    def criar_tarefa(self, **kwargs):
        self.tarefas_criadas.append(kwargs)
        return {"ID": 500 + len(self.tarefas_criadas)}

    def substituir_checklist(self, id_todo, checklist):
        return None

    def registrar_historico(self, *args, **kwargs):
        return None

    def criar_notificacao(self, cpf, tipo, titulo, mensagem, id_todo, chave):
        self.notificacoes.append((cpf, tipo, chave))
        return None

    def listar_tarefas_para_lembrete(self, cpf):
        return []

    def listar_tarefas_para_lembrete_global(self, dias_atraso=30):
        return self.lembretes_globais

    lembretes_globais = []


def service_with_fake():
    service = TarefasKanbanService.__new__(TarefasKanbanService)
    service.repo = TarefasRepositoryFake()
    service.permissoes = permissoes_do_seed()
    service._papeis_ok = None
    return service


class ChecklistEmLoteTest(unittest.TestCase):
    def test_quadro_usa_uma_consulta_para_todos_os_checklists(self):
        service = service_with_fake()
        rows = [{"ID": indice, "TITULO": f"T{indice}"} for indice in range(30)]
        checklists = service.repo.listar_checklists_em_lote(
            [row["ID"] for row in rows]
        )

        for row in rows:
            service._map_tarefa(row, checklists)

        self.assertEqual(service.repo.checklists_em_lote, 1)
        self.assertEqual(service.repo.checklists_pedidos, [])

    def test_tarefa_isolada_ainda_consulta_individualmente(self):
        service = service_with_fake()

        service._map_tarefa({"ID": 7, "TITULO": "Avulsa"})

        self.assertEqual(service.repo.checklists_pedidos, [7])


class PapelNoQuadroTest(unittest.TestCase):
    def test_criador_do_quadro_e_dono(self):
        service = service_with_fake()
        quadro = service.repo.obter_quadro(QUADRO_PESSOAL)

        self.assertEqual(service._papel_no_quadro("111", quadro), "DONO")
        self.assertTrue(service._pode_editar_quadro("111", quadro))

    def test_editor_convidado_edita_sem_ser_supervisor(self):
        service = service_with_fake()
        service.repo.papeis[(QUADRO_PESSOAL, "222")] = "EDITOR"
        quadro = service.repo.obter_quadro(QUADRO_PESSOAL)

        self.assertEqual(service._papel_no_quadro("222", quadro), "EDITOR")
        self.assertTrue(service._pode_editar_quadro("222", quadro))

    def test_leitor_acessa_mas_nao_edita(self):
        service = service_with_fake()
        service.repo.papeis[(QUADRO_PESSOAL, "222")] = "LEITOR"
        quadro = service.repo.obter_quadro(QUADRO_PESSOAL)

        self.assertTrue(service._pode_acessar_quadro("222", quadro))
        self.assertFalse(service._pode_editar_quadro("222", quadro))

    def test_estranho_nao_acessa(self):
        service = service_with_fake()
        quadro = service.repo.obter_quadro(QUADRO_PESSOAL)

        self.assertIsNone(service._papel_no_quadro("333", quadro))
        self.assertFalse(service._pode_acessar_quadro("333", quadro))

    def test_membro_de_equipe_acessa_sem_editar(self):
        """Comportamento anterior preservado: membro acompanha, não edita."""
        service = service_with_fake()
        service.repo.membros_aceitos.add((EQUIPE, "333"))
        quadro = service.repo.obter_quadro(QUADRO_EQUIPE)

        self.assertEqual(
            service._papel_no_quadro("333", quadro),
            "MEMBRO_EQUIPE"
        )
        self.assertTrue(service._pode_acessar_quadro("333", quadro))
        self.assertFalse(service._pode_editar_quadro("333", quadro))

    def test_sem_a_migration_o_modelo_antigo_continua_valendo(self):
        service = service_with_fake()
        service.repo.tem_papeis = False
        service.repo.papeis[(QUADRO_PESSOAL, "222")] = "EDITOR"
        quadro = service.repo.obter_quadro(QUADRO_PESSOAL)

        self.assertIsNone(service._papel_no_quadro("222", quadro))


class AtribuicaoEntreParesTest(unittest.TestCase):
    def test_par_com_papel_de_editor_pode_atribuir(self):
        service = service_with_fake()
        service.repo.papeis[(QUADRO_PESSOAL, "111")] = "DONO"
        service.repo.papeis[(QUADRO_PESSOAL, "222")] = "EDITOR"

        resultado = service.criar_tarefa("111", {
            "titulo": "Revisar relatório",
            "cpf_responsavel": "222",
            "quadro_id": QUADRO_PESSOAL,
            "lista_id": "lista-1",
        })

        self.assertIn("id", resultado)
        criada = service.repo.tarefas_criadas[0]
        self.assertEqual(criada["cpf_responsavel"], "222")
        self.assertEqual(criada["cpf_criador"], "111")

    def test_atribuir_para_quem_nao_divide_quadro_e_recusado(self):
        service = service_with_fake()
        service.repo.papeis[(QUADRO_PESSOAL, "111")] = "DONO"

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.criar_tarefa("111", {
                "titulo": "Tarefa solta",
                "cpf_responsavel": "333",
                "quadro_id": QUADRO_PESSOAL,
                "lista_id": "lista-1",
            })

        self.assertEqual(contexto.exception.status, 403)
        self.assertEqual(service.repo.tarefas_criadas, [])

    def test_leitor_nao_pode_atribuir(self):
        service = service_with_fake()
        service.repo.papeis[(QUADRO_EQUIPE, "222")] = "LEITOR"
        service.repo.papeis[(QUADRO_EQUIPE, "333")] = "EDITOR"

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.criar_tarefa("222", {
                "titulo": "Delegar sem poder",
                "cpf_responsavel": "333",
                "quadro_id": QUADRO_EQUIPE,
                "lista_id": "lista-1",
            })

        self.assertEqual(contexto.exception.status, 403)

    def test_atribuicao_notifica_o_responsavel(self):
        service = service_with_fake()
        service.repo.papeis[(QUADRO_PESSOAL, "111")] = "DONO"
        service.repo.papeis[(QUADRO_PESSOAL, "222")] = "EDITOR"

        service.criar_tarefa("111", {
            "titulo": "Conferir base",
            "cpf_responsavel": "222",
            "quadro_id": QUADRO_PESSOAL,
            "lista_id": "lista-1",
        })

        self.assertEqual(
            [(cpf, tipo) for cpf, tipo, _ in service.repo.notificacoes],
            [("222", "ATRIBUICAO")]
        )


class QuemPodeAbrirEspacosTest(unittest.TestCase):
    """Títulos reais da coluna FUNCAO_COLABORADOR, com os espaços de
    preenchimento e as variações que ela traz."""

    BLOQUEADAS = [
        "OPERADOR(A) COBRADOR(A)       ",
        "NEGOCIADOR",
        "NEGOCIADOR |                  ",
        "OMNICHANNEL",
        "APRENDIZ OMNICHANNEL",
        "ESTAGIARIO",
        # Truncado na origem e ausente da lista enviada — é aprendiz da
        # mesma função de cobrança, então entra pelo mesmo trecho.
        "APRENDIZ OPERADOR(A) COBRADOR",
    ]

    LIBERADAS = [
        "SUPERVISOR(A) DE OPERACOES    ",
        "ANALISTA DE PLANEJAMENTO SR   ",
        "GERENTE DE OPERACOES JR",
        "COORDENADOR(A) DE OPERACOES PL",
        "ANALISTA DE QUALIDADE         ",
        "ASSISTENTE ADMINISTRATIVO",
        "BACK OFFICE 1 - 6 HRS",
        "MONITOR DE TELEATENDIMENTO",
        "APRENDIZ - RH",
        "APRENDIZ TI",
        "DIRETOR(A)",
        "ZELADOR (A)                   ",
        "RECEPCIONISTA",
        # Fora da lista de bloqueio enviada — mantido liberado.
        "ESPECIALISTA DE RECUPERACAO DE",
    ]

    def _usuario(self, funcao):
        return {"FUNCAO": funcao, "CENTRO_CUSTO": "COBRANCA"}

    def test_funcoes_de_linha_de_frente_nao_abrem_espacos(self):
        for funcao in self.BLOQUEADAS:
            with self.subTest(funcao=funcao):
                self.assertFalse(
                    TarefasKanbanService._pode_abrir_espacos(
                        self._usuario(funcao)
                    )
                )

    def test_demais_funcoes_abrem_espacos(self):
        for funcao in self.LIBERADAS:
            with self.subTest(funcao=funcao):
                self.assertTrue(
                    TarefasKanbanService._pode_abrir_espacos(
                        self._usuario(funcao)
                    )
                )

    def test_funcao_em_branco_nao_abre(self):
        self.assertFalse(
            TarefasKanbanService._pode_abrir_espacos(self._usuario("   "))
        )

    def test_analista_cria_equipe(self):
        service = service_with_fake()

        criada = service.criar_equipe("111", {"nome": "Projeto Alfa"})

        self.assertEqual(criada["nome"], "Projeto Alfa")

    def test_supervisor_cria_equipe(self):
        service = service_with_fake()

        criada = service.criar_equipe("999", {"nome": "Operacao"})

        self.assertEqual(criada["nome"], "Operacao")

    def test_operador_cobrador_nao_cria_equipe(self):
        service = service_with_fake()

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.criar_equipe("333", {"nome": "Resenha"})

        self.assertEqual(contexto.exception.status, 403)

    def test_negociador_nao_cria_quadro(self):
        service = service_with_fake()

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.criar_quadro_pessoal("555", {"nome": "Quadro novo"})

        self.assertEqual(contexto.exception.status, 403)

    def test_operador_nao_pesquisa_colegas(self):
        service = service_with_fake()

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.pesquisar_operadores("333", nome="Ana")

        self.assertEqual(contexto.exception.status, 403)

    def test_analista_cria_quadro_extra(self):
        service = service_with_fake()

        criado = service.criar_quadro_pessoal("222", {"nome": "Squad"})

        self.assertEqual(criado["nome"], "Squad")

    def test_equipe_aceita_supervisor_como_convidado(self):
        """A regra antiga recusava supervisores, o que impedia time de
        projeto com gestor dentro."""
        service = service_with_fake()
        service.repo.equipes_do_dono.add((EQUIPE, "111"))

        resultado = service.enviar_convites("111", EQUIPE, ["999"])

        self.assertEqual(resultado["quantidade"], 1)
        self.assertEqual(service.repo.convites_enviados, ["999"])

    def test_convite_exige_ser_dono_da_equipe(self):
        service = service_with_fake()

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.enviar_convites("222", EQUIPE, ["333"])

        self.assertEqual(contexto.exception.status, 404)


class MembrosDoQuadroTest(unittest.TestCase):
    def test_dono_inclui_membro(self):
        service = service_with_fake()

        resultado = service.definir_membro_quadro(
            "111",
            QUADRO_PESSOAL,
            "222",
            "editor",
        )

        self.assertEqual(resultado["papel"], "EDITOR")
        self.assertIn((QUADRO_PESSOAL, "222", "EDITOR"),
                      service.repo.papeis_definidos)

    def test_quem_nao_administra_nao_inclui_membro(self):
        service = service_with_fake()
        service.repo.papeis[(QUADRO_PESSOAL, "222")] = "EDITOR"

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.definir_membro_quadro("222", QUADRO_PESSOAL, "333", "EDITOR")

        self.assertEqual(contexto.exception.status, 403)

    def test_papel_invalido_e_recusado(self):
        service = service_with_fake()

        with self.assertRaises(TarefasKanbanError):
            service.definir_membro_quadro("111", QUADRO_PESSOAL, "222", "CHEFE")

    def test_criador_do_quadro_nao_pode_ser_removido(self):
        service = service_with_fake()

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.remover_membro_quadro("111", QUADRO_PESSOAL, "111")

        self.assertEqual(contexto.exception.status, 409)


class DespachoDeLembretesTest(unittest.TestCase):
    def _tarefa(self, id_todo, cpf, vencimento, minutos=30):
        return {
            "CPF_RESPONSAVEL": cpf,
            "ID_TODO": id_todo,
            "TITULO": f"Tarefa {id_todo}",
            "DATA_VENCIMENTO": vencimento.date(),
            "HORA_VENCIMENTO": vencimento.time(),
            "LEMBRETE_MINUTOS": minutos,
        }

    def test_despacho_gera_para_outros_usuarios(self):
        service = service_with_fake()
        agora = datetime.now()
        service.repo.lembretes_globais = [
            self._tarefa(1, "222", agora - timedelta(days=1)),
            self._tarefa(2, "333", agora + timedelta(minutes=10)),
        ]

        resultado = service.despachar_lembretes("999")

        self.assertEqual(resultado["tarefas_avaliadas"], 2)
        self.assertEqual(resultado["atrasos"], 1)
        self.assertEqual(resultado["lembretes"], 1)
        destinatarios = {cpf for cpf, _, _ in service.repo.notificacoes}
        self.assertEqual(destinatarios, {"222", "333"})

    def test_tarefa_longe_do_prazo_nao_gera_nada(self):
        service = service_with_fake()
        service.repo.lembretes_globais = [
            self._tarefa(1, "222", datetime.now() + timedelta(days=2)),
        ]

        resultado = service.despachar_lembretes("999")

        self.assertEqual(resultado["lembretes"], 0)
        self.assertEqual(resultado["atrasos"], 0)
        self.assertEqual(service.repo.notificacoes, [])

    def test_despacho_e_restrito_a_gestao(self):
        service = service_with_fake()
        service.repo.lembretes_globais = []

        with self.assertRaises(TarefasKanbanError) as contexto:
            service.despachar_lembretes("333")

        self.assertEqual(contexto.exception.status, 403)

    def test_vencimento_invalido_nao_derruba_o_despacho(self):
        service = service_with_fake()
        service.repo.lembretes_globais = [
            {
                "CPF_RESPONSAVEL": "222",
                "ID_TODO": 9,
                "TITULO": "Sem data",
                "DATA_VENCIMENTO": "nao-e-data",
                "HORA_VENCIMENTO": None,
                "LEMBRETE_MINUTOS": 30,
            }
        ]

        resultado = service.despachar_lembretes("999")

        self.assertEqual(resultado["tarefas_avaliadas"], 1)
        self.assertEqual(resultado["lembretes"], 0)


if __name__ == "__main__":
    unittest.main()
