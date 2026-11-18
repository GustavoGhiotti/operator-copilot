import os
from werkzeug.utils import secure_filename

PASTA_AUDIOS = "audios_feedbacks"

def salvar_audio_feedback(audio,operador: str,id_ligacao: str):
    if not audio:
        return None

    os.makedirs(PASTA_AUDIOS,exist_ok=True)

    nome = secure_filename(f"{id_ligacao}_{operador}.mp3")
    caminho = os.path.join(PASTA_AUDIOS,nome)

    audio.save(caminho)

    return caminho
