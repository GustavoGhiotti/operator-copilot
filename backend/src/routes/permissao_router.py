from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.application.services.permissao_service import (
    PermissaoError,
    PermissaoService,
)
from src.middleware.permissoes import requer_area
from src.shared.utils.permissoes import normalizar_valor

bp = Blueprint("Permissoes", __name__, url_prefix="/permissoes")


def _executar(operacao, status_sucesso=200):
    try:
        return jsonify(operacao()), status_sucesso
    except PermissaoError as erro:
        return jsonify({"erro": str(erro)}), erro.status
    except Exception:
        current_app.logger.exception("Erro ao tratar permissoes de visao")
        return jsonify({
            "erro": "Nao foi possivel consultar as permissoes."
        }), 500


@bp.route("/minhas", methods=["GET"])
@jwt_required()
def minhas_areas():
    """Areas do usuario logado, sem exigir novo login.

    O login grava as areas no localStorage e elas ficam congeladas ate a pessoa
    sair -- uma concessao dada agora so valeria amanha. A home consulta esta
    rota na abertura para a sessao existente se corrigir sozinha.
    """
    def _minhas():
        servico = PermissaoService()
        cpf = get_jwt_identity()
        return {
            "areas": sorted(servico.areas_do_usuario(cpf)),
            # A tela precisa separar "nao tem" de "foi tirada": as regras
            # legadas do frontend sao `regra OU area` e reacenderiam o comando.
            "negadas": sorted(servico.areas_negadas(cpf)),
        }

    return _executar(_minhas)


@bp.route("/perfis", methods=["GET"])
@requer_area("acessos.gerenciar")
def listar_perfis():
    return _executar(lambda: {"perfis": PermissaoService().listar_perfis()})


@bp.route("/pessoas", methods=["GET"])
@requer_area("acessos.gerenciar")
def listar_pessoas():
    return _executar(
        lambda: PermissaoService().listar_pessoas({
            "busca": request.args.get("busca"),
            "perfil": request.args.get("perfil"),
            "somente_com_visao": request.args.get("somente_com_visao"),
            "pagina": request.args.get("pagina"),
            "tamanho": request.args.get("tamanho"),
        })
    )


@bp.route("/pessoas/<cpf>", methods=["GET"])
@requer_area("acessos.gerenciar")
def obter_pessoa(cpf):
    return _executar(lambda: PermissaoService().obter_pessoa(cpf))


@bp.route("/pessoas/<cpf>", methods=["PUT"])
@requer_area("acessos.gerenciar")
def definir_visao(cpf):
    corpo = request.get_json() or {}
    perfil = str(corpo.get("perfil") or "").strip()
    if not perfil:
        return jsonify({"erro": "Informe a visao."}), 400

    return _executar(
        lambda: PermissaoService().definir_perfil(
            cpf, perfil, str(get_jwt_identity() or "")
        )
    )


@bp.route("/pessoas/<cpf>", methods=["DELETE"])
@requer_area("acessos.gerenciar")
def remover_visao(cpf):
    """Devolve a pessoa ao padrao do cargo."""
    return _executar(lambda: PermissaoService().remover_perfil(cpf))


@bp.route("/pessoas/<cpf>/ajustes", methods=["PUT"])
@requer_area("acessos.gerenciar")
def definir_ajuste(cpf):
    corpo = request.get_json() or {}
    area = str(corpo.get("area") or "").strip()
    if not area:
        return jsonify({"erro": "Informe a area."}), 400

    # `concedida` ausente (ou null) apaga o ajuste: a area volta a acompanhar
    # o pacote da visao, que e diferente de negar explicitamente.
    concedida = corpo.get("concedida")
    if concedida is not None:
        concedida = bool(concedida)

    return _executar(
        lambda: PermissaoService().definir_ajuste(
            cpf, area, concedida, str(get_jwt_identity() or "")
        )
    )


@bp.route("/areas", methods=["GET"])
@requer_area("acessos.gerenciar")
def listar_areas():
    return _executar(
        lambda: {"areas": PermissaoService().repo.listar_areas()}
    )


@bp.route("/concessoes", methods=["GET"])
@requer_area("acessos.gerenciar")
def listar_concessoes():
    area = (request.args.get("area") or "").strip() or None
    return _executar(
        lambda: {"concessoes": PermissaoService().repo.listar_concessoes(area)}
    )


@bp.route("/valores", methods=["GET"])
@requer_area("acessos.gerenciar")
def listar_valores():
    """Valores que existem no cadastro, para a tela oferecer em vez de digitar."""
    tipo = (request.args.get("tipo") or "").strip().upper()
    return _executar(
        lambda: {
            "valores": [
                linha.get("VALOR")
                for linha in PermissaoService().repo.listar_valores_cadastrados(tipo)
            ]
        }
    )


@bp.route("/concessoes", methods=["POST"])
@requer_area("acessos.gerenciar")
def conceder():
    return _executar(lambda: _conceder(request.get_json() or {}), 201)


@bp.route("/concessoes/<int:id_permissao>", methods=["DELETE"])
@requer_area("acessos.gerenciar")
def revogar(id_permissao):
    return _executar(lambda: _revogar(id_permissao))


def _conceder(corpo):
    servico = PermissaoService()

    tipo = str(corpo.get("tipo") or "").strip().upper()
    if tipo not in {"FUNCAO", "CENTRO_CUSTO", "CPF"}:
        raise PermissaoError("Tipo invalido.", 400)

    # Normaliza aqui e nao no banco: o valor gravado precisa ser exatamente o
    # que o servico compara depois. Gravar "Gerencia Operacional" criaria uma
    # concessao que existe e nunca concede.
    valor = normalizar_valor(corpo.get("valor"))
    if not valor:
        raise PermissaoError("Informe o valor da concessao.", 400)

    area = str(corpo.get("area") or "").strip()
    areas_validas = {linha.get("AREA") for linha in servico.repo.listar_areas()}
    if area not in areas_validas:
        raise PermissaoError("Area desconhecida.", 400)

    servico.repo.conceder(
        tipo=tipo,
        valor=valor,
        area=area,
        criado_por=str(get_jwt_identity() or ""),
    )
    servico.invalidar_cache()

    return {"concedido": True, "tipo": tipo, "valor": valor, "area": area}


def _revogar(id_permissao):
    servico = PermissaoService()
    linhas = servico.repo.revogar(
        id_permissao=id_permissao,
        revogado_por=str(get_jwt_identity() or ""),
    )
    servico.invalidar_cache()

    if not linhas:
        raise PermissaoError("Concessao nao encontrada ou ja revogada.", 404)

    return {"revogado": True, "id_permissao": id_permissao}
