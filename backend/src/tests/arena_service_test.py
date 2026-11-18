from datetime import date, datetime, timedelta

from src.application.services.arena_service import (
    ArenaService,
    ArenaServiceError,
    ArenaSupervisorService,
)
from src.infrastructure.repositories.sql_arena_repository import ArenaRepository
from src.tests.permissao_seed_fake import permissoes_do_seed


class ArenaRepositoryFake:
    def __init__(self, funcao="OPERADOR(A)"):
        self.funcao = funcao
        self.campanha_criada = None
        self.publico_salvo = None
        self.equipe_salva = None
        self.quiz_salvo = None
        self.bingo_salvo = None
        self.resposta_quiz = None
        self.bingo_solicitado = False
        self.bingo_pausado = False
        self.bingo_encerrado = False
        self.bingo_continuado_padrao = None
        self.bingo_transferido_para = None
        self.session_can_start = False
        self.session_started = False
        self.tipo_jogo = "QUIZ_AO_VIVO"
        self.aurora_habilitada = True
        self.aurora_coins = 600
        self.aurora_xp = 750
        self.aurora_equipado = {"VISUAL": "oculos-pulse"}
        self.aurora_itens = [
            {
                "id": 1,
                "codigo": "JAQUETA_LUNAR",
                "nome": "Jaqueta Lunar",
                "descricao": "Jaqueta clara",
                "slot": "SUPERIOR",
                "raridade": "RARO",
                "preco_coins": 350,
                "xp_necessario": 500,
                "chave_visual": "jaqueta-lunar",
                "adquirido": 0,
                "adquirido_em": None,
                "equipado": 0,
            },
            {
                "id": 2,
                "codigo": "OCULOS_PULSE",
                "nome": "Oculos Pulse",
                "descricao": "Oculos ciano",
                "slot": "OCULOS",
                "raridade": "COMUM",
                "preco_coins": 100,
                "xp_necessario": 100,
                "chave_visual": "oculos-pulse",
                "adquirido": 1,
                "adquirido_em": datetime(2026, 8, 14, 9, 0, 0),
                "equipado": 1,
            },
        ]

    def obter_usuario(self, cpf):
        return {
            "cpf": str(cpf),
            "nome": "Pessoa Teste",
            "centro_custo": "PLANEJAMENTO",
            "funcao": self.funcao,
        }

    def obter_temporada_atual(self):
        return {
            "id": 1,
            "codigo": "TEMPORADA_01",
            "nome": "Temporada 01",
            "descricao": None,
            "data_inicio": date(2026, 7, 1),
            "data_fim": date(2026, 9, 30),
            "status": "ATIVA",
        }

    def obter_perfil(self, cpf, id_temporada):
        return {
            "xp_total": 750,
            "xp_temporada": 250,
            "nivel": 1,
            "titulo": "Iniciante",
        }

    def personalizacao_aurora_habilitada(self):
        return self.aurora_habilitada

    def obter_personalizacao_aurora(self, cpf):
        return {
            "saldo_coins": self.aurora_coins,
            "xp_total": self.aurora_xp,
            "itens": self.aurora_itens,
        }

    def comprar_visual_aurora(self, cpf, codigo_item):
        item = next(
            (row for row in self.aurora_itens if row["codigo"] == codigo_item),
            None,
        )
        if not item:
            raise ValueError("ITEM_NAO_ENCONTRADO")
        if item["adquirido"]:
            raise ValueError("ITEM_JA_ADQUIRIDO")
        if self.aurora_xp < item["xp_necessario"]:
            raise ValueError("XP_INSUFICIENTE")
        if self.aurora_coins < item["preco_coins"]:
            raise ValueError("COINS_INSUFICIENTES")
        self.aurora_coins -= item["preco_coins"]
        item["adquirido"] = 1
        item["adquirido_em"] = datetime(2026, 8, 14, 10, 0, 0)
        return item["id"]

    def equipar_visual_aurora(self, cpf, slot, codigo_item=None):
        slots_personagem = {
            "VISUAL", "CABECA", "OCULOS", "BRINCO", "MAQUIAGEM",
            "SUPERIOR", "INFERIOR", "CALCADO",
        }
        for row in self.aurora_itens:
            if row["slot"] == slot or (
                slot == "VISUAL" and row["slot"] in slots_personagem
            ):
                row["equipado"] = 0
        if codigo_item is None:
            self.aurora_equipado.pop(slot, None)
            return
        item = next(
            (
                row for row in self.aurora_itens
                if row["codigo"] == codigo_item and row["adquirido"]
            ),
            None,
        )
        if not item:
            raise ValueError("ITEM_NAO_ADQUIRIDO")
        if item["slot"] != slot and not (
            slot == "VISUAL" and item["slot"] in slots_personagem
        ):
            raise ValueError("SLOT_INVALIDO")
        item["equipado"] = 1
        self.aurora_equipado[slot] = item["chave_visual"]

    def listar_hub_operador(self, cpf):
        return []

    def obter_tipo_jogo(self, codigo):
        if codigo not in {"QUIZ_AO_VIVO", "BINGO"}:
            return None
        return {
            "id": 1 if codigo == "QUIZ_AO_VIVO" else 2,
            "codigo": codigo,
            "nome": "Quiz ao Vivo" if codigo == "QUIZ_AO_VIVO" else "Bingo",
        }

    def criar_campanha(self, **dados):
        self.campanha_criada = dados
        return {"id": 42, "status": "RASCUNHO", "criada_em": None}

    def obter_campanha_supervisor(self, id_campanha, cpf):
        return {
            "id": id_campanha,
            "titulo": "Quiz da equipe",
            "status": "RASCUNHO",
            "centro_custo": None,
            "tipo_jogo": self.tipo_jogo,
        }

    def listar_operadores_por_centros(self, centros):
        return [
            {"cpf": "111", "nome": "Operador Lote", "centro_custo": "VEGA"}
        ] if "VEGA" in centros else []

    def listar_operadores_por_cpfs(self, cpfs):
        return [
            {"cpf": cpf, "nome": f"Operador {cpf}", "centro_custo": "GAMA"}
            for cpf in cpfs
        ]

    def listar_operadores(self, centro_custo, busca, limite):
        operadores = [
            {"cpf": "111", "nome": "ANA TESTE", "centro_custo": "VEGA"},
            {"cpf": "222", "nome": "JOAO TESTE", "centro_custo": "GAMA"},
        ]
        return [
            operador for operador in operadores
            if (not centro_custo or operador["centro_custo"] == centro_custo)
            and (not busca or busca.upper() in operador["nome"])
        ][:limite]

    def salvar_publico(self, id_campanha, cpf, participantes):
        self.publico_salvo = participantes
        return len(participantes)

    def salvar_equipe_supervisor(
        self, cpf, nome_supervisor, carteira_nome, participantes
    ):
        self.equipe_salva = {
            "cpf": cpf,
            "nome_supervisor": nome_supervisor,
            "carteira_nome": carteira_nome,
            "participantes": participantes,
        }
        return 7

    def publicar_campanha(self, id_campanha, cpf):
        return len(self.publico_salvo or []) or 2

    def responder_convite(self, id_convite, cpf, resposta):
        return {
            "id_convite": id_convite,
            "id_campanha": 42,
            "titulo": "Quiz da equipe",
            "status": resposta,
        }

    def abrir_sala(self, id_campanha, cpf):
        return 77

    def obter_acesso_sessao(self, id_sessao, cpf, observador=False):
        supervisor = "SUPERVISOR" in self.funcao
        return {
            "id": id_sessao,
            "id_campanha": 42,
            "status": "EM_ANDAMENTO" if self.session_started else "AGUARDANDO",
            "cpf_criador": "123",
            "id_participante": None if supervisor else 8,
            "status_participante": None if supervisor else "ACEITO",
            "pode_iniciar": 1 if self.session_can_start else 0,
            "supervisor": 1 if supervisor else 0,
        }

    def obter_estado_sessao(self, id_sessao):
        agora = datetime(2026, 7, 31, 10, 0, 0)
        return {
            "id": id_sessao,
            "id_campanha": 42,
            "titulo": "Quiz da equipe",
            "status_campanha": "SALA_ABERTA",
            "status": "EM_ANDAMENTO" if self.session_started else "AGUARDANDO",
            "aberta_em": agora,
            "limite_entrada_em": agora + timedelta(minutes=5),
            "iniciada_em": None,
            "finalizada_em": None,
            "versao": 1,
            "tipo_jogo": self.tipo_jogo,
            "chave_sala": "abc",
            "servidor_agora": agora,
            "entrada_aberta": 1,
            "participantes": [],
        }

    def obter_estado_quiz(self, id_sessao, cpf, observador=False):
        agora = datetime(2026, 7, 31, 10, 5, 0)
        supervisor = "SUPERVISOR" in self.funcao
        return {
            "id_sessao": id_sessao,
            "id_campanha": 42,
            "titulo": "Quiz da equipe",
            "status_sessao": "FINALIZADA" if self.bingo_encerrado else "EM_ANDAMENTO",
            "papel": "SUPERVISOR" if supervisor else "OPERADOR",
            "id_participante": None if supervisor else 8,
            "pontuacao": 0,
            "classificacao": None,
            "xp_concedido": 0,
            "total_rodadas": 2,
            "servidor_agora": agora,
            "rodada": {
                "id": 12,
                "ordem": 1,
                "status": "ABERTA",
                "iniciada_em": agora,
                "encerra_em": agora + timedelta(seconds=20),
                "encerrada_em": None,
                "enunciado": "Qual abordagem usar?",
                "explicacao": None,
                "respostas_recebidas": 1 if self.resposta_quiz else 0,
                "total_participantes": 3,
                "alternativas": [
                    {"id": 31, "texto": "Ouvir", "correta": None, "ordem": 1},
                    {"id": 32, "texto": "Interromper", "correta": None, "ordem": 2},
                ],
                "resposta": (
                    {"id_alternativa": 31, "correta": None, "pontos": None,
                     "respondida_em": agora}
                    if self.resposta_quiz else None
                ),
            },
            "placar": [],
        }

    def responder_quiz(self, id_sessao, cpf, id_rodada, id_alternativa):
        self.resposta_quiz = {
            "id_sessao": id_sessao,
            "cpf": cpf,
            "id_rodada": id_rodada,
            "id_alternativa": id_alternativa,
        }
        return {"registrada": True}

    def processar_fluxo_quiz(self, id_sessao):
        return {"acao": "PERGUNTA_ABERTA", "aguardar_segundos": 20}

    def entrar_sala(self, id_sessao, cpf):
        return 42

    def atualizar_conexao_sessao(self, id_sessao, cpf, conectado):
        return 1

    def iniciar_sessao(self, id_sessao, cpf):
        self.session_started = True
        return 42

    def obter_quiz_supervisor(self, id_campanha, cpf):
        if not self.quiz_salvo:
            return None
        return {
            "id": 5,
            "id_campanha": id_campanha,
            **self.quiz_salvo["config"],
            "status": "PRONTO",
            "perguntas": self.quiz_salvo["perguntas"],
        }

    def salvar_quiz_supervisor(self, id_campanha, cpf, config, perguntas):
        self.quiz_salvo = {"config": config, "perguntas": perguntas}
        return 5

    def obter_bingo_supervisor(self, id_campanha, cpf):
        if not self.bingo_salvo:
            return None
        return {
            "id": 6,
            "id_campanha": id_campanha,
            **self.bingo_salvo,
            "status": "PRONTO",
        }

    def salvar_bingo_supervisor(self, id_campanha, cpf, config):
        self.bingo_salvo = config

    def obter_estado_bingo(self, id_sessao, cpf, observador=False):
        agora = datetime(2026, 7, 31, 10, 5, 0)
        return {
            "id_sessao": id_sessao,
            "id_campanha": 42,
            "titulo": "Bingo da equipe",
            "status_sessao": (
                "FINALIZADA" if self.bingo_encerrado else "EM_ANDAMENTO"
            ),
            "papel": "SUPERVISOR" if "SUPERVISOR" in self.funcao else "OPERADOR",
            "id_participante": None if "SUPERVISOR" in self.funcao else 8,
            "pontuacao": 0,
            "classificacao": None,
            "xp_concedido": 0,
            "padrao_vitoria": "LINHA",
            "casa_livre": True,
            "pausada": self.bingo_pausado,
            "aguardando_decisao": self.bingo_solicitado and not self.bingo_continuado_padrao,
            "pausada_em": None,
            "encerramento_tipo": "MANUAL" if self.bingo_encerrado else None,
            "servidor_agora": agora,
            "total_sorteios": 1,
            "participantes_online": 2,
            "sorteios": [{"id": 1, "numero": 7, "letra": "B", "ordem": 1,
                          "sorteado_em": agora}],
            "cartela": [],
            "progresso": [],
            "vitorias": ([{
                "id_participante": 8,
                "nome": "OPERADOR TESTE",
                "padrao": "LINHA",
                "posicao": 1,
            }] if self.bingo_solicitado else []),
        }

    def sortear_bingo(self, id_sessao, cpf):
        return {"numero": 7, "letra": "B", "ordem": 1}

    def solicitar_bingo(self, id_sessao, cpf, janela_segundos=3):
        self.bingo_solicitado = True
        return {"vitoria": True, "posicao": 1}

    def fechar_janela_bingo(self, id_sessao, janela_segundos=3):
        return {"fechada": False, "empatados": 0}

    def alterar_pausa_bingo(self, id_sessao, cpf, pausada):
        self.bingo_pausado = pausada

    def continuar_bingo(self, id_sessao, cpf, padrao):
        self.bingo_continuado_padrao = padrao
        self.bingo_pausado = False

    def encerrar_bingo(self, id_sessao, cpf):
        self.bingo_encerrado = True

    def listar_supervisores(self, busca, limite):
        return [{
            "cpf": "999",
            "nome": "SUPERVISORA DESTINO",
            "centro_custo": "VEGA",
            "funcao": "SUPERVISOR(A) DE OPERACOES",
        }]

    def transferir_bingo(self, id_sessao, cpf, cpf_destino):
        self.bingo_transferido_para = cpf_destino
        return {"cpf": cpf_destino, "nome": "SUPERVISORA DESTINO"}


class ArenaQuizAIServiceFake:
    def __init__(self):
        self.chamada = None

    def gerar(self, tema, contexto, dificuldade, quantidade):
        self.chamada = {
            "tema": tema,
            "contexto": contexto,
            "dificuldade": dificuldade,
            "quantidade": quantidade,
        }
        return [
            {
                "enunciado": f"Pergunta sugerida {indice + 1}?",
                "explicacao": "A escuta ativa ajuda a compreender a necessidade.",
                "alternativas": [
                    {"texto": "Praticar escuta ativa", "correta": True},
                    {"texto": "Interromper o cliente", "correta": False},
                    {"texto": "Expor dados pessoais", "correta": False},
                    {"texto": "Fazer uma ameaça", "correta": False},
                ],
            }
            for indice in range(quantidade)
        ]


def test_hub_calcula_nivel_e_progresso_do_operador():
    service = ArenaService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake()

    resultado = service.obter_hub("123")

    assert resultado["perfil"] == {
        "xp_total": 750,
        "xp_temporada": 250,
        "nivel": 2,
        "titulo": "Iniciante",
        "xp_inicio_nivel": 500,
        "xp_proximo_nivel": 1000,
    }


def test_aurora_usa_xp_para_desbloquear_e_coins_para_comprar():
    service = ArenaService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake()
    service.repo = repository

    antes = service.obter_personalizacao_aurora("123")
    jaqueta = next(
        item for item in antes["itens"] if item["codigo"] == "JAQUETA_LUNAR"
    )
    assert jaqueta["desbloqueado"] is True
    assert jaqueta["pode_comprar"] is True
    assert antes["xp_total"] == 750
    assert antes["saldo_coins"] == 600

    depois = service.comprar_visual_aurora(
        "123",
        {"codigo_item": "jaqueta_lunar"},
    )

    assert depois["xp_total"] == 750
    assert depois["saldo_coins"] == 250
    assert next(
        item for item in depois["itens"] if item["codigo"] == "JAQUETA_LUNAR"
    )["adquirido"] is True


def test_aurora_nao_compra_visual_bloqueado_por_xp():
    service = ArenaService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake()
    repository.aurora_itens[0]["xp_necessario"] = 1000
    service.repo = repository

    try:
        service.comprar_visual_aurora(
            "123",
            {"codigo_item": "JAQUETA_LUNAR"},
        )
    except ArenaServiceError as erro:
        assert erro.status == 409
        assert "XP suficiente" in str(erro)
    else:
        raise AssertionError("Visual bloqueado por XP foi comprado")


def test_aurora_equipa_item_adquirido_sem_alterar_saldo():
    service = ArenaService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake()
    service.repo = repository

    resultado = service.equipar_visual_aurora(
        "123",
        {"slot": "visual", "codigo_item": "oculos_pulse"},
    )

    assert resultado["equipado"]["VISUAL"] == "oculos-pulse"
    assert resultado["saldo_coins"] == 600


def test_aurora_recupera_o_preset_comprado_e_equipado_em_novo_login():
    repository = ArenaRepositoryFake()
    repository.aurora_itens.append({
        "id": 50,
        "codigo": "AURORA_LOOK_05",
        "nome": "Bomber Arena",
        "descricao": "Bomber Arena com cargo coordenada.",
        "slot": "VISUAL",
        "raridade": "COMUM",
        "preco_coins": 160,
        "xp_necessario": 400,
        "chave_visual": "look-05",
        "adquirido": 0,
        "adquirido_em": None,
        "equipado": 0,
    })
    primeira_sessao = ArenaService(permissoes=permissoes_do_seed())
    primeira_sessao.repo = repository

    primeira_sessao.comprar_visual_aurora(
        "123", {"codigo_item": "AURORA_LOOK_05"}
    )
    primeira_sessao.equipar_visual_aurora(
        "123", {"slot": "VISUAL", "codigo_item": "AURORA_LOOK_05"}
    )

    nova_sessao = ArenaService(permissoes=permissoes_do_seed())
    nova_sessao.repo = repository
    recuperado = nova_sessao.obter_personalizacao_aurora("123")
    item = next(
        item
        for item in recuperado["itens"]
        if item["codigo"] == "AURORA_LOOK_05"
    )

    assert item["adquirido"] is True
    assert item["equipado"] is True
    assert recuperado["equipado"]["VISUAL"] == "look-05"
    assert recuperado["saldo_coins"] == 440


def test_aurora_usa_um_unico_slot_para_o_corpo():
    assert "VISUAL" in ArenaService.AURORA_SLOTS
    assert "MAQUIAGEM" not in ArenaService.AURORA_SLOTS


def test_operador_nao_pode_criar_campanha():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake(funcao="ESPECIALISTA DE RECUPERACAO")

    try:
        service.criar_campanha(
            "123",
            {"titulo": "Quiz da equipe", "tipo_jogo": "QUIZ_AO_VIVO"},
        )
    except ArenaServiceError as erro:
        assert erro.status == 403
    else:
        raise AssertionError("Operador conseguiu criar uma campanha da Arena")

def test_supervisor_cria_rascunho_com_janela_fixa_de_cinco_minutos():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    service.repo = repository

    resultado = service.criar_campanha(
        "123",
        {
            "titulo": "Quiz da equipe",
            "tipo_jogo": "quiz_ao_vivo",
            "centro_custo": " VEGA ",
            "configuracao": {"quantidade_perguntas": 10},
        },
    )

    assert resultado["id"] == 42
    assert resultado["status"] == "RASCUNHO"
    assert resultado["janela_entrada_segundos"] == 300
    assert repository.campanha_criada["centro_custo"] == "VEGA"
    assert repository.campanha_criada["configuracao"] == {
        "quantidade_perguntas": 10
    }


def test_supervisor_combina_lote_e_selecao_individual_sem_duplicar():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    service.repo = repository

    resultado = service.salvar_publico(
        "123",
        42,
        {"centros_custo": [" VEGA ", "vega"], "cpfs": ["111", "222"]},
    )

    assert resultado["participantes"] == 2
    assert resultado["centros_custo"] == ["VEGA"]
    assert {item["cpf"] for item in repository.publico_salvo} == {"111", "222"}
    operador_sobreposto = next(
        item for item in repository.publico_salvo if item["cpf"] == "111"
    )
    assert operador_sobreposto["origem_selecao"] == "INDIVIDUAL"


def test_supervisor_remove_ausente_do_lote_e_mantem_inclusao_individual():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    service.repo = repository

    resultado = service.salvar_publico(
        "123",
        42,
        {
            "centros_custo": ["VEGA"],
            "cpfs": ["222"],
            "cpfs_excluidos": ["111"],
        },
    )

    assert resultado["participantes"] == 1
    assert {item["cpf"] for item in repository.publico_salvo} == {"222"}
    assert repository.publico_salvo[0]["origem_selecao"] == "INDIVIDUAL"


def test_supervisor_busca_operador_por_nome_sem_exigir_centro_de_custo():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")

    resultado = service.listar_operadores("123", "", "ana", 10)

    assert len(resultado) == 1
    assert resultado[0]["nome"] == "ANA TESTE"


def test_operador_responde_apenas_com_status_valido():
    service = ArenaService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake()

    resultado = service.responder_convite(
        "123",
        9,
        {"resposta": "aceito"},
    )
    assert resultado["status"] == "ACEITO"

    try:
        service.responder_convite("123", 9, {"resposta": "talvez"})
    except ArenaServiceError as erro:
        assert erro.status == 400
    else:
        raise AssertionError("Resposta inválida foi aceita")


def test_supervisor_abre_sala_com_estado_autorizado():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")

    estado = service.abrir_sala("123", 42)

    assert estado["id"] == 77
    assert estado["papel"] == "SUPERVISOR"
    assert estado["entrada_aberta"] is True
    assert estado["limite_entrada_em"] == "2026-07-31T10:05:00"


def test_operador_entra_na_sala_e_recebe_estado_recuperavel():
    service = ArenaService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake(funcao="ESPECIALISTA DE RECUPERACAO")

    estado = service.entrar_sala("456", 77)

    assert estado["papel"] == "OPERADOR"
    assert estado["status"] == "AGUARDANDO"


def test_consulta_recupera_inicio_da_sessao_apos_o_prazo():
    service = ArenaService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="ESPECIALISTA DE RECUPERACAO")
    repository.session_can_start = True
    service.repo = repository

    estado = service.obter_estado_sessao("456", 77)

    assert repository.session_started is True
    assert estado["status"] == "EM_ANDAMENTO"


def test_supervisor_retorna_para_sessao_em_andamento_apos_reconectar():
    service = ArenaService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    repository.session_started = True
    repository.tipo_jogo = "BINGO"
    service.repo = repository

    estado = service.obter_estado_sessao("123", 77)

    assert estado["papel"] == "SUPERVISOR"
    assert estado["status"] == "EM_ANDAMENTO"
    assert estado["tipo_jogo"] == "BINGO"


def test_quiz_exige_uma_unica_resposta_correta_por_pergunta():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    pergunta = {
        "enunciado": "Qual é a melhor abordagem inicial?",
        "alternativas": [
            {"texto": "Ouvir o cliente", "correta": True},
            {"texto": "Interromper o cliente", "correta": True},
        ],
    }

    try:
        service.salvar_quiz(
            "123",
            42,
            {"perguntas": [pergunta, pergunta]},
        )
    except ArenaServiceError as erro:
        assert erro.status == 400
        assert "exatamente uma" in str(erro)
    else:
        raise AssertionError("Quiz aceitou duas respostas corretas")


def test_supervisor_salva_quiz_pronto_com_duas_perguntas():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    service.repo = repository
    pergunta = {
        "enunciado": "Qual é a melhor abordagem inicial?",
        "alternativas": [
            {"texto": "Ouvir o cliente", "correta": True},
            {"texto": "Interromper o cliente", "correta": False},
        ],
    }

    quiz = service.salvar_quiz(
        "123",
        42,
        {
            "tempo_pergunta_segundos": 25,
            "pontos_acerto": 100,
            "bonus_velocidade_max": 50,
            "embaralhar_alternativas": True,
            "perguntas": [pergunta, pergunta],
        },
    )

    assert quiz["status"] == "PRONTO"
    assert quiz["tempo_pergunta_segundos"] == 25
    assert len(quiz["perguntas"]) == 2


def test_supervisor_gera_sugestoes_sem_salvar_o_quiz():
    ia = ArenaQuizAIServiceFake()
    service = ArenaSupervisorService(quiz_ai_service=ia, permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    service.repo = repository

    resultado = service.gerar_sugestoes_quiz(
        "123",
        42,
        {
            "tema": "Quebra de objeções em cobrança",
            "contexto": "Carteira de varejo",
            "dificuldade": "intermediário",
            "quantidade": 3,
        },
    )

    assert len(resultado["perguntas"]) == 3
    assert resultado["dificuldade"] == "INTERMEDIARIO"
    assert ia.chamada["contexto"] == "Carteira de varejo"
    assert repository.quiz_salvo is None


def test_operador_nao_pode_usar_sugestoes_da_ia():
    ia = ArenaQuizAIServiceFake()
    service = ArenaSupervisorService(quiz_ai_service=ia, permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake(funcao="ESPECIALISTA DE RECUPERACAO")

    try:
        service.gerar_sugestoes_quiz("456", 42, {"quantidade": 10})
    except ArenaServiceError as erro:
        assert erro.status == 403
    else:
        raise AssertionError("Operador conseguiu gerar perguntas com IA")


def test_operador_responde_quiz_sem_receber_correcao_antes_do_fim():
    service = ArenaService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="ESPECIALISTA DE RECUPERACAO")
    service.repo = repository

    estado = service.responder_quiz(
        "456",
        77,
        {"id_rodada": 12, "id_alternativa": 31},
    )

    assert repository.resposta_quiz["id_alternativa"] == 31
    assert estado["fase"] == "PERGUNTA"
    assert estado["rodada"]["resposta"]["correta"] is None
    assert all(
        alternativa["correta"] is None
        for alternativa in estado["rodada"]["alternativas"]
    )


def test_supervisor_nao_pode_responder_o_quiz():
    service = ArenaService(permissoes=permissoes_do_seed())
    service.repo = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")

    try:
        service.responder_quiz(
            "123",
            77,
            {"id_rodada": 12, "id_alternativa": 31},
        )
    except ArenaServiceError as erro:
        assert erro.status == 403
    else:
        raise AssertionError("Supervisor conseguiu responder o Quiz")


def test_supervisor_configura_bingo_com_padrao_e_xp():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    repository.tipo_jogo = "BINGO"
    service.repo = repository

    bingo = service.salvar_bingo(
        "123",
        42,
        {
            "padrao_vitoria": "duas_linhas",
            "casa_livre": True,
            "xp_participacao": 30,
            "xp_vitoria": 150,
        },
    )

    assert bingo["status"] == "PRONTO"
    assert bingo["padrao_vitoria"] == "DUAS_LINHAS"
    assert bingo["xp_participacao"] == 30
    assert bingo["xp_vitoria"] == 150


def test_operador_nao_pode_configurar_bingo():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="ESPECIALISTA DE RECUPERACAO")
    repository.tipo_jogo = "BINGO"
    service.repo = repository

    try:
        service.salvar_bingo("456", 42, {"padrao_vitoria": "LINHA"})
    except ArenaServiceError as erro:
        assert erro.status == 403
    else:
        raise AssertionError("Operador conseguiu configurar o Bingo")


def test_operador_solicita_bingo_e_recebe_estado_final():
    service = ArenaService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="ESPECIALISTA DE RECUPERACAO")
    repository.tipo_jogo = "BINGO"
    service.repo = repository

    estado = service.solicitar_bingo("456", 77)

    assert repository.bingo_solicitado is True
    assert estado["papel"] == "OPERADOR"
    assert estado["total_sorteios"] == 1


def test_supervisor_pausa_e_retoma_bingo_sem_encerrar_sessao():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    repository.tipo_jogo = "BINGO"
    service.repo = repository

    pausado = service.controlar_bingo("123", 77, {"acao": "PAUSAR"})
    assert pausado["pausada"] is True
    retomado = service.controlar_bingo("123", 77, {"acao": "RETOMAR"})
    assert retomado["pausada"] is False


def test_supervisor_continua_bingo_escolhendo_novo_padrao():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    repository.tipo_jogo = "BINGO"
    repository.bingo_solicitado = True
    repository.bingo_pausado = True
    service.repo = repository

    estado = service.controlar_bingo(
        "123", 77, {"acao": "CONTINUAR", "padrao_vitoria": "CARTELA_CHEIA"}
    )

    assert repository.bingo_continuado_padrao == "CARTELA_CHEIA"
    assert estado["aguardando_decisao"] is False


def test_supervisor_encerra_bingo_manualmente():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    repository.tipo_jogo = "BINGO"
    service.repo = repository

    estado = service.controlar_bingo("123", 77, {"acao": "ENCERRAR"})

    assert repository.bingo_encerrado is True
    assert estado["status_sessao"] == "FINALIZADA"
    assert estado["encerramento_tipo"] == "MANUAL"


def test_supervisor_transfere_controle_do_bingo():
    service = ArenaSupervisorService(permissoes=permissoes_do_seed())
    repository = ArenaRepositoryFake(funcao="SUPERVISOR(A) DE OPERACOES")
    repository.tipo_jogo = "BINGO"
    service.repo = repository

    resultado = service.transferir_bingo(
        "123", 77, {"cpf_destino": "999"}
    )

    assert resultado["transferida"] is True
    assert repository.bingo_transferido_para == "999"


def test_radar_identifica_operador_a_um_numero_do_bingo():
    casas = [
        {
            "coluna": coluna,
            "linha": linha,
            "numero": (indice * 15) + linha,
            "marcada": linha == 1 and coluna != "O",
        }
        for indice, coluna in enumerate("BINGO")
        for linha in range(1, 6)
    ]

    proximidade = ArenaRepository._calcular_proximidade_bingo(casas, "LINHA")

    assert proximidade["faltam_para_vencer"] == 1
    assert proximidade["quase_bingo"] is True
    assert proximidade["numeros_necessarios"] == [61]
