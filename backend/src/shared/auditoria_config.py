import os
from pathlib import Path


AUDITORIA_ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a", "webm", "ogg"}
AUDITORIA_ALLOWED_MIME_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4",
    "audio/x-m4a", "audio/webm", "audio/ogg", "application/ogg",
}
AUDITORIA_MAX_FILE_SIZE = int(os.getenv("AUDITORIA_MAX_FILE_SIZE_MB", "25")) * 1024 * 1024
AUDITORIA_STORAGE_PATH = Path(
    os.getenv(
        "AUDITORIA_STORAGE_PATH",
        str(Path(__file__).resolve().parents[2] / "private_uploads" / "auditorias"),
    )
).resolve()
AUDITORIA_TRANSCRIPTION_MODEL = os.getenv(
    "OPENAI_TRANSCRIPTION_MODEL", "gpt-4o-transcribe-diarize"
)
AUDITORIA_ANALYSIS_MODEL = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-5.4-mini")
AUDITORIA_COACHING_MODEL = os.getenv("OPENAI_COACHING_MODEL", AUDITORIA_ANALYSIS_MODEL)
AUDITORIA_COACHING_MIN_CHARS = int(os.getenv("AUDITORIA_COACHING_MIN_CHARS", "320"))
AUDITORIA_OPENAI_TIMEOUT = float(os.getenv("AUDITORIA_OPENAI_TIMEOUT_SECONDS", "600"))
AUDITORIA_WORKER_POLL_SECONDS = float(os.getenv("AUDITORIA_WORKER_POLL_SECONDS", "5"))
AUDITORIA_WORKER_MAX_ATTEMPTS = int(os.getenv("AUDITORIA_WORKER_MAX_ATTEMPTS", "3"))
