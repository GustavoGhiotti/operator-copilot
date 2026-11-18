import json
import os
from collections.abc import Callable
from pathlib import Path

from openai import APIConnectionError, APITimeoutError, OpenAI, RateLimitError

from src.application.services.auditoria_training_provider import AuditoriaTrainingProvider
from src.schemas.auditoria_schema import (
    OrientacaoTempoReal,
    ResultadoAuditoriaIA,
    ResultadoTranscricao,
    SegmentoTranscricao,
)
from src.shared.auditoria_config import (
    AUDITORIA_ANALYSIS_MODEL,
    AUDITORIA_COACHING_MODEL,
    AUDITORIA_OPENAI_TIMEOUT,
    AUDITORIA_TRANSCRIPTION_MODEL,
)


class AuditoriaOpenAIError(RuntimeError):
    def __init__(self, public_message: str, code: str):
        super().__init__(public_message)
        self.public_message = public_message
        self.code = code


class AudioTranscriptionService:
    def __init__(self, client: OpenAI | None = None):
        self.client = client or OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"), timeout=AUDITORIA_OPENAI_TIMEOUT, max_retries=2
        )

    def transcrever(
        self, caminho: str, ao_receber_segmento: Callable[[SegmentoTranscricao], None] | None = None
    ) -> tuple[ResultadoTranscricao, dict]:
        try:
            with Path(caminho).open("rb") as audio:
                if ao_receber_segmento and AUDITORIA_TRANSCRIPTION_MODEL != "whisper-1":
                    events = self.client.audio.transcriptions.create(
                        model=AUDITORIA_TRANSCRIPTION_MODEL,
                        file=audio,
                        language="pt",
                        response_format="diarized_json",
                        chunking_strategy="auto",
                        stream=True,
                    )
                    segments = []
                    full_text = ""
                    for event in events:
                        event_type = getattr(event, "type", "")
                        if event_type == "transcript.text.delta":
                            full_text += getattr(event, "delta", "") or ""
                        elif event_type == "transcript.text.segment":
                            text = str(getattr(event, "text", "") or "").strip()
                            if not text:
                                continue
                            segment = SegmentoTranscricao(
                                ordem=len(segments) + 1,
                                inicio_segundos=float(getattr(event, "start", 0) or 0),
                                fim_segundos=float(getattr(event, "end", 0) or 0),
                                interlocutor=str(getattr(event, "speaker", None) or "Interlocutor não identificado"),
                                texto=text,
                            )
                            segments.append(segment)
                            ao_receber_segmento(segment)
                        elif event_type == "transcript.text.done":
                            full_text = str(getattr(event, "text", "") or full_text).strip()
                    if not full_text:
                        full_text = " ".join(item.texto for item in segments)
                    if not full_text:
                        raise AuditoriaOpenAIError("A transcrição retornou vazia.", "EMPTY_TRANSCRIPTION")
                    duration = max((item.fim_segundos for item in segments), default=0)
                    raw = {"text": full_text, "duration": duration, "segments": [s.model_dump() for s in segments]}
                    return ResultadoTranscricao(
                        texto=full_text, duracao_segundos=duration, idioma="pt", segmentos=segments
                    ), raw
                if AUDITORIA_TRANSCRIPTION_MODEL == "whisper-1":
                    response = self.client.audio.transcriptions.create(
                        model=AUDITORIA_TRANSCRIPTION_MODEL,
                        file=audio,
                        language="pt",
                        response_format="verbose_json",
                        timestamp_granularities=["segment"],
                    )
                else:
                    response = self.client.audio.transcriptions.create(
                        model=AUDITORIA_TRANSCRIPTION_MODEL,
                        file=audio,
                        language="pt",
                        response_format="diarized_json",
                        chunking_strategy="auto",
                    )
        except RateLimitError as exc:
            raise AuditoriaOpenAIError("O serviço está temporariamente sobrecarregado.", "OPENAI_RATE_LIMIT") from exc
        except (APITimeoutError, APIConnectionError) as exc:
            raise AuditoriaOpenAIError("Não foi possível concluir a transcrição agora.", "OPENAI_TEMPORARY") from exc
        except AuditoriaOpenAIError:
            raise
        except Exception as exc:
            raise AuditoriaOpenAIError("Não foi possível ler ou transcrever a gravação.", "TRANSCRIPTION_FAILED") from exc

        raw = response.model_dump() if hasattr(response, "model_dump") else json.loads(response)
        raw_segments = raw.get("segments") or []
        segments = []
        for index, item in enumerate(raw_segments, 1):
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            speaker = item.get("speaker") or item.get("speaker_label")
            segments.append(SegmentoTranscricao(
                ordem=index,
                inicio_segundos=float(item.get("start") or 0),
                fim_segundos=float(item.get("end") or item.get("start") or 0),
                interlocutor=str(speaker or "Interlocutor não identificado"),
                texto=text,
            ))
        text = str(raw.get("text") or "").strip() or " ".join(item.texto for item in segments)
        if not text:
            raise AuditoriaOpenAIError("A transcrição retornou vazia.", "EMPTY_TRANSCRIPTION")
        duration = float(raw.get("duration") or max((item.fim_segundos for item in segments), default=0))
        return ResultadoTranscricao(
            texto=text, duracao_segundos=duration, idioma=raw.get("language"), segmentos=segments
        ), raw


class AuditoriaCoachingService:
    def __init__(self, client: OpenAI | None = None):
        self.client = client or OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"), timeout=AUDITORIA_OPENAI_TIMEOUT, max_retries=2
        )
        self.training = AuditoriaTrainingProvider()

    def orientar(self, transcricao_parcial: str, carteira: str) -> tuple[OrientacaoTempoReal, dict]:
        try:
            response = self.client.responses.parse(
                model=AUDITORIA_COACHING_MODEL,
                instructions=(
                    "Você é um copiloto de atendimento em tempo quase real. Use somente o trecho já ouvido "
                    "e os materiais internos. Entregue uma única orientação prática e uma fala natural que o "
                    "operador poderia usar agora. Não dê nota, não conclua a auditoria e não invente fatos. "
                    "Se houver risco, descreva-o brevemente; caso contrário, use null."
                ),
                input=(
                    f"MATERIAIS INTERNOS:\n{self.training.formatar_prompt(carteira)}\n\n"
                    f"TRANSCRIÇÃO OUVIDA ATÉ AGORA:\n{transcricao_parcial[-12000:]}"
                ),
                text_format=OrientacaoTempoReal,
                max_output_tokens=1200,
                store=False,
            )
            result = response.output_parsed
            if not result:
                raise ValueError("Orientação estruturada vazia")
            return result, response.model_dump() if hasattr(response, "model_dump") else {}
        except RateLimitError as exc:
            raise AuditoriaOpenAIError("O serviço está temporariamente sobrecarregado.", "OPENAI_RATE_LIMIT") from exc
        except (APITimeoutError, APIConnectionError) as exc:
            raise AuditoriaOpenAIError("Não foi possível gerar a orientação agora.", "OPENAI_TEMPORARY") from exc
        except AuditoriaOpenAIError:
            raise
        except Exception as exc:
            raise AuditoriaOpenAIError("Não foi possível gerar a orientação parcial.", "INVALID_COACHING") from exc


class AuditoriaAnalysisService:
    def __init__(self, client: OpenAI | None = None):
        self.client = client or OpenAI(
            api_key=os.getenv("OPENAI_API_KEY"), timeout=AUDITORIA_OPENAI_TIMEOUT, max_retries=2
        )
        self.training = AuditoriaTrainingProvider()

    def analisar(self, transcricao: ResultadoTranscricao, carteira: str) -> tuple[ResultadoAuditoriaIA, dict]:
        transcript_payload = json.dumps(
            [item.model_dump() for item in transcricao.segmentos], ensure_ascii=False
        )
        instructions = """
Você é uma avaliadora de desenvolvimento de operadores. Avalie somente o que está evidenciado
na transcrição e nos materiais internos fornecidos. Não invente falas, regras, interlocutores ou
alertas críticos. Use linguagem respeitosa, instrutiva e prática. Quando o material não sustentar
uma conclusão, registre a limitação. Evidências devem reproduzir um trecho real e timestamps reais.
Avalie todas as categorias configuradas. A nota geral deve ser coerente com as categorias.
""".strip()
        user_input = (
            "CONFIGURACAO E MATERIAIS INTERNOS:\n"
            f"{self.training.formatar_prompt(carteira)}\n\n"
            "TRANSCRICAO SEGMENTADA:\n"
            f"{transcript_payload}"
        )
        try:
            response = self.client.responses.parse(
                model=AUDITORIA_ANALYSIS_MODEL,
                instructions=instructions,
                input=user_input,
                text_format=ResultadoAuditoriaIA,
                max_output_tokens=12000,
                store=False,
            )
            result = response.output_parsed
            if not result:
                raise ValueError("Resposta estruturada vazia")
            raw = response.model_dump() if hasattr(response, "model_dump") else {}
            return result, raw
        except RateLimitError as exc:
            raise AuditoriaOpenAIError("O serviço está temporariamente sobrecarregado.", "OPENAI_RATE_LIMIT") from exc
        except (APITimeoutError, APIConnectionError) as exc:
            raise AuditoriaOpenAIError("Não foi possível concluir a análise agora.", "OPENAI_TEMPORARY") from exc
        except AuditoriaOpenAIError:
            raise
        except Exception as exc:
            raise AuditoriaOpenAIError("A análise não retornou um resultado válido.", "INVALID_ANALYSIS") from exc
