import traceback

from flask import Blueprint,request,jsonify
from src.application.services.ia_services import *
from src.application.services.dados_operadores_service import *
from src.shared.ia.aurora_conhecimento_cache import obter_itens

bp = Blueprint("IADesempenho",__name__,url_prefix="/ia")


@bp.route("/carteiras-habilitadas",methods=["GET"])
def carteiras_habilitadas():
    """Carteiras que ja tem treinamento cadastrado.

    A tela soma esta lista a lista fixa dela. E o que permite a Qualidade abrir
    o @IA para uma carteira nova apenas cadastrando a primeira ficha, sem
    depender de alterar codigo e publicar -- que era como a lista de dez
    carteiras tinha sido congelada.

    Serve do cache em memoria: dentro do TTL nao ha ida ao banco, entao pode ser
    consultada na abertura de tela sem custo. Falha em silencio devolvendo lista
    vazia; nesse caso a tela fica so com a lista fixa, que e o comportamento
    anterior.
    """
    try:
        carteiras = sorted({
            item["carteira"].strip()
            for item in obter_itens()
            if item.get("carteira")
        })
    except Exception:
        traceback.print_exc()
        carteiras = []

    return jsonify({"carteiras":carteiras}),200

@bp.route("/desempenho/kpis",methods=["POST"])
def kpis_desempenho_operador():
    try:
        data = request.get_json() or {}
        operador = (data.get("OPERADOR") or "").strip()

        if not operador:
            return jsonify({"erro":"OPERADOR é obrigatório"}),400

        kpis = IADesempenhoService().obter_kpis(operador)
        return jsonify({"kpis":kpis}),200
    except Exception:
        traceback.print_exc()
        return jsonify({
            "erro": "Erro ao consultar os resultados do operador"
        }), 500

@bp.route("/desempenho",methods=["POST"])
def desempenho_operador():
    try:
        data = request.get_json() or {}
        operador = data.get("OPERADOR")
        pergunta = data.get("PERGUNTA")
        is_admin = data.get("IS_ADMIN",False)
        id_olos_cx = data.get("ID_OLOS_CX")
        id_olos_cob = data.get("ID_OLOS_COB")
        conversa_id = data.get("CONVERSA_ID")

        if not operador or not pergunta:
            return jsonify({"erro":"OPERADOR e PERGUNTA são obrigatórios"}),400
        
        if not id_olos_cx and not id_olos_cob:
            return jsonify({"erro":"Informe ID_OLOS_CX ou ID_OLOS_COB"}),400

        centro_custo = DadosOperadoresService().obter_carteira_do_operador(
            operador=operador,
            id_olos_cx=id_olos_cx,
            id_olos_cob=id_olos_cob,
        )

        resposta,contexto = IADesempenhoService().executar(
            operador,
            pergunta,
            is_admin,
            centro_custo,
            conversa_id
        )

        if not resposta:
            return jsonify({"erro":"Falha ao gerar desempenho"}),500

        return jsonify({"resposta":resposta,"contexto":contexto}),200
    except Exception:
        traceback.print_exc()

        return jsonify({
            "erro": "Erro interno do servidor"
        }), 500

@bp.route("/desempenho/feedback",methods=["POST"])
def feedback_resposta_desempenho():
    data = request.get_json() or {}

    mensagem_id = data.get("MENSAGEM_ID")
    operador = data.get("OPERADOR")
    resposta_util = data.get("RESPOSTA_UTIL")

    if not mensagem_id or not operador or resposta_util is None:
        return jsonify({"erro":"MENSAGEM_ID, OPERADOR e RESPOSTA_UTIL sÃ£o obrigatÃ³rios"}),400

    try:
        atualizados = IADesempenhoService().registrar_feedback_resposta(
            int(mensagem_id),
            operador,
            bool(resposta_util)
        )
    except (TypeError,ValueError):
        return jsonify({"erro":"Dados de feedback invÃ¡lidos"}),400

    if not atualizados:
        return jsonify({"erro":"Resposta da Aurora nÃ£o encontrada"}),404

    return jsonify({"ok":True}),200

@bp.route("/treinamento",methods=["POST"])
def treinamento_operador():
    data = request.get_json() or {}

    operador = data.get("OPERADOR")
    mensagem = data.get("MENSAGEM","").strip()
    historico = data.get("HISTORICO",[])
    centro_custo = data.get("centroCusto","Não definido")

    if not operador:
        return jsonify({"erro":"OPERADOR é obrigatório"}),400
   
    resposta = IATreinamentoService().executar(operador,mensagem,historico,centro_custo)

    return jsonify(resposta),200

@bp.route("/insights",methods=["POST"])
def gerar():
    data = request.get_json() or {}
    supervisor = data.get("SUPERVISOR")
    centro_custo = data.get("CENTRO_CUSTO")

    if not supervisor or not centro_custo:
        return jsonify({"erro":"SUPERVISOR e CENTRO_CUSTO são obrigatórios"}),400

    resultado = IAInsightsService().executar(supervisor,centro_custo)

    if not resultado:
        return jsonify({"erro":"Nenhum operador encontrado"}),404

    return jsonify(resultado),200
