from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import decode_token, get_jwt_identity, jwt_required
from flask_socketio import join_room, leave_room
from datetime import datetime

from src.application.services.arena_service import (
    ArenaService,
    ArenaServiceError,
    ArenaSupervisorService,
)
from src.extensions.socketio import socketio


bp = Blueprint("Arena", __name__, url_prefix="/arena")


def _sala_socket(id_sessao):
    return f"arena_sessao_{int(id_sessao)}"


def _iniciar_sessao_apos_prazo(app, cpf, id_sessao, segundos):
    socketio.sleep(max(0, segundos) + 0.25)
    with app.app_context():
        try:
            estado = ArenaSupervisorService().iniciar_sessao(cpf, id_sessao)
        except ArenaServiceError as erro:
            if erro.status != 409:
                app.logger.exception("Falha ao iniciar automaticamente a Arena")
            return
        socketio.emit("arena_estado", estado, to=_sala_socket(id_sessao))
        socketio.emit(
            "arena_sessao_iniciada",
            estado,
            to=_sala_socket(id_sessao),
        )
    if estado.get("tipo_jogo") == "QUIZ_AO_VIVO":
        socketio.start_background_task(
            _executar_quiz_ao_vivo,
            app,
            id_sessao,
        )


def _fechar_janela_bingo(app, id_sessao, segundos):
    """Fecha a coleta de bingos depois da janela e avisa a sala.

    Mesmo padrao de `_iniciar_sessao_apos_prazo`. Se esta tarefa morrer, o
    fechamento preguicoso em `obter_estado_bingo` cobre — a partida nao pode
    ficar presa em "disputa aberta".
    """
    socketio.sleep(max(0, segundos) + 0.25)
    with app.app_context():
        try:
            resultado = ArenaService().fechar_janela_bingo(id_sessao)
        except Exception:
            app.logger.exception("Falha ao fechar a janela do Bingo")
            return
        if not resultado.get("fechada"):
            return
        socketio.emit(
            "arena_bingo_atualizado",
            {
                "id_sessao": id_sessao,
                "acao": "DISPUTA_ENCERRADA",
                "empatados": resultado.get("empatados", 0),
            },
            to=_sala_socket(id_sessao),
        )


def _executar_quiz_ao_vivo(app, id_sessao):
    while True:
        with app.app_context():
            try:
                resultado = ArenaService().processar_fluxo_quiz(id_sessao)
            except Exception:
                app.logger.exception("Falha no motor ao vivo da Arena")
                return
            acao = resultado.get("acao")
            if acao in {
                "RODADA_ENCERRADA",
                "NOVA_RODADA",
                "SESSAO_FINALIZADA",
            }:
                socketio.emit(
                    "arena_quiz_atualizado",
                    {"id_sessao": id_sessao, "acao": acao},
                    to=_sala_socket(id_sessao),
                )
            if acao in {"FINALIZADA", "SESSAO_FINALIZADA"}:
                return
            espera = resultado.get("aguardar_segundos")
        socketio.sleep(max(0.1, float(espera or 1)) + 0.1)


def _executar(operacao, status=200):
    try:
        return jsonify(operacao()), status
    except ArenaServiceError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro ao processar a Arena Aurora")
        return jsonify({
            "erro": "Não foi possível processar a Arena Aurora."
        }), 500


@bp.route("/hub", methods=["GET"])
@jwt_required()
def obter_hub():
    return _executar(
        lambda: ArenaService().obter_hub(get_jwt_identity())
    )


@bp.route("/aurora", methods=["GET"])
@jwt_required()
def obter_personalizacao_aurora():
    return _executar(
        lambda: ArenaService().obter_personalizacao_aurora(
            get_jwt_identity()
        )
    )


@bp.route("/aurora/compras", methods=["POST"])
@jwt_required()
def comprar_visual_aurora():
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaService().comprar_visual_aurora(
            get_jwt_identity(),
            dados,
        )
    )


@bp.route("/aurora/equipamento", methods=["PUT"])
@jwt_required()
def equipar_visual_aurora():
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaService().equipar_visual_aurora(
            get_jwt_identity(),
            dados,
        )
    )


@bp.route("/convites/<int:id_convite>/resposta", methods=["PATCH"])
@jwt_required()
def responder_convite(id_convite):
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaService().responder_convite(
            get_jwt_identity(),
            id_convite,
            dados,
        )
    )


@bp.route("/sessoes/<int:id_sessao>", methods=["GET"])
@jwt_required()
def obter_estado_sessao(id_sessao):
    return _executar(
        lambda: ArenaService().obter_estado_sessao(
            get_jwt_identity(),
            id_sessao,
        )
    )


@bp.route("/sessoes/<int:id_sessao>/entrar", methods=["POST"])
@jwt_required()
def entrar_sessao(id_sessao):
    def operacao():
        estado = ArenaService().entrar_sala(get_jwt_identity(), id_sessao)
        socketio.emit("arena_estado", estado, to=_sala_socket(id_sessao))
        return estado

    return _executar(operacao)


@bp.route("/sessoes/<int:id_sessao>/quiz", methods=["GET"])
@jwt_required()
def obter_estado_quiz(id_sessao):
    return _executar(
        lambda: ArenaService().obter_estado_quiz(
            get_jwt_identity(),
            id_sessao,
        )
    )


@bp.route("/sessoes/<int:id_sessao>/quiz/respostas", methods=["POST"])
@jwt_required()
def responder_quiz(id_sessao):
    dados = request.get_json() or {}

    def operacao():
        estado = ArenaService().responder_quiz(
            get_jwt_identity(),
            id_sessao,
            dados,
        )
        socketio.emit(
            "arena_quiz_atualizado",
            {"id_sessao": id_sessao, "acao": "RESPOSTA_REGISTRADA"},
            to=_sala_socket(id_sessao),
        )
        return estado

    return _executar(operacao)


@bp.route("/sessoes/<int:id_sessao>/bingo", methods=["GET"])
@jwt_required()
def obter_estado_bingo(id_sessao):
    return _executar(
        lambda: ArenaService().obter_estado_bingo(
            get_jwt_identity(),
            id_sessao,
        )
    )


@bp.route("/sessoes/<int:id_sessao>/bingo/solicitar", methods=["POST"])
@jwt_required()
def solicitar_bingo(id_sessao):
    def operacao():
        estado = ArenaService().solicitar_bingo(
            get_jwt_identity(),
            id_sessao,
        )
        socketio.emit(
            "arena_bingo_atualizado",
            {"id_sessao": id_sessao, "acao": "BINGO_CONFIRMADO"},
            to=_sala_socket(id_sessao),
        )
        socketio.start_background_task(
            _fechar_janela_bingo,
            current_app._get_current_object(),
            id_sessao,
            ArenaService.JANELA_DISPUTA_SEGUNDOS,
        )
        return estado

    return _executar(operacao)


@bp.route("/tipos-jogo", methods=["GET"])
@jwt_required()
def listar_tipos_jogo():
    return _executar(
        lambda: ArenaService().listar_tipos_jogo(get_jwt_identity())
    )


@bp.route("/ranking/centros-custo", methods=["GET"])
@jwt_required()
def ranking_centros_custo():
    return _executar(
        lambda: ArenaService().ranking_centros(
            get_jwt_identity(),
            request.args.get("limite", 20),
        )
    )


@bp.route(
    "/ranking/centros-custo/<path:centro_custo>/operadores",
    methods=["GET"],
)
@jwt_required()
def ranking_operadores(centro_custo):
    return _executar(
        lambda: ArenaService().ranking_operadores(
            get_jwt_identity(),
            centro_custo,
            request.args.get("limite", 50),
        )
    )


@bp.route("/observatorio", methods=["GET"])
@jwt_required()
def observatorio_arena():
    return _executar(
        lambda: ArenaSupervisorService().listar_observatorio(
            get_jwt_identity()
        )
    )


@bp.route("/observatorio/sessoes/<int:id_sessao>/cartelas", methods=["GET"])
@jwt_required()
def observatorio_cartelas(id_sessao):
    return _executar(
        lambda: ArenaSupervisorService().listar_cartelas_observatorio(
            get_jwt_identity(),
            id_sessao,
        )
    )


@bp.route("/observatorio/sessoes/<int:id_sessao>/assumir", methods=["POST"])
@jwt_required()
def assumir_controle_sessao(id_sessao):
    def operacao():
        resultado = ArenaSupervisorService().assumir_controle(
            get_jwt_identity(),
            id_sessao,
        )
        # A sala inteira e avisada: o supervisor original precisa saber que
        # perdeu o comando, e nao descobrir quando o botao parar de responder.
        socketio.emit(
            "arena_bingo_atualizado",
            {"id_sessao": id_sessao, "acao": "CONTROLE_ASSUMIDO"},
            to=_sala_socket(id_sessao),
        )
        return resultado

    return _executar(operacao)


@bp.route("/supervisor/dashboard", methods=["GET"])
@jwt_required()
def dashboard_supervisor():
    incluir = str(request.args.get("arquivadas") or "").lower() in {
        "1", "true", "sim",
    }
    return _executar(
        lambda: ArenaSupervisorService().obter_dashboard(
            get_jwt_identity(),
            incluir,
        )
    )


@bp.route("/supervisor/campanhas", methods=["GET"])
@jwt_required()
def listar_campanhas_supervisor():
    incluir = str(request.args.get("arquivadas") or "").lower() in {
        "1", "true", "sim",
    }
    return _executar(
        lambda: ArenaSupervisorService().listar_campanhas(
            get_jwt_identity(),
            incluir,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/arquivar",
    methods=["POST"],
)
@jwt_required()
def arquivar_campanha(id_campanha):
    return _executar(
        lambda: ArenaSupervisorService().arquivar_campanha(
            get_jwt_identity(),
            id_campanha,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/desarquivar",
    methods=["POST"],
)
@jwt_required()
def desarquivar_campanha(id_campanha):
    return _executar(
        lambda: ArenaSupervisorService().desarquivar_campanha(
            get_jwt_identity(),
            id_campanha,
        )
    )


@bp.route("/supervisor/campanhas", methods=["POST"])
@jwt_required()
def criar_campanha_supervisor():
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaSupervisorService().criar_campanha(
            get_jwt_identity(),
            dados,
        ),
        status=201,
    )


@bp.route("/supervisor/campanhas/<int:id_campanha>", methods=["GET"])
@jwt_required()
def obter_campanha_supervisor(id_campanha):
    return _executar(
        lambda: ArenaSupervisorService().obter_campanha(
            get_jwt_identity(),
            id_campanha,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/quiz",
    methods=["GET"],
)
@jwt_required()
def obter_quiz_supervisor(id_campanha):
    return _executar(
        lambda: ArenaSupervisorService().obter_quiz(
            get_jwt_identity(),
            id_campanha,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/quiz",
    methods=["PUT"],
)
@jwt_required()
def salvar_quiz_supervisor(id_campanha):
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaSupervisorService().salvar_quiz(
            get_jwt_identity(),
            id_campanha,
            dados,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/bingo",
    methods=["GET"],
)
@jwt_required()
def obter_bingo_supervisor(id_campanha):
    return _executar(
        lambda: ArenaSupervisorService().obter_bingo(
            get_jwt_identity(),
            id_campanha,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/bingo",
    methods=["PUT"],
)
@jwt_required()
def salvar_bingo_supervisor(id_campanha):
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaSupervisorService().salvar_bingo(
            get_jwt_identity(),
            id_campanha,
            dados,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/quiz/sugestoes-ia",
    methods=["POST"],
)
@jwt_required()
def gerar_sugestoes_quiz_supervisor(id_campanha):
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaSupervisorService().gerar_sugestoes_quiz(
            get_jwt_identity(),
            id_campanha,
            dados,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/publico",
    methods=["PUT"],
)
@jwt_required()
def salvar_publico_campanha(id_campanha):
    dados = request.get_json() or {}
    return _executar(
        lambda: ArenaSupervisorService().salvar_publico(
            get_jwt_identity(),
            id_campanha,
            dados,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/publicar",
    methods=["POST"],
)
@jwt_required()
def publicar_campanha(id_campanha):
    return _executar(
        lambda: ArenaSupervisorService().publicar_campanha(
            get_jwt_identity(),
            id_campanha,
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/abrir-sala",
    methods=["POST"],
)
@jwt_required()
def abrir_sala(id_campanha):
    def operacao():
        cpf = str(get_jwt_identity())
        estado = ArenaSupervisorService().abrir_sala(
            cpf,
            id_campanha,
        )
        limite = datetime.fromisoformat(estado["limite_entrada_em"])
        agora = datetime.fromisoformat(estado["servidor_agora"])
        socketio.start_background_task(
            _iniciar_sessao_apos_prazo,
            current_app._get_current_object(),
            cpf,
            estado["id"],
            max(0, (limite - agora).total_seconds()),
        )
        return estado

    return _executar(operacao)


@bp.route(
    "/supervisor/sessoes/<int:id_sessao>/iniciar",
    methods=["POST"],
)
@jwt_required()
def iniciar_sessao(id_sessao):
    def operacao():
        estado = ArenaSupervisorService().iniciar_sessao(
            get_jwt_identity(),
            id_sessao,
        )
        socketio.emit("arena_estado", estado, to=_sala_socket(id_sessao))
        socketio.emit(
            "arena_sessao_iniciada",
            estado,
            to=_sala_socket(id_sessao),
        )
        if estado.get("tipo_jogo") == "QUIZ_AO_VIVO":
            socketio.start_background_task(
                _executar_quiz_ao_vivo,
                current_app._get_current_object(),
                id_sessao,
            )
        return estado

    return _executar(operacao)


@bp.route(
    "/supervisor/sessoes/<int:id_sessao>/participantes",
    methods=["POST"],
)
@jwt_required()
def adicionar_participantes_sessao(id_sessao):
    def operacao():
        estado = ArenaSupervisorService().adicionar_participantes(
            get_jwt_identity(),
            id_sessao,
            request.get_json() or {},
        )
        # Quem ja esta na sala ve a lista crescer na hora. Quem acabou de ser
        # convidado ainda nao esta nesta sala do socket — ele descobre pelo
        # hub da Arena, que passou a se atualizar sozinho.
        socketio.emit("arena_estado", estado, to=_sala_socket(id_sessao))
        return estado

    return _executar(operacao, 201)


@bp.route(
    "/supervisor/sessoes/<int:id_sessao>/fechar",
    methods=["POST"],
)
@jwt_required()
def fechar_sala_sessao(id_sessao):
    def operacao():
        resultado = ArenaSupervisorService().fechar_sala(
            get_jwt_identity(),
            id_sessao,
        )
        socketio.emit(
            "arena_sessao_cancelada",
            resultado,
            to=_sala_socket(id_sessao),
        )
        return resultado

    return _executar(operacao)


@bp.route(
    "/supervisor/sessoes/<int:id_sessao>/bingo/sortear",
    methods=["POST"],
)
@jwt_required()
def sortear_bingo(id_sessao):
    def operacao():
        estado = ArenaSupervisorService().sortear_bingo(
            get_jwt_identity(),
            id_sessao,
        )
        # O numero vai junto no evento. Antes o socket so avisava "saiu
        # numero" e cada operador disparava um GET proprio — com 20 pessoas na
        # sala eram 20 requisicoes simultaneas, cada uma com sua latencia, e
        # era dai que vinha a diferenca de quem via primeiro.
        ultimo = (estado.get("sorteios") or [{}])[0]
        socketio.emit(
            "arena_bingo_atualizado",
            {
                "id_sessao": id_sessao,
                "acao": "NUMERO_SORTEADO",
                "numero": ultimo.get("numero"),
                "letra": ultimo.get("letra"),
                "ordem": ultimo.get("ordem"),
            },
            to=_sala_socket(id_sessao),
        )
        return estado

    return _executar(operacao)


@bp.route(
    "/supervisor/sessoes/<int:id_sessao>/bingo/controle",
    methods=["POST"],
)
@jwt_required()
def controlar_bingo(id_sessao):
    def operacao():
        dados = request.get_json() or {}
        estado = ArenaSupervisorService().controlar_bingo(
            get_jwt_identity(), id_sessao, dados
        )
        socketio.emit(
            "arena_bingo_atualizado",
            {"id_sessao": id_sessao, "acao": dados.get("acao")},
            to=_sala_socket(id_sessao),
        )
        return estado

    return _executar(operacao)


@bp.route(
    "/supervisor/sessoes/<int:id_sessao>/bingo/desempate",
    methods=["POST"],
)
@jwt_required()
def sortear_desempate_bingo(id_sessao):
    def operacao():
        resultado = ArenaSupervisorService().sortear_desempate_bingo(
            get_jwt_identity(),
            id_sessao,
        )
        socketio.emit(
            "arena_bingo_atualizado",
            {"id_sessao": id_sessao, "acao": "DESEMPATE"},
            to=_sala_socket(id_sessao),
        )
        return resultado

    return _executar(operacao)


@bp.route(
    "/supervisor/sessoes/<int:id_sessao>/bingo/transferir",
    methods=["POST"],
)
@jwt_required()
def transferir_bingo(id_sessao):
    def operacao():
        resultado = ArenaSupervisorService().transferir_bingo(
            get_jwt_identity(), id_sessao, request.get_json() or {}
        )
        socketio.emit(
            "arena_bingo_atualizado",
            {"id_sessao": id_sessao, "acao": "CONTROLE_TRANSFERIDO"},
            to=_sala_socket(id_sessao),
        )
        return resultado

    return _executar(operacao)


@bp.route("/supervisor/centros-custo", methods=["GET"])
@jwt_required()
def listar_centros_custo_supervisor():
    return _executar(
        lambda: ArenaSupervisorService().listar_centros_custo(
            get_jwt_identity()
        )
    )


@bp.route("/supervisor/operadores", methods=["GET"])
@jwt_required()
def listar_operadores_supervisor():
    return _executar(
        lambda: ArenaSupervisorService().listar_operadores(
            get_jwt_identity(),
            request.args.get("centro_custo"),
            request.args.get("busca", ""),
            request.args.get("limite", 100),
        )
    )


@bp.route("/supervisor/equipes", methods=["GET"])
@jwt_required()
def listar_equipes_supervisor():
    return _executar(
        lambda: ArenaSupervisorService().listar_equipes(
            get_jwt_identity()
        )
    )


@bp.route(
    "/supervisor/campanhas/<int:id_campanha>/acompanhamento",
    methods=["GET"],
)
@jwt_required()
def obter_acompanhamento_campanha(id_campanha):
    return _executar(
        lambda: ArenaSupervisorService().obter_acompanhamento_resultado(
            get_jwt_identity(), id_campanha
        )
    )


@bp.route("/supervisor/supervisores", methods=["GET"])
@jwt_required()
def listar_supervisores_arena():
    return _executar(
        lambda: ArenaSupervisorService().listar_supervisores(
            get_jwt_identity(),
            request.args.get("busca"),
            request.args.get("limite", 20),
        )
    )


def _cpf_socket(data):
    token = str((data or {}).get("token") or "").strip()
    if not token:
        raise ArenaServiceError("Token da Arena não informado.", 401)
    try:
        return str(decode_token(token)["sub"])
    except Exception as erro:
        raise ArenaServiceError("Sessão da Arena inválida.", 401) from erro


@socketio.on("arena_inscrever_sessao")
def inscrever_sessao(data):
    try:
        cpf = _cpf_socket(data)
        id_sessao = int((data or {}).get("id_sessao"))
        estado = ArenaService().atualizar_conexao_sessao(
            cpf,
            id_sessao,
            True,
        )
        join_room(_sala_socket(id_sessao))
        socketio.emit("arena_estado", estado, to=_sala_socket(id_sessao))
        return {"status": "ok", "estado": estado}
    except ArenaServiceError as erro:
        return {"status": "erro", "erro": str(erro), "codigo": erro.status}
    except Exception:
        current_app.logger.exception("Erro ao inscrever na sala da Arena")
        return {"status": "erro", "erro": "Não foi possível entrar na sala."}


@socketio.on("arena_sair_sessao")
def sair_sessao(data):
    try:
        cpf = _cpf_socket(data)
        id_sessao = int((data or {}).get("id_sessao"))
        estado = ArenaService().atualizar_conexao_sessao(
            cpf,
            id_sessao,
            False,
        )
        leave_room(_sala_socket(id_sessao))
        socketio.emit("arena_estado", estado, to=_sala_socket(id_sessao))
        return {"status": "ok"}
    except Exception:
        return {"status": "erro"}


@socketio.on("arena_heartbeat")
def heartbeat_sessao(data):
    try:
        cpf = _cpf_socket(data)
        id_sessao = int((data or {}).get("id_sessao"))
        ArenaService().registrar_heartbeat(cpf, id_sessao)
        return {"status": "ok"}
    except Exception:
        return {"status": "erro"}
