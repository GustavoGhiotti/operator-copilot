import json
from pathlib import Path

from src.shared.ia.aurora_base_conhecimento import carregar_base_conhecimento


class AuditoriaTrainingProvider:
    VERSION = "DELTA-MVP-2026.1"

    def _criterios_base(self) -> dict:
        path = Path(__file__).resolve().parents[2] / "shared" / "auditoria_delta_criterios.json"
        with path.open("r", encoding="utf-8") as file:
            return json.load(file)

    def obter(self, carteira: str) -> dict:
        if "delta" not in str(carteira or "").lower():
            raise ValueError("A carteira ainda não possui configuração de auditoria ativa.")

        conhecimentos = []
        for item in carregar_base_conhecimento():
            if "delta" not in str(item.get("carteira") or "").lower():
                continue
            conhecimentos.append({
                "produto": item.get("produto"),
                "categoria": item.get("categoria"),
                "descricao": item.get("descricao"),
                "texto": item.get("texto"),
            })

        return {
            "versao": self.VERSION,
            "status": "CONTEUDO_INTERNO_A_VALIDAR",
            "criterios": self._criterios_base(),
            "base_conhecimento": conhecimentos,
        }

    def formatar_prompt(self, carteira: str) -> str:
        config = self.obter(carteira)
        return json.dumps(config, ensure_ascii=False)[:60000]

