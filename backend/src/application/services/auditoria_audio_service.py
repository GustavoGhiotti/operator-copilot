import hashlib
import os
import re
import uuid
from pathlib import Path

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from src.shared.auditoria_config import (
    AUDITORIA_ALLOWED_EXTENSIONS,
    AUDITORIA_ALLOWED_MIME_TYPES,
    AUDITORIA_MAX_FILE_SIZE,
    AUDITORIA_STORAGE_PATH,
)


class AuditoriaAudioError(ValueError):
    pass


class AuditoriaAudioService:
    SIGNATURES = {
        "mp3": (b"ID3", b"\xff"),
        "wav": (b"RIFF",),
        "m4a": (b"\x00\x00\x00",),
        "webm": (b"\x1aE\xdf\xa3",),
        "ogg": (b"OggS",),
    }

    def validar_e_salvar(self, arquivo: FileStorage) -> dict:
        if not arquivo or not arquivo.filename:
            raise AuditoriaAudioError("Selecione uma gravação para analisar.")

        nome_original = secure_filename(arquivo.filename)
        if not nome_original or not re.match(r"^[A-Za-z0-9_.() -]+$", nome_original):
            raise AuditoriaAudioError("O nome do arquivo é inválido.")

        extensao = nome_original.rsplit(".", 1)[-1].lower() if "." in nome_original else ""
        if extensao not in AUDITORIA_ALLOWED_EXTENSIONS:
            raise AuditoriaAudioError("Formato não permitido. Use MP3, WAV, M4A, WEBM ou OGG.")
        if arquivo.mimetype and arquivo.mimetype.lower() not in AUDITORIA_ALLOWED_MIME_TYPES:
            raise AuditoriaAudioError("O tipo do arquivo não corresponde a um áudio permitido.")

        arquivo.stream.seek(0, os.SEEK_END)
        tamanho = arquivo.stream.tell()
        arquivo.stream.seek(0)
        if tamanho <= 0:
            raise AuditoriaAudioError("O arquivo está vazio.")
        if tamanho > AUDITORIA_MAX_FILE_SIZE:
            raise AuditoriaAudioError(
                f"O arquivo deve ter no máximo {AUDITORIA_MAX_FILE_SIZE // (1024 * 1024)} MB."
            )

        cabecalho = arquivo.stream.read(16)
        arquivo.stream.seek(0)
        if not any(cabecalho.startswith(prefix) or prefix in cabecalho for prefix in self.SIGNATURES[extensao]):
            raise AuditoriaAudioError("O conteúdo do arquivo não corresponde ao formato informado.")

        AUDITORIA_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
        nome_interno = f"{uuid.uuid4().hex}.{extensao}"
        caminho = (AUDITORIA_STORAGE_PATH / nome_interno).resolve()
        if AUDITORIA_STORAGE_PATH not in caminho.parents:
            raise AuditoriaAudioError("Destino de armazenamento inválido.")

        hasher = hashlib.sha256()
        with caminho.open("wb") as output:
            while chunk := arquivo.stream.read(1024 * 1024):
                hasher.update(chunk)
                output.write(chunk)

        return {
            "nome_original": nome_original,
            "nome_interno": nome_interno,
            "caminho": str(caminho),
            "extensao": extensao,
            "mime_type": arquivo.mimetype,
            "tamanho_bytes": tamanho,
            "sha256": hasher.hexdigest(),
        }

    @staticmethod
    def remover(caminho: str | None):
        if not caminho:
            return
        target = Path(caminho).resolve()
        if AUDITORIA_STORAGE_PATH in target.parents and target.exists():
            target.unlink()

