from datetime import datetime, timedelta
from src.shared.openai_client import client
import json
import re

def resumir_operador(nome, hist):
    acordos = [d["acordos"] for d in hist]
    cpcs = [d["cpc"] for d in hist]
    total_pago = sum(d["total_pago"] for d in hist)
    total_acordo = sum(d["total_acordo"] for d in hist)

    media_acordos = sum(acordos) / len(acordos) if acordos else 0
    media_cpc = sum(cpcs) / len(cpcs) if cpcs else 0
    taxa_conversao = (sum(acordos) / sum(cpcs) * 100) if sum(cpcs) else 0

    return {
        "nome": nome,
        "media_acordos": round(media_acordos, 2),
        "media_cpc": round(media_cpc, 2),
        "taxa_conversao": round(taxa_conversao, 2),
        "total_pago": round(total_pago, 2),
        "total_acordo": round(total_acordo, 2),
        "tendencia": calcular_tendencia(hist)
    }

def calcular_tendencia(hist):
    acordos = [d["acordos"] for d in hist[-3:]]
    if len(acordos) < 2:
        return "estavel"
    media_antes = sum(acordos[:-1]) / max(len(acordos[:-1]), 1)
    if acordos[-1] > media_antes * 1.1:
        return "evolucao"
    elif acordos[-1] < media_antes * 0.9:
        return "decadencia"
    return "estavel"

def gerar_insights_batch(centro_custo, subset):
    prompt = f"""
Você é a Aurora IA, analista de performance de call center.
Analise os operadores abaixo da carteira "{centro_custo}" e gere uma lista JSON no formato:
[
  {{
    "nome": "...",
    "status": "...",
    "analise_ia": "...",
    "sugestoes_feedback": ["...", "..."]
  }}
]
Operadores:
{json.dumps(subset, ensure_ascii=False, indent=2)}
"""

    resposta = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.5,
        messages=[
            {"role": "system", "content": "Você é analista de performance de operadores de cobrança."},
            {"role": "user", "content": prompt}
        ]
    )

    conteudo = resposta.choices[0].message.content.strip()
    resultado = extrair_json_puro(conteudo)
    if not resultado:
        print("⚠️ Falha ao converter batch para JSON.\nConteúdo recebido:\n", conteudo[:500])
        return []
    return resultado

def extrair_json_puro(texto):
    """
    Tenta extrair o conteúdo JSON puro de uma resposta da IA.
    Se não conseguir, retorna None.
    """
    try:
        # Tenta parse direto
        return json.loads(texto)
    except json.JSONDecodeError:
        # Extrai apenas o trecho entre colchetes ou chaves
        match = re.search(r"(\{.*\}|\[.*\])", texto, re.DOTALL)
        if match:
            trecho = match.group(1)
            try:
                return json.loads(trecho)
            except:
                pass
        return None
    
def calcular_metricas(hist):
    """
    Calcula métricas básicas (acordos hoje, acordos ontem, valor total e taxa de conversão)
    com base no histórico diário de um operador.
    """
    if not hist:
        return {
            "acordos_hoje": 0,
            "acordos_ontem": 0,
            "valor_total": 0,
            "taxa_conversao": 0
        }

    hoje = hist[-1]
    ontem = hist[-2] if len(hist) > 1 else hoje
    taxa_conv = round((hoje["acordos"] / hoje["cpc"] * 100) if hoje["cpc"] else 0, 2)
    return {
        "acordos_hoje": hoje["acordos"],
        "acordos_ontem": ontem["acordos"],
        "valor_total": hoje["total_acordo"],
        "taxa_conversao": taxa_conv
    }

def calcular_metricas(hist):
    """
    Calcula métricas básicas (acordos hoje, acordos ontem, valor total e taxa de conversão)
    com base no histórico diário de um operador.
    """
    if not hist:
        return {
            "acordos_hoje": 0,
            "acordos_ontem": 0,
            "valor_total": 0,
            "taxa_conversao": 0
        }

    hoje = hist[-1]
    ontem = hist[-2] if len(hist) > 1 else hoje
    taxa_conv = round((hoje["acordos"] / hoje["cpc"] * 100) if hoje["cpc"] else 0, 2)
    return {
        "acordos_hoje": hoje["acordos"],
        "acordos_ontem": ontem["acordos"],
        "valor_total": hoje["total_acordo"],
        "taxa_conversao": taxa_conv
    }

def calcular_comparativos(hist):
    """
    Compara o desempenho do operador (hoje, semana e mês)
    com períodos anteriores para detectar evolução ou queda.
    """
    if not hist:
        return {
            "comparativo_dia": "sem dados",
            "comparativo_semana": "sem dados",
            "comparativo_mes": "sem dados"
        }

    # Converte as datas e ordena
    for d in hist:
        d["data"] = datetime.strptime(d["data"], "%Y-%m-%d")
    hist.sort(key=lambda x: x["data"])

    hoje = hist[-1]["data"].date()
    inicio_semana = hoje - timedelta(days=hoje.weekday())
    inicio_semana_passada = inicio_semana - timedelta(days=7)
    inicio_mes = hoje.replace(day=1)
    inicio_mes_passado = (inicio_mes - timedelta(days=1)).replace(day=1)

    # ----- 📊 1. Comparativo do dia -----
    ultimos_dias = [h for h in hist if (hoje - h["data"].date()).days in range(1, 4)]
    media_dias_anteriores = (sum(h["acordos"] for h in ultimos_dias) / len(ultimos_dias)) if ultimos_dias else 0
    comparativo_dia = (
        "melhorou" if hist[-1]["acordos"] > media_dias_anteriores * 1.1 else
        "piorou" if hist[-1]["acordos"] < media_dias_anteriores * 0.9 else
        "estavel"
    )

    # ----- 📊 2. Comparativo semanal -----
    semana_atual = [h for h in hist if h["data"].date() >= inicio_semana]
    semana_passada = [h for h in hist if inicio_semana_passada <= h["data"].date() < inicio_semana]
    total_atual = sum(h["acordos"] for h in semana_atual)
    total_passada = sum(h["acordos"] for h in semana_passada)
    comparativo_semana = (
        "melhorou" if total_atual > total_passada * 1.1 else
        "piorou" if total_atual < total_passada * 0.9 else
        "estavel"
    )

    # ----- 📊 3. Comparativo mensal -----
    mes_atual = [h for h in hist if h["data"].date() >= inicio_mes]
    mes_passado = [h for h in hist if inicio_mes_passado <= h["data"].date() < inicio_mes]
    dias_mes_atual = (hoje - inicio_mes).days + 1
    ate_hoje_mes_passado = [h for h in mes_passado if (h["data"].day <= dias_mes_atual)]
    total_mes_atual = sum(h["acordos"] for h in mes_atual)
    total_mes_passado = sum(h["acordos"] for h in ate_hoje_mes_passado)
    comparativo_mes = (
        "melhorou" if total_mes_atual > total_mes_passado * 1.1 else
        "piorou" if total_mes_atual < total_mes_passado * 0.9 else
        "estavel"
    )

    return {
        "comparativo_dia": comparativo_dia,
        "comparativo_semana": comparativo_semana,
        "comparativo_mes": comparativo_mes
    }

def gerar_resumo_geral_time(centro_custo, operadores):
    prompt = f"""
        Você é a Aurora IA, analista de performance de equipes de cobrança em Telemarketing.
        Com base nos operadores abaixo, faça uma breve análise geral da carteira "{centro_custo}",
        mencionando tendências e motivando a equipe.
        Operadores:
        {json.dumps(operadores, ensure_ascii=False, indent=2)}
        """

    resposta = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.5,
        messages=[
            {"role": "system", "content": "Você gera relatórios breves e motivacionais para supervisores de call center."},
            {"role": "user", "content": prompt}
        ]
    )

    return resposta.choices[0].message.content.strip()