import json
import os
from typing import List, Dict


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REGRAS_PATH = os.path.join(BASE_DIR, "regras_treinamento.json")


def carregar_regras_treinamento(centro_custo: str) -> List[Dict[str, str]]:

    centro_custo_lower = centro_custo.strip().lower()

    try:
        with open(REGRAS_PATH, "r", encoding="utf-8") as f:
            regras_json = json.load(f)
    except Exception as e:
        print(f"⚠️ Erro ao carregar regras_treinamento.json: {e}")
        return [{"descricao": "Falha ao carregar regras.", "categoria": "erro", "peso": 1}]

    # Procura a carteira correspondente
    for r in regras_json:
        if r["carteira"].lower() == centro_custo_lower:
            regras = r.get("regras", [])
            # Suporte a regras simples (string) ou estruturadas (dict)
            if isinstance(regras[0], str):
                return [{"descricao": t, "categoria": "geral", "peso": 1} for t in regras]
            return regras

    return [{"descricao": "Sem regras específicas para essa carteira.", "categoria": "geral", "peso": 1}]


def formatar_regras_para_prompt(regras: List[Dict[str, str]]) -> str:
    """
    Formata as regras para exibição no prompt da IA, agrupadas por prioridade.
    """
    regras_ordenadas = sorted(regras, key=lambda r: r.get("peso", 1), reverse=True)

    texto = "As regras da carteira estão organizadas por prioridade:\n\n"
    for r in regras_ordenadas:
        categoria = r.get("categoria", "geral").capitalize()
        descricao = r.get("descricao", "")
        peso = r.get("peso", 1)
        texto += f"- ({categoria} | Peso {peso}) {descricao}\n"

    return texto.strip()