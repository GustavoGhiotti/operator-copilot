from flask import Blueprint, request, jsonify
from src.application.services.enviar_mensagem_service import *
from src.shared.errors.envio_mensagem_exceptions import *
from src.infrastructure.external.acmeAPI.boleto import Emitir, Gerar, ConsultarAcordos
from src.shared.errors.acme_api_exceptions import EmissaoBoletoException
import re

bp = Blueprint("Envio de mensagem Whatsapp", __name__, url_prefix="/digital")


def normalizar_numero_cliente(numero: str) -> str:
    numero_limpo = re.sub(r"\D", "", str(numero or ""))

    if len(numero_limpo) in (10, 11):
        return f"55{numero_limpo}"

    if len(numero_limpo) in (12, 13) and numero_limpo.startswith("55"):
        return numero_limpo

    if not numero_limpo.startswith("55"):
        return f"55{numero_limpo}"

    return numero_limpo


@bp.post("/enviar-mensagem")
def enviar():
    try: 
        if request.content_type and "multipart/form-data" in request.content_type:
            body = request.form.to_dict()
            arquivo = request.files.get("boleto")
        else:
            body = request.get_json(silent=True) or {}
            arquivo = None

        id_cliente:int = body["idCliente"]
        numero_cliente:str = body["numeroCliente"]
        tipo_envio:str = body["tipoEnvio"]
        operador = body["operador"]
        carteira = body.get("carteira")
        id_cedente = body.get("idCedente") or body.get("id_cedente")
        id_acordo = body.get("idAcordo") or body.get("id_acordo")

        numero_cliente = normalizar_numero_cliente(numero_cliente)

        msg = EnvioMensagemWhatsapp(id_cliente, numero_cliente, operador, carteira, id_cedente, id_acordo)
        match tipo_envio.lower():
            case "preventivo":
                msg.preventivo(boleto=arquivo)
            case "desligou":
                pass
            case "recusa":
                pass
        
        
        mensagem = "Boleto enviado" if tipo_envio.lower() == "preventivo" else "Mensagem enviada" 

        return jsonify ({"status":True,"msg": mensagem})
    except EnvioBoletoException as e:
        return jsonify({"status":False, "msg":str(e)}), 400
    except EnvioMensagemException as e:
        return jsonify({"status":False, "msg": str(e)}), 400
    except Exception as e:
        print({"erro": str(e),"\ntipo": type(e).__name__})
        
        return jsonify({"status": False, "erro": str(e)}), 500

@bp.post("/gerar-link-pdf")
def gerar_link_pdf():
    try:
        if request.content_type and "multipart/form-data" in request.content_type:
            body = request.form.to_dict()
            arquivo = request.files.get("arquivo") or request.files.get("boleto")
        else:
            body = request.get_json(silent=True) or {}
            arquivo = None

        id_cliente = body.get("idCliente") or body.get("id_cliente")

        if not id_cliente:
            return jsonify({"status": False, "erro": "idCliente é obrigatório"}), 400

        if not arquivo:
            return jsonify({"status": False, "erro": "Arquivo PDF é obrigatório"}), 400

        link_pdf = Gerar().anexar_boleto(int(id_cliente), arquivo, arquivo.filename)

        return jsonify({"status": True, "link_pdf": link_pdf, "link": link_pdf}), 200
    except EmissaoBoletoException as e:
        return jsonify({"status": False, "erro": str(e)}), 400
    except Exception as e:
        return jsonify({"status": False, "erro": str(e)}), 500

@bp.get("/operador/envio-mensagens")
def obter_total_envios():
    try:
        operador = request.args.get("operador")

        resultado = TotalEnvioMensagens.obter(operador)

        return jsonify(resultado), 200
    except Exception as e:
        return jsonify({"status": False, "erro": e}),500


@bp.get("/cliente/acordos-ativos")
def listar_acordos_ativos_cliente():
    try:
        id_cliente = request.args.get("idCliente") or request.args.get("id_cliente")
        cedente = (
            request.args.get("cedente")
            or request.args.get("carteira")
            or request.headers.get("cedente")
            or "beta"
        )

        if not id_cliente:
            return jsonify({"status": False, "msg": "idCliente e obrigatorio"}), 400

        # A carteira recebida pertence ao operador e não deve filtrar o cliente.
        # Primeiro procura como ID_CLIENTE CollectSys no EasyCollector.
        acordos = DadosAcordoRepository().listar_acordos_ativos(id_cliente)

        # Se não houver acordo no EasyCollector, consulta a API com o
        # ID_CLIENTE exatamente como informado e com o padrão COPILOT.
        if not acordos:
            acordos = ConsultarAcordos().acordos_ativos(
                id_cliente,
                "COPILOT",
            )

        return jsonify({"status": True, "acordos": acordos or []}), 200
    except EmissaoBoletoException as e:
        return jsonify({"status": False, "msg": str(e)}), 400
    except Exception as e:
        return jsonify({"status": False, "msg": str(e)}), 500


@bp.post("/envio-boleto")
def enviar_boleto():
    body = request.get_json(force=True) or {}

    print(body)
    resultado = EnvioBoletoService().executar(body)

    if resultado.get("erro"):
        return jsonify(resultado),500

    return jsonify(resultado),200
