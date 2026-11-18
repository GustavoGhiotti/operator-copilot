from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import get_jwt_identity, jwt_required
from src.application.services.admin_service import *
from src.application.services.album_service import AlbumService


bp = Blueprint("Administrador",__name__,url_prefix="/supervisor")

@bp.route("/buscar_operadores",methods=["GET"])
@jwt_required()
def buscar_operadores():
    resultado = BuscarOperadoresService().executar()

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({
        "mensagem":"Dados do operador recuperados com sucesso",
        "operador":resultado
    }),200

# NAO colocar @requer_area("supervisao.operacao") aqui ainda.
#
# O supervisor alcanca @Ideal pela regra NEGATIVA do frontend ("todo mundo
# menos seis centros de custo"), e no banco essa area so foi concedida a
# gerencia. A guarda daria 403 para todos os supervisores no dia do deploy.
#
# Para fechar isto de verdade, a area precisa antes refletir quem de fato tem
# supervisao -- o que significa inverter a regra negativa em concessoes, e nao
# so decorar a rota.
@bp.route("/ideal-operadores",methods=["GET"])
@jwt_required()
def ideal_operadores():
    resultado = ListarIdealOperadoresService().executar()

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({
        "mensagem":"Dados do operador recuperados com sucesso",
        "operador":resultado
    }),200

@bp.route("/atualizar_meta",methods=["POST"])
@jwt_required()
def atualizar_meta():
    resultado = AtualizarMetaOperadorService().executar(
        data=request.get_json() or {},
        supervisor=get_jwt_identity()
    )

    if isinstance(resultado,tuple):
        return resultado

    return jsonify(resultado),200

# Esta rota expunha o desempenho de qualquer equipe sem exigir token nenhum --
# bastava conhecer o nome de um supervisor. Mesma classe do furo que havia no
# /auth/change-password.
@bp.route("/supervisao_operadores",methods=["POST"])
@jwt_required()
def supervisao_operadores():
    resultado = SupervisaoOperadoresService().executar(request.get_json() or {})

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({
        "mensagem":"Operadores supervisionados recuperados com sucesso",
        "dados":resultado
    }),200

@bp.route("/resumo_operador_dia",methods=["POST"])
def resumo_operador_dia():
    resultado = ResumoOperadorDiaService().executar(request.get_json() or {})

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({
        "mensagem":"Resumo diÃ¡rio dos operadores do supervisor recuperado com sucesso",
        "resumo":resultado
    }),200

@bp.route("/tabulacoes_operador",methods=["POST"])
def tabulacoes_operador():
    resultado = TabulacoesOperadorService().executar(request.get_json() or {})

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({
        "mensagem":"TabulaÃ§Ãµes carregadas com sucesso",
        "dados":resultado
    }),200

@bp.route("/atividade_recente_operador",methods=["POST"])
def atividade_recente_operador():
    resultado = AtividadeRecenteService().executar(request.get_json() or {})

    if isinstance(resultado,tuple):
        return resultado

    return jsonify({
        "mensagem":"Ãšltimas atividades carregadas com sucesso",
        "dados":resultado
    }),200


@bp.route("/copa-metas/configuracao", methods=["GET"])
@jwt_required()
def obter_configuracao_copa():
    try:
        resultado = AlbumService().obter_configuracao_supervisor(str(get_jwt_identity()))
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 404
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500
    except Exception as e:
        return jsonify({"erro": "Erro ao carregar configuração de metas da Copa", "detalhes": str(e)}), 500


@bp.route("/copa-metas/operador/<cpf_operador>", methods=["GET"])
@jwt_required()
def obter_configuracao_copa_operador(cpf_operador: str):
    try:
        resultado = AlbumService().obter_configuracao_operador(
            str(get_jwt_identity()),
            cpf_operador,
        )
        return jsonify(resultado), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 404
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500
    except Exception as e:
        return jsonify({"erro": "Erro ao carregar metas do operador", "detalhes": str(e)}), 500


@bp.route("/copa-metas/configuracao-global", methods=["PUT"])
@jwt_required()
def salvar_configuracao_global_copa():
    try:
        resultado = AlbumService().salvar_configuracao_global(
            str(get_jwt_identity()),
            request.get_json() or {},
        )
        return jsonify({
            "mensagem": "Configuração global das metas da Copa atualizada com sucesso",
            "dados": resultado,
        }), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500
    except Exception as e:
        return jsonify({"erro": "Erro ao salvar configuração global da Copa", "detalhes": str(e)}), 500


@bp.route("/copa-metas/operador/<cpf_operador>", methods=["PUT"])
@jwt_required()
def salvar_configuracao_operador_copa(cpf_operador: str):
    try:
        resultado = AlbumService().salvar_configuracao_operador(
            str(get_jwt_identity()),
            cpf_operador,
            request.get_json() or {},
        )
        return jsonify({
            "mensagem": "Configuração do operador atualizada com sucesso",
            "dados": resultado,
        }), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500
    except Exception as e:
        return jsonify({"erro": "Erro ao salvar configuração do operador", "detalhes": str(e)}), 500


@bp.route("/copa-metas/campanhas", methods=["POST"])
@jwt_required()
def criar_campanha_copa():
    try:
        resultado = AlbumService().criar_campanha_supervisor(
            str(get_jwt_identity()),
            request.get_json() or {},
        )
        return jsonify({
            "mensagem": "Campanha criada e premiação enviada com sucesso",
            "dados": resultado,
        }), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"erro": str(e)}), 500
    except Exception as e:
        return jsonify({"erro": "Erro ao criar campanha da Copa", "detalhes": str(e)}), 500
