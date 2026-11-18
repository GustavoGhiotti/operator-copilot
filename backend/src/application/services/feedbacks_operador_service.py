from src.infrastructure.repositories.feedbacks_operador_repository import *
import re

class FeedbacksOperadorService:
    @staticmethod
    def _resolver_tempo_ligacao(row: dict) -> str | None:
        tempo = row.get("TEMPO_LIGACAO_TOTAL")
        if tempo:
            return str(tempo).strip()

        descricao = str(row.get("DESCRICAO") or "")
        match = re.search(
            r"Tempo total da ligação:\s*([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)",
            descricao,
            re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        return None

    def executar(self,operador: str):
        resultados = FeedbacksOperadorRepository().buscar(operador)

        if not resultados:
            return []

        return [
            {
                "id":r["id"],
                "monitor_nome":r["MONITOR_NOME"],
                "data_hora":r["DATA_HORA"],
                "id_ligacao":r["ID_LIGACAO"],
                "call_id":r.get("CALL_ID"),
                "tempo_ligacao_total":self._resolver_tempo_ligacao(r),
                "descricao":r["DESCRICAO"],
                "pontos_positivos":r["PONTOS_POSITIVOS"],
                "pontos_melhorar":r["PONTOS_MELHORAR"],
                "pontuacao":r["PONTUACAO"],
                "is_positivo":r["IS_POSITIVO"],
                "lido":bool(r["LIDO"]),
                "ciente":bool(r["CIENTE"]),
                "ciente_em":r["CIENTE_EM"]
            }
            for r in resultados
        ]
