from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import decode_token, get_jwt_identity, jwt_required
import json
import hmac
import hashlib
import eventlet

from src.shared.utils.env_load import *
from src.application.use_cases.mensagem_whatsapp.receber_mensagem_whatsapp_use_case import (
    ReceberMensagemWhatsappUseCase
)
from src.application.use_cases.mensagem_whatsapp.receber_status_mensagem_whatsapp_use_case import (
    ReceberStatusMensagemWhatsapp
)
from src.application.use_cases.mensagem_whatsapp.enviar_mensagem_whatsapp_use_case import (
    EnviarMensagemWhatsappUseCase
)
from src.application.use_cases.mensagem_whatsapp.iniciar_atendimento_whatsapp_use_case import (
    IniciarAtendimentoWhatsappUseCase
)
from src.application.use_cases.mensagem_whatsapp.listar_dashboard_carteira_use_case import (
    ListarDashboardCarteiraUseCase
)
from src.application.use_cases.mensagem_whatsapp.finalizar_atendimento_whatsapp_use_case import (
    FinalizarAtendimentoWhatsappUseCase
)
from src.application.use_cases.mensagem_whatsapp.trasnferir_atendimento_use_case import (
    TransferirAtendimentoUseCase
)
from src.application.use_cases.mensagem_whatsapp.reabrir_conversa_use_case import (
    ReabrirConversaUseCase
)
from src.application.use_cases.mensagem_whatsapp.encerrar_atendimento_supervisor_use_case import (
    EncerrarAtendimentoSupervisorUseCase
)
from src.application.use_cases.mensagem_whatsapp.validacao_estado_operacional import (
    MonitoriaBusinessError,
)
from src.infrastructure.repositories.sql_monitoria_whatsapp_repository import (
    SqlMonitoriaWhatsappRepository,
    MonitoriaInfraError,
)
from src.shared.utils.monitoria_permissoes import resolver_perfil_monitoria

bp = Blueprint(
    "bp",
    __name__,
    url_prefix="/monitoria-whatsapp"
)

# =========================================================
# SEGURANCA
# =========================================================

def _validar_assinatura_meta(req) -> bool:
    """
    Validação da assinatura do webhook da Meta
    """
    app_secret = APP_SECRET
    assinatura = req.headers.get("X-Hub-Signature-256", "")

    if not app_secret or not assinatura:
        return False

    corpo = req.get_data()
    hash_esperado = "sha256=" + hmac.new(
        app_secret.encode(),
        corpo,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(hash_esperado, assinatura)

def _validar_token_interno(req) -> bool:
    token_interno = COPILOT_META_WEBHOOK_TOKEN
    token_recebido = req.headers.get("X-Internal-Token", "")

    if not token_interno or not token_recebido:
        return False

    return hmac.compare_digest(token_recebido, token_interno)

# =========================================================
# USUARIO MONITORIA
# =========================================================

def _carregar_usuario_monitoria(repo, cpf: str, acesso: str = "monitoria") -> dict:
    if not cpf:
        raise PermissionError("Usuário não identificado.")

    usuario = repo.obter_usuario_ativo_por_cpf(cpf)
    if not usuario:
        raise PermissionError("Usuário não encontrado ou inativo.")

    centro_custo = usuario.get("CENTRO_CUSTO")
    perfil = resolver_perfil_monitoria(usuario.get("FUNCAO_COLABORADOR"))
    carteira = None

    if perfil == "OPERADOR":
        carteira = repo.obter_carteira_por_centro_custo(
            centro_custo,
            somente_whatsapp=True
        )
    elif perfil == "SUPERVISOR":
        carteira = repo.obter_carteira_por_centro_custo(
            centro_custo,
            somente_whatsapp=False
        )

    if acesso == "operador" and perfil != "OPERADOR":
        raise PermissionError("Acesso permitido apenas para operadores do WhatsApp.")

    if acesso == "supervisor" and perfil != "SUPERVISOR":
        raise PermissionError("Acesso permitido apenas para supervisores.")
    if not carteira:
        raise PermissionError("Carteira nÃ£o habilitada para WhatsApp.")

    return {
        "cpf": usuario["CPF_COLABORADOR"],
        "nome": usuario["NM_COLABORADOR"],
        "funcao": usuario.get("FUNCAO_COLABORADOR"),
        "centro_custo": centro_custo,
        "carteira": carteira,
        "perfil_monitoria": perfil,
        "pode_operador_whatsapp": perfil == "OPERADOR",
        "pode_monitoria_whatsapp": perfil == "SUPERVISOR"
    }

def _obter_usuario_monitoria(repo, acesso: str = "monitoria") -> dict:
    return _carregar_usuario_monitoria(repo, get_jwt_identity(), acesso)

def _obter_usuario_monitoria_sse(repo) -> dict:
    token = request.args.get("token", "")
    if not token:
        raise PermissionError("Token não informado.")

    try:
        payload = decode_token(token)
    except Exception as exc:
        raise PermissionError("Token inválido.") from exc

    return _carregar_usuario_monitoria(repo, payload.get("sub"), "monitoria")

def _usuario_pode_visualizar_conversa(repo, usuario: dict, conversa: dict | None) -> bool:
    if not conversa:
        return False

    carteira_conversa = repo.obter_carteira_por_numero_empresa(conversa["NUMERO_EMPRESA"])
    if carteira_conversa != usuario["carteira"]:
        return False

    if usuario["perfil_monitoria"] == "SUPERVISOR":
        return True

    return (
        conversa.get("STATUS_CONVERSA") == "ABERTA"
        or conversa.get("CPF_OPERADOR_ATUAL") == usuario["cpf"]
    )


def _resposta_erro_negocio(exc: MonitoriaBusinessError):
    erro = getattr(exc, "erro", "ATENDIMENTO_NAO_PERMITIDO")
    codigo = getattr(exc, "codigo", None)
    status_http = getattr(exc, "status_http", 409)

    payload = {
        "erro": erro,
        "mensagem": str(exc)
    }

    if codigo:
        payload["codigo"] = codigo

    return jsonify(payload), status_http


def _resposta_erro_infra_monitoria(exc: MonitoriaInfraError):
    return jsonify({
        "erro": "FALHA_CONSULTA_MONITORIA",
        "mensagem": exc.mensagem,
        "codigo": exc.codigo,
    }), 500

# =========================================================
# WEBHOOK META
# =========================================================

@bp.route("/webhook/meta", methods=["POST"])
def receber_webhook_meta():
    if not _validar_token_interno(request):
        return jsonify({"erro": "Acesso interno inválido"}), 403

    if not _validar_assinatura_meta(request):
        return jsonify({"erro": "Assinatura Meta inválida"}), 403

    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON inválido"}), 400
    if not isinstance(payload, dict):
        return jsonify({"erro": "Payload inválido"}), 400

    try:
        repo = SqlMonitoriaWhatsappRepository()
        request_id = request.headers.get("X-Request-ID", "")

        entries = payload.get("entry") or []
        if not entries:
            return jsonify({
                "ok": True,
                "ignorado": True,
                "request_id": request_id
            }), 200

        total_mensagens = 0
        total_status = 0

        for entry in entries:
            changes = entry.get("changes") or []
            for change in changes:
                if (change or {}).get("field") != "messages":
                    continue

                value = (change or {}).get("value") or {}
                if not value:
                    continue

                metadata = value.get("metadata") or {}
                id_conta_whatsapp = metadata.get("phone_number_id")
                numero_destino = metadata.get("display_phone_number")

                if not id_conta_whatsapp:
                    continue

                mensagens = value.get("messages") or []
                statuses = value.get("statuses") or []

                if mensagens:
                    use_case = ReceberMensagemWhatsappUseCase(repo)

                    for msg in mensagens:
                        id_mensagem = msg.get("id")
                        numero_origem = msg.get("from")
                        timestamp = msg.get("timestamp")

                        if not id_mensagem or not numero_origem or not timestamp:
                            continue

                        use_case.executar({
                            "id_mensagem_provedor": id_mensagem,
                            "id_conta_whatsapp": id_conta_whatsapp,
                            "numero_origem": numero_origem,
                            "numero_destino": numero_destino,
                            "conteudo": msg.get("text", {}).get("body", ""),
                            "timestamp": timestamp
                        })
                        total_mensagens += 1

                if statuses:
                    use_case_status = ReceberStatusMensagemWhatsapp(repo)

                    for st in statuses:
                        id_mensagem = st.get("id")
                        novo_status = st.get("status")
                        timestamp = st.get("timestamp")

                        if not id_mensagem or not novo_status or not timestamp:
                            continue

                        erro_code = None
                        erro_msg = None

                        errors = st.get("errors") or []
                        if errors and isinstance(errors, list):
                            primeiro = errors[0] or {}
                            erro_code = primeiro.get("code")
                            erro_msg = (
                                primeiro.get("title")
                                or primeiro.get("message")
                                or primeiro.get("details")
                                or (primeiro.get("error_data") or {}).get("details")
                            )

                        use_case_status.executar({
                            "id_mensagem_provedor": id_mensagem,
                            "novo_status": novo_status,
                            "timestamp": timestamp,
                            "error_code": erro_code,
                            "error_message": erro_msg
                        })
                        total_status += 1

        return jsonify({
            "ok": True,
            "request_id": request_id,
            "entries": len(entries),
            "mensagens_processadas": total_mensagens,
            "status_processados": total_status
        }), 200

    except MonitoriaInfraError as exc:
        return _resposta_erro_infra_monitoria(exc)

    except Exception as e:
        return jsonify({
            "erro": "FALHA_PROCESSAMENTO_WEBHOOK",
            "mensagem": str(e)
        }), 500
# =========================================================
# OPERADOR
# =========================================================

@bp.route("/enviar", methods=["POST"])
@jwt_required()
def enviar_mensagem():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON inválido"}), 400

    campos_obrigatorios = ["numero_cliente", "conteudo"]

    for campo in campos_obrigatorios:
        if not payload.get(campo):
            return jsonify({"erro": f"Campo obrigatorio ausente: {campo}"}), 400

    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "operador")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    payload["cpf_operador"] = usuario["cpf"]
    payload["nome_operador"] = usuario["nome"]

    use_case = EnviarMensagemWhatsappUseCase(repo)

    try:
        resultado = use_case.executar(payload)
        return jsonify(resultado), 200
    
    except MonitoriaBusinessError as e:
        return _resposta_erro_negocio(e)
    
    except PermissionError as e:
        return jsonify({
            "erro": "CONVERSA_EM_ATENDIMENTO",
            "mensagem": str(e)
        }), 409
    
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    
@bp.route("/iniciar-atendimento", methods=["POST"])
@jwt_required()
def inicar_atendimento():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON inválido"}), 400
    
    campos_obrigatorios = ["numero_empresa", "numero_cliente"]

    for campo in campos_obrigatorios:
        if not payload.get(campo):
            return jsonify({"erro": f"Campo obrigatorio ausente: {campo}"}), 400
        
    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "operador")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    payload["cpf_operador"] = usuario["cpf"]
    payload["nome_operador"] = usuario["nome"]

    use_case = IniciarAtendimentoWhatsappUseCase(repo)

    try:
        resultado = use_case.executar(payload)
        return jsonify(resultado), 200
    
    except MonitoriaBusinessError as e:
        return _resposta_erro_negocio(e)
    
    except PermissionError as e:
        return jsonify ({
            "erro": "ATENDIMENTO_NAO_PERMITIDO",
            "mensagem": str(e)
        }), 409
    
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    
@bp.route("/assumir-conversa", methods=["POST"])
@jwt_required()
def assumir_conversa():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON invalido"}), 400
    
    campos = ["id_conversa"]

    for c in campos:
        if not payload.get(c):
            return jsonify({"erro": f"Campo obrigatorio: {c}"}), 400
        
    repo = SqlMonitoriaWhatsappRepository()

    try:
        usuario = _obter_usuario_monitoria(repo, "operador")

        if not repo.operador_pode_atender_conversa(
            id_conversa=payload["id_conversa"],
            carteira_operador=usuario["carteira"]
        ):
            return jsonify({"erro": "ACESSO_NEGADO_CARTEIRA"}), 403

        conversa = repo.obter_conversa_por_id(payload["id_conversa"])
        if not conversa:
            return jsonify({"erro": "CONVERSA_NAO_ENCONTRADA"}), 404

        payload_iniciar = {
            "numero_empresa": conversa["NUMERO_EMPRESA"],
            "numero_cliente": conversa["NUMERO_CLIENTE"],
            "cpf_operador": usuario["cpf"],
            "nome_operador": usuario["nome"]
        }

        use_case = IniciarAtendimentoWhatsappUseCase(repo)
        resultado = use_case.executar(payload_iniciar)
        return jsonify(resultado), 200

    except MonitoriaBusinessError as e:
        return _resposta_erro_negocio(e)

    except PermissionError as e:
        return jsonify({
            "erro": "ATENDIMENTO_NAO_PERMITIDO",
            "mensagem": str(e)
        }), 409

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# =========================================================
# CONVERSAS
# =========================================================

@bp.route("/conversas", methods=["GET"])
@jwt_required()
def listar_conversas():
    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "monitoria")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    try:
        resultados = repo.listar_conversas_detalhadas_por_carteira(
            carteira=usuario["carteira"],
            cpf_operador=usuario["cpf"],
            somente_abertas_ou_minhas=usuario["perfil_monitoria"] == "OPERADOR"
        )
    except MonitoriaInfraError as e:
        return _resposta_erro_infra_monitoria(e)

    conversas = []

    for r in resultados:
        sla_status = r.get("SLA_STATUS", "OK")

        conversas.append({
            "id": str(r["ID_CONVERSA"]),
            "status": r["STATUS_CONVERSA"],
            "clienteNome": r["NUMERO_CLIENTE"],
            "clienteTelefone": r["NUMERO_CLIENTE"],
            "numeroEmpresa": r["NUMERO_EMPRESA"],
            "operadorNome": r["NOME_OPERADOR_ATUAL"],
            "ultimaMensagem": r["ULTIMA_MENSAGEM"],
            "direcaoUltimaMensagem": (
                r.get("ULTIMA_MENSAGEM_DIRECAO")
                or r["DIRECAO_ULTIMA_MENSAGEM"]
            ),
            "ultimaMensagemEm": r["DATA_ULTIMA_MENSAGEM"],
            "atualizadoEm": r["DATA_ULTIMA_MENSAGEM"],
            "foraSLA": sla_status in ["ATENCAO", "CRITICO"],
            "slaStatus": sla_status
        })

    return jsonify(conversas), 200

# =========================================================
# ATENDIMENTO
# =========================================================

@bp.route("/finalizar-atendimento", methods=["POST"])
@jwt_required()
def finalizar_atendimento():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON inválido"}), 400

    campos_obrigatorios = ["id_conversa"]

    for campo in campos_obrigatorios:
        if not payload.get(campo):
            return jsonify({"erro": f"Campo obrigatorio ausente: {campo}"}), 400

    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "operador")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    payload["cpf_operador"] = usuario["cpf"]
    payload["nome_operador"] = usuario["nome"]

    use_case = FinalizarAtendimentoWhatsappUseCase(repo)

    try:
        resultado = use_case.executar(payload)
        return jsonify(resultado), 200

    except MonitoriaBusinessError as e:
        return _resposta_erro_negocio(e)

    except PermissionError as e:
        return jsonify({"erro": str(e)}), 409

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@bp.route("/conversas/<int:id_conversa>/mensagens", methods=["GET"])
@jwt_required()
def listar_mensagens_conversa(id_conversa):
    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "monitoria")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    conversa = repo.obter_conversa_por_id(id_conversa)
    if not conversa:
        return jsonify({"erro": "CONVERSA_NAO_ENCONTRADA"}), 404

    if not _usuario_pode_visualizar_conversa(repo, usuario, conversa):
        return jsonify({"erro": "ACESSO_NEGADO_CONVERSA"}), 403

    try:
        mensagens = repo.listar_mensagens_por_conversa(id_conversa)
    except MonitoriaInfraError as e:
        return _resposta_erro_infra_monitoria(e)

    return jsonify(mensagens), 200

@bp.route("/operadores-disponiveis", methods=["GET"])
@jwt_required()
def listar_operadores_disponiveis():
    repo = SqlMonitoriaWhatsappRepository()

    try:
        usuario = _obter_usuario_monitoria(repo, "supervisor")
        operadores = repo.listar_operadores_monitoria_por_carteira(usuario["carteira"])
        return jsonify([
            {
                "cpf": operador["CPF_COLABORADOR"],
                "nome": operador["NM_COLABORADOR"],
                "funcao": operador["FUNCAO_COLABORADOR"],
                "centro_custo": operador["CENTRO_CUSTO"],
            }
            for operador in operadores
        ]), 200
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403
    except MonitoriaInfraError as e:
        return _resposta_erro_infra_monitoria(e)
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
     
# =========================================================
# DASHBOARD E METRICAS
# =========================================================

@bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard_carteira():
    cpf_usuario = request.args.get("cpf_usuario") or get_jwt_identity()
    if not cpf_usuario:
        return jsonify({"erro": "cpf_usuario Ã© obrigatÃ³rio"}), 400
    
    repo = SqlMonitoriaWhatsappRepository()
    use_case = ListarDashboardCarteiraUseCase(repo)

    try:
        usuario = _obter_usuario_monitoria(repo, "supervisor")
        resultado = use_case.executar(usuario["cpf"])
        return jsonify(resultado), 200
    
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403
    
    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# =========================================================
# GESTAO SUPERVISOR
# =========================================================

@bp.route("/transferir", methods=["POST"])
@jwt_required()
def transferir_conversa():

    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON invalido"}), 400

    campos = [
        "id_conversa",
        "cpf_destino",
        "nome_destino"
    ]

    for c in campos:
        if not payload.get(c):
            return jsonify({"erro": f"Campo obrigatorio: {c}"}), 400
        
    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "supervisor")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    payload["cpf_solicitante"] = usuario["cpf"]
    payload["nome_solicitante"] = usuario["nome"]

    use_case = TransferirAtendimentoUseCase(repo)

    try:
        result = use_case.executar(payload)
        return jsonify(result), 200

    except MonitoriaBusinessError as e:
        return _resposta_erro_negocio(e)
    
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403
    
    except Exception as e:
        return jsonify({"erro": str(e)}), 500
    
@bp.route("/reabrir", methods=["POST"])
@jwt_required()
def reabrir_conversa():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON invalido"}), 400

    campos_obrigatorios = ["id_conversa"]

    for campo in campos_obrigatorios:
        if not payload.get(campo):
            return jsonify({"erro": f"Campo obrigatorio ausente: {campo}"}), 400

    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "supervisor")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    payload["cpf_supervisor"] = usuario["cpf"]
    payload["nome_supervisor"] = usuario["nome"]

    use_case = ReabrirConversaUseCase(repo)

    try:
        resultado = use_case.executar(payload)
        return jsonify(resultado), 200

    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

@bp.route("/encerrar-supervisor", methods=["POST"])
@jwt_required()
def encerrar_supervisor():
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"erro": "JSON invalido"}), 400

    campos_obrigatorios = ["id_conversa"]

    for campo in campos_obrigatorios:
        if not payload.get(campo):
            return jsonify({"erro": f"Campo obrigatorio ausente: {campo}"}), 400

    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria(repo, "supervisor")
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    payload["cpf_supervisor"] = usuario["cpf"]
    payload["nome_supervisor"] = usuario["nome"]

    use_case = EncerrarAtendimentoSupervisorUseCase(repo)

    try:
        resultado = use_case.executar(payload)
        return jsonify(resultado), 200

    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# =========================================================
# SSE
# =========================================================

@bp.route("/sse", methods=["GET"])
def sse_eventos():
    """
    Endpoint SSE para transmissÃ£o em tempo real dos eventos
    """

    ultimo_id = request.args.get("ultimo_evento_id", default=0, type=int)
    repo = SqlMonitoriaWhatsappRepository()
    try:
        usuario = _obter_usuario_monitoria_sse(repo)
    except PermissionError as e:
        return jsonify({"erro": str(e)}), 403

    def stream():
        current_id = ultimo_id

        yield "event: connected\n"
        yield "data: {\"status\":\"ok\"}\n\n"

        while True:
            try:
                eventos = repo.buscar_eventos_apos_id_por_carteira(
                    current_id,
                    usuario["carteira"]
                )

                if eventos:
                    for evento in eventos:
                        conversa = repo.obter_conversa_por_id(evento["ID_CONVERSA"])
                        if not _usuario_pode_visualizar_conversa(repo, usuario, conversa):
                            continue

                        current_id = evento["ID_EVENTO"]

                        payload = {}

                        if evento["PAYLOAD_JSON"]:
                            try:
                                payload = json.loads(evento["PAYLOAD_JSON"])
                            except Exception:
                                payload = {}

                        data = {
                            "id_evento": evento["ID_EVENTO"],
                            "tipo": evento["TIPO_EVENTO"],
                            "id_conversa": evento["ID_CONVERSA"],
                            "data_evento_utc": evento["DATA_EVENTO_UTC"],
                            "payload": payload
                        }

                        yield f"id: {evento['ID_EVENTO']}\n"
                        yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                    
                eventlet.sleep(1)

            except Exception as e:
                erro = {"erro": str(e)}
                yield f"event: erro\n"
                yield f"data: {json.dumps(erro, ensure_ascii=False)}\n\n"
                eventlet.sleep(2)

    return Response(
        stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )




