from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.application.services.tarefas_kanban_service import (
    TarefasKanbanError,
    TarefasKanbanService,
)

bp = Blueprint("Todos",__name__,url_prefix="/todos")


def _executar_kanban(operacao, status_sucesso=200):
    try:
        return jsonify(operacao()), status_sucesso
    except TarefasKanbanError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro ao processar o quadro de tarefas")
        return jsonify({
            "erro": "Não foi possível processar o quadro de tarefas."
        }), 500

@bp.route("",methods=["GET"])
@jwt_required()
def listar_todos():
    return _executar_kanban(
        lambda: TarefasKanbanService().carregar_quadro(
            get_jwt_identity(),
            "pessoal"
        )["tarefas"]
    )

@bp.route("",methods=["POST"])
@jwt_required()
def criar_todo():
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().criar_tarefa(
            get_jwt_identity(),
            data
        ),
        201
    )

@bp.route("/<int:id>",methods=["PUT"])
@jwt_required()
def atualizar(id: int):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().atualizar_tarefa(
            get_jwt_identity(),
            id,
            data
        )
    )

@bp.route("/<int:id>/status",methods=["PUT"])
@jwt_required()
def atualizar_status(id: int):
    data = request.get_json() or {}
    status = data.get("status")
    if status == "pendente":
        status = "caixa_entrada"
    return _executar_kanban(
        lambda: TarefasKanbanService().mover_tarefa(
            get_jwt_identity(),
            id,
            status
        )
    )

@bp.route("/<int:id>",methods=["DELETE"])
@jwt_required()
def excluir(id: int):
    return _executar_kanban(
        lambda: TarefasKanbanService().arquivar_tarefa(
            get_jwt_identity(),
            id
        )
    )


@bp.route("/v2/board", methods=["GET"])
@jwt_required()
def carregar_quadro_kanban():
    return _executar_kanban(
        lambda: TarefasKanbanService().carregar_quadro(
            get_jwt_identity(),
            request.args.get("visao", "pessoal"),
            request.args.get("equipe_id"),
            request.args.get("quadro_id")
        )
    )


@bp.route("/v2/management-overview", methods=["GET"])
@jwt_required()
def obter_central_gerencial():
    return _executar_kanban(
        lambda: TarefasKanbanService().obter_central_gerencial(
            get_jwt_identity(),
            request.args.get("periodo", "30"),
            request.args.get("centro_custo"),
        )
    )


@bp.route("/v2/usage-events", methods=["POST"])
@jwt_required()
def registrar_uso_copilot():
    return _executar_kanban(
        lambda: TarefasKanbanService().registrar_uso_copilot(
            get_jwt_identity(),
            request.get_json() or {},
        ),
        201,
    )


@bp.route("/v2/tasks", methods=["POST"])
@jwt_required()
def criar_tarefa_kanban():
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().criar_tarefa(
            get_jwt_identity(),
            data
        ),
        201
    )


@bp.route("/v2/tasks/<int:id_todo>", methods=["PUT"])
@jwt_required()
def atualizar_tarefa_kanban(id_todo):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().atualizar_tarefa(
            get_jwt_identity(),
            id_todo,
            data
        )
    )


@bp.route("/v2/tasks/<int:id_todo>/move", methods=["PATCH"])
@jwt_required()
def mover_tarefa_kanban(id_todo):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().mover_tarefa(
            get_jwt_identity(),
            id_todo,
            str(data.get("status") or ""),
            data.get("ordem", 0),
            data.get("lista_id")
        )
    )


@bp.route("/v2/tasks/<int:id_todo>/schedule", methods=["PATCH"])
@jwt_required()
def reagendar_tarefa_kanban(id_todo):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().reagendar_tarefa(
            get_jwt_identity(),
            id_todo,
            data.get("data_vencimento"),
            data.get("hora_vencimento"),
        )
    )


@bp.route("/v2/tasks/<int:id_todo>/checklist", methods=["PATCH"])
@jwt_required()
def atualizar_checklist_kanban(id_todo):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().atualizar_checklist(
            get_jwt_identity(),
            id_todo,
            data.get("checklist")
        )
    )


@bp.route("/v2/tasks/<int:id_todo>/details", methods=["GET"])
@jwt_required()
def obter_detalhes_tarefa_kanban(id_todo):
    return _executar_kanban(
        lambda: TarefasKanbanService().obter_detalhes(
            get_jwt_identity(),
            id_todo
        )
    )


@bp.route("/v2/tasks/<int:id_todo>/comments", methods=["POST"])
@jwt_required()
def adicionar_comentario_tarefa_kanban(id_todo):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().adicionar_comentario(
            get_jwt_identity(),
            id_todo,
            data.get("conteudo")
        ),
        201
    )


@bp.route("/v2/tasks/<int:id_todo>/attachments", methods=["POST"])
@jwt_required()
def adicionar_anexo_tarefa_kanban(id_todo):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().adicionar_anexo(
            get_jwt_identity(),
            id_todo,
            data
        ),
        201
    )


@bp.route("/v2/tasks/<int:id_todo>/automation", methods=["PATCH"])
@jwt_required()
def atualizar_automacao_tarefa_kanban(id_todo):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().atualizar_automacao(
            get_jwt_identity(),
            id_todo,
            data.get("ativa") is True
        )
    )


@bp.route("/v2/notifications", methods=["GET"])
@jwt_required()
def listar_notificacoes_tarefas():
    return _executar_kanban(
        lambda: TarefasKanbanService().listar_notificacoes(
            get_jwt_identity()
        )
    )


@bp.route("/v2/notifications/read", methods=["PATCH"])
@jwt_required()
def marcar_notificacoes_tarefas_lidas():
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().marcar_notificacoes_lidas(
            get_jwt_identity(),
            data.get("id"),
        )
    )


@bp.route("/v2/notifications/dispatch", methods=["POST"])
@jwt_required()
def despachar_lembretes_tarefas():
    """Feito para ser chamado por um agendador (SQL Agent, cron)."""
    return _executar_kanban(
        lambda: TarefasKanbanService().despachar_lembretes(
            get_jwt_identity()
        )
    )


@bp.route("/v2/boards/<string:quadro_id>/members", methods=["GET"])
@jwt_required()
def listar_membros_quadro_kanban(quadro_id):
    return _executar_kanban(
        lambda: TarefasKanbanService().listar_membros_quadro(
            get_jwt_identity(),
            quadro_id
        )
    )


@bp.route("/v2/boards/<string:quadro_id>/members", methods=["POST"])
@jwt_required()
def definir_membro_quadro_kanban(quadro_id):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().definir_membro_quadro(
            get_jwt_identity(),
            quadro_id,
            data.get("cpf"),
            data.get("papel")
        ),
        201
    )


@bp.route(
    "/v2/boards/<string:quadro_id>/members/<string:membro_cpf>",
    methods=["DELETE"]
)
@jwt_required()
def remover_membro_quadro_kanban(quadro_id, membro_cpf):
    return _executar_kanban(
        lambda: TarefasKanbanService().remover_membro_quadro(
            get_jwt_identity(),
            quadro_id,
            membro_cpf
        )
    )


@bp.route("/v2/tasks/<int:id_todo>", methods=["DELETE"])
@jwt_required()
def arquivar_tarefa_kanban(id_todo):
    return _executar_kanban(
        lambda: TarefasKanbanService().arquivar_tarefa(
            get_jwt_identity(),
            id_todo
        )
    )


@bp.route("/v2/teams", methods=["POST"])
@jwt_required()
def criar_equipe_kanban():
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().criar_equipe(
            get_jwt_identity(),
            data
        ),
        201
    )


@bp.route("/v2/operators", methods=["GET"])
@jwt_required()
def pesquisar_operadores_kanban():
    return _executar_kanban(
        lambda: TarefasKanbanService().pesquisar_operadores(
            get_jwt_identity(),
            request.args.get("nome"),
            request.args.get("centro_custo")
        )
    )


@bp.route("/v2/teams/<string:equipe_id>/invites", methods=["POST"])
@jwt_required()
def enviar_convites_kanban(equipe_id):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().enviar_convites(
            get_jwt_identity(),
            equipe_id,
            data.get("cpfs")
        )
    )


@bp.route("/v2/invites/<string:equipe_id>", methods=["PATCH"])
@jwt_required()
def responder_convite_kanban(equipe_id):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().responder_convite(
            get_jwt_identity(),
            equipe_id,
            data.get("aceitar") is True
        )
    )


@bp.route("/v2/teams/<string:equipe_id>/members", methods=["GET"])
@jwt_required()
def listar_membros_kanban(equipe_id):
    return _executar_kanban(
        lambda: TarefasKanbanService().listar_membros(
            get_jwt_identity(),
            equipe_id
        )
    )


@bp.route(
    "/v2/teams/<string:equipe_id>/members/<string:membro_cpf>",
    methods=["DELETE"]
)
@jwt_required()
def remover_membro_kanban(equipe_id, membro_cpf):
    return _executar_kanban(
        lambda: TarefasKanbanService().remover_membro(
            get_jwt_identity(),
            equipe_id,
            membro_cpf
        )
    )


@bp.route("/v2/boards", methods=["POST"])
@jwt_required()
def criar_quadro_pessoal_kanban():
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().criar_quadro_pessoal(
            get_jwt_identity(),
            data
        ),
        201
    )


@bp.route("/v2/boards/<string:quadro_id>/lists", methods=["POST"])
@jwt_required()
def criar_lista_kanban(quadro_id):
    data = request.get_json() or {}
    return _executar_kanban(
        lambda: TarefasKanbanService().criar_lista(
            get_jwt_identity(),
            quadro_id,
            data
        ),
        201
    )

