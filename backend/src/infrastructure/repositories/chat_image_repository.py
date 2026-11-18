from pathlib import Path
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


class ChatImageRepository:
    def __init__(self):
        self.upload_dir = (
            Path(__file__).resolve().parents[3] / "static" / "chat_images"
        )
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def salvar(self, arquivo: FileStorage) -> str:
        nome_arquivo = secure_filename(arquivo.filename or "")

        if not nome_arquivo:
            return ""

        arquivo.save(self.upload_dir / nome_arquivo)

        return nome_arquivo

    def obter_diretorio(self) -> str:
        return str(self.upload_dir)
