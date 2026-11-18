from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.application.services.academia_service import (
    AcademiaAdminService,
    AcademiaService,
    AcademiaServiceError,
)


bp = Blueprint("Academia", __name__, url_prefix="/academia")


def _executar(operacao):
    try:
        return jsonify(operacao()), 200
    except AcademiaServiceError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro ao processar a Academia Aurora")
        return jsonify({
            "erro": "Não foi possível carregar a Academia Aurora."
        }), 500


@bp.route("/catalogo", methods=["GET"])
@jwt_required()
def listar_catalogo():
    return _executar(
        lambda: AcademiaService().listar_catalogo(get_jwt_identity())
    )


@bp.route("/meus-cursos", methods=["GET"])
@jwt_required()
def listar_meus_cursos():
    return _executar(
        lambda: AcademiaService().listar_meus_cursos(get_jwt_identity())
    )


@bp.route("/cursos/<int:id_curso>", methods=["GET"])
@jwt_required()
def obter_curso(id_curso):
    return _executar(
        lambda: AcademiaService().obter_curso(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/cursos/<int:id_curso>/matricula", methods=["POST"])
@jwt_required()
def matricular(id_curso):
    return _executar(
        lambda: AcademiaService().matricular(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/aulas/<int:id_aula>/progresso", methods=["PUT"])
@jwt_required()
def salvar_progresso(id_aula):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaService().salvar_progresso(
            get_jwt_identity(),
            id_aula,
            data.get("percentual", 0),
            data.get("concluida", False)
        )
    )


@bp.route("/aulas/<int:id_aula>/quiz", methods=["POST"])
@jwt_required()
def responder_quiz(id_aula):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaService().responder_quiz(
            get_jwt_identity(),
            id_aula,
            data.get("respostas") or {}
        )
    )


@bp.route("/aulas/<int:id_aula>/favorito", methods=["PATCH"])
@jwt_required()
def atualizar_favorito(id_aula):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaService().atualizar_favorito(
            get_jwt_identity(),
            id_aula,
            data.get("favorita", False)
        )
    )


@bp.route("/aulas/<int:id_aula>/anotacao", methods=["GET"])
@jwt_required()
def obter_anotacao(id_aula):
    return _executar(
        lambda: AcademiaService().obter_anotacao(
            get_jwt_identity(),
            id_aula
        )
    )


@bp.route("/aulas/<int:id_aula>/anotacao", methods=["PUT"])
@jwt_required()
def salvar_anotacao(id_aula):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaService().salvar_anotacao(
            get_jwt_identity(),
            id_aula,
            data.get("conteudo", "")
        )
    )


@bp.route("/materiais-salvos", methods=["GET"])
@jwt_required()
def listar_materiais_salvos():
    return _executar(
        lambda: AcademiaService().listar_materiais_salvos(
            get_jwt_identity()
        )
    )


@bp.route("/certificados", methods=["GET"])
@jwt_required()
def listar_certificados():
    return _executar(
        lambda: AcademiaService().listar_certificados(get_jwt_identity())
    )


@bp.route("/cursos/<int:id_curso>/certificado", methods=["POST"])
@jwt_required()
def emitir_certificado(id_curso):
    return _executar(
        lambda: AcademiaService().emitir_certificado(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/admin/centros-custo", methods=["GET"])
@jwt_required()
def listar_centros_custo_admin():
    return _executar(
        lambda: AcademiaAdminService().listar_centros_custo(
            get_jwt_identity()
        )
    )


@bp.route("/admin/cursos", methods=["GET"])
@jwt_required()
def listar_cursos_admin():
    return _executar(
        lambda: AcademiaAdminService().listar_cursos(get_jwt_identity())
    )


@bp.route("/admin/dashboard", methods=["GET"])
@jwt_required()
def obter_dashboard_admin():
    return _executar(
        lambda: AcademiaAdminService().obter_dashboard(
            get_jwt_identity()
        )
    )


@bp.route("/admin/cursos", methods=["POST"])
@jwt_required()
def criar_curso_admin():
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaAdminService().salvar_curso(
            get_jwt_identity(),
            data
        )
    )


@bp.route("/admin/cursos/<int:id_curso>", methods=["GET"])
@jwt_required()
def obter_curso_admin(id_curso):
    return _executar(
        lambda: AcademiaAdminService().obter_curso(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/admin/cursos/<int:id_curso>", methods=["PUT"])
@jwt_required()
def atualizar_curso_admin(id_curso):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaAdminService().salvar_curso(
            get_jwt_identity(),
            data,
            id_curso
        )
    )


@bp.route("/admin/cursos/<int:id_curso>", methods=["DELETE"])
@jwt_required()
def arquivar_curso_admin(id_curso):
    return _executar(
        lambda: AcademiaAdminService().arquivar(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/admin/cursos/<int:id_curso>/publicar", methods=["POST"])
@jwt_required()
def publicar_curso_admin(id_curso):
    return _executar(
        lambda: AcademiaAdminService().publicar(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/enviar-revisao",
    methods=["POST"]
)
@jwt_required()
def enviar_curso_para_revisao_admin(id_curso):
    return _executar(
        lambda: AcademiaAdminService().enviar_para_revisao(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/voltar-rascunho",
    methods=["POST"]
)
@jwt_required()
def voltar_curso_para_rascunho_admin(id_curso):
    return _executar(
        lambda: AcademiaAdminService().voltar_para_rascunho(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/admin/cursos/<int:id_curso>/atribuicoes", methods=["GET"])
@jwt_required()
def listar_atribuicoes_admin(id_curso):
    return _executar(
        lambda: AcademiaAdminService().listar_atribuicoes(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/admin/cursos/<int:id_curso>/atribuicoes", methods=["POST"])
@jwt_required()
def salvar_atribuicao_admin(id_curso):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaAdminService().salvar_atribuicao(
            get_jwt_identity(),
            id_curso,
            data
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/atribuicoes/<int:id_atribuicao>",
    methods=["DELETE"]
)
@jwt_required()
def remover_atribuicao_admin(id_curso, id_atribuicao):
    return _executar(
        lambda: AcademiaAdminService().remover_atribuicao(
            get_jwt_identity(),
            id_curso,
            id_atribuicao
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/atribuicoes/sincronizar",
    methods=["POST"]
)
@jwt_required()
def sincronizar_atribuicoes_admin(id_curso):
    return _executar(
        lambda: AcademiaAdminService().sincronizar_atribuicoes(
            get_jwt_identity(),
            id_curso
        )
    )


@bp.route("/admin/certificados/<codigo>", methods=["GET"])
@jwt_required()
def validar_certificado_admin(codigo):
    return _executar(
        lambda: AcademiaAdminService().validar_certificado(
            get_jwt_identity(),
            codigo
        )
    )


@bp.route("/admin/cursos/<int:id_curso>/modulos", methods=["POST"])
@jwt_required()
def criar_modulo_admin(id_curso):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaAdminService().salvar_modulo(
            get_jwt_identity(),
            id_curso,
            data
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/modulos/<int:id_modulo>",
    methods=["PUT"]
)
@jwt_required()
def atualizar_modulo_admin(id_curso, id_modulo):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaAdminService().salvar_modulo(
            get_jwt_identity(),
            id_curso,
            data,
            id_modulo
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/modulos/<int:id_modulo>",
    methods=["DELETE"]
)
@jwt_required()
def desativar_modulo_admin(id_curso, id_modulo):
    return _executar(
        lambda: AcademiaAdminService().desativar_modulo(
            get_jwt_identity(),
            id_curso,
            id_modulo
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/modulos/<int:id_modulo>/aulas",
    methods=["POST"]
)
@jwt_required()
def criar_aula_admin(id_curso, id_modulo):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaAdminService().salvar_aula(
            get_jwt_identity(),
            id_curso,
            id_modulo,
            data
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/modulos/<int:id_modulo>"
    "/aulas/<int:id_aula>",
    methods=["PUT"]
)
@jwt_required()
def atualizar_aula_admin(id_curso, id_modulo, id_aula):
    data = request.get_json() or {}
    return _executar(
        lambda: AcademiaAdminService().salvar_aula(
            get_jwt_identity(),
            id_curso,
            id_modulo,
            data,
            id_aula
        )
    )


@bp.route(
    "/admin/cursos/<int:id_curso>/modulos/<int:id_modulo>"
    "/aulas/<int:id_aula>",
    methods=["DELETE"]
)
@jwt_required()
def desativar_aula_admin(id_curso, id_modulo, id_aula):
    return _executar(
        lambda: AcademiaAdminService().desativar_aula(
            get_jwt_identity(),
            id_curso,
            id_modulo,
            id_aula
        )
    )
