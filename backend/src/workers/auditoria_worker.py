import logging
import threading
import time
from concurrent.futures import Future, ThreadPoolExecutor

from src.application.services.auditoria_openai_service import (
    AudioTranscriptionService,
    AuditoriaAnalysisService,
    AuditoriaCoachingService,
    AuditoriaOpenAIError,
)
from src.application.services.auditoria_training_provider import AuditoriaTrainingProvider
from src.infrastructure.repositories.sql_auditoria_repository import AuditoriaRepository
from src.shared.auditoria_config import (
    AUDITORIA_COACHING_MIN_CHARS,
    AUDITORIA_WORKER_MAX_ATTEMPTS,
    AUDITORIA_WORKER_POLL_SECONDS,
)


logger = logging.getLogger(__name__)
_thread: threading.Thread | None = None


def _gerar_orientacao(audit_id: int, texto: str, ouvido_ate: float, carteira: str):
    try:
        orientacao, raw = AuditoriaCoachingService().orientar(texto, carteira)
        AuditoriaRepository().salvar_orientacao_parcial(audit_id, orientacao, ouvido_ate, raw)
    except Exception:
        # Coaching parcial é complementar e nunca pode impedir a auditoria definitiva.
        logger.exception("Falha ao gerar orientação parcial da auditoria %s", audit_id)


def processar_uma() -> bool:
    repo = AuditoriaRepository()
    job = repo.reivindicar()
    if not job:
        return False
    audit_id = job["id"]
    try:
        context = repo.obter_contexto(audit_id)
        if not context:
            raise RuntimeError("Contexto da auditoria não encontrado")
        repo.atualizar_etapa(audit_id, "TRANSCREVENDO", job["tentativa"], job["worker_id"])
        partial_segments = []
        last_coaching_chars = 0
        coaching_future: Future | None = None
        executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f"auditoria-coaching-{audit_id}")

        def on_segment(segment):
            nonlocal last_coaching_chars, coaching_future
            partial_segments.append(segment)
            text = " ".join(item.texto for item in partial_segments)
            ouvido_ate = max((item.fim_segundos for item in partial_segments), default=0)
            repo.salvar_progresso_transcricao(audit_id, text, ouvido_ate)
            enough_new_context = len(text) - last_coaching_chars >= AUDITORIA_COACHING_MIN_CHARS
            available = coaching_future is None or coaching_future.done()
            if enough_new_context and available:
                last_coaching_chars = len(text)
                coaching_future = executor.submit(
                    _gerar_orientacao, audit_id, text, ouvido_ate, context["CARTEIRA_NOME"]
                )

        try:
            transcription, transcription_raw = AudioTranscriptionService().transcrever(
                context["STORAGE_KEY"], on_segment
            )
            if partial_segments and last_coaching_chars == 0:
                text = " ".join(item.texto for item in partial_segments)
                ouvido_ate = max((item.fim_segundos for item in partial_segments), default=0)
                coaching_future = executor.submit(
                    _gerar_orientacao, audit_id, text, ouvido_ate, context["CARTEIRA_NOME"]
                )
            if coaching_future:
                coaching_future.result()
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
        repo.salvar_transcricao(audit_id, transcription, transcription_raw)
        repo.atualizar_etapa(audit_id, "ANALISANDO", job["tentativa"], job["worker_id"])
        analysis, analysis_raw = AuditoriaAnalysisService().analisar(transcription, context["CARTEIRA_NOME"])
        repo.concluir(
            audit_id, analysis, analysis_raw, AuditoriaTrainingProvider.VERSION
        )
        return True
    except AuditoriaOpenAIError as exc:
        retry = exc.code in {"OPENAI_RATE_LIMIT", "OPENAI_TEMPORARY"} and job["tentativa"] < AUDITORIA_WORKER_MAX_ATTEMPTS
        repo.falhar(audit_id, exc.code, exc.public_message, retry)
        logger.warning("Auditoria %s falhou (%s); retry=%s", audit_id, exc.code, retry)
        return True
    except Exception:
        repo.falhar(audit_id, "INTERNAL_PROCESSING_ERROR", "Não foi possível concluir a análise.", False)
        logger.exception("Falha interna ao processar auditoria %s", audit_id)
        return True


def run_forever():
    while True:
        try:
            processed = processar_uma()
        except Exception:
            processed = False
            logger.exception("Falha ao consultar fila de auditorias")
        if not processed:
            time.sleep(AUDITORIA_WORKER_POLL_SECONDS)


def start_embedded_worker():
    global _thread
    if _thread and _thread.is_alive():
        return
    _thread = threading.Thread(target=run_forever, name="auditoria-worker", daemon=True)
    _thread.start()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_forever()
