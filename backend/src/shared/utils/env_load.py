from pathlib import Path
from dotenv import load_dotenv
import os

ENV_PATH = Path(__file__).resolve().parents[3] / ".env"

load_dotenv(ENV_PATH)

#Usuário da API da Acme
USER_API=os.getenv("USER_API")
PASSWORD_API=os.getenv("PASSWORD_API")

#Credenciais e Host dos bancos
DB_HOST_65=os.getenv("DB_HOST_65")
DB_HOST_66=os.getenv("DB_HOST_66")
DB_HOST_71=os.getenv("DB_HOST_71")
DB_HOST_248=os.getenv("DB_HOST_248")

DB_USER=os.getenv("DB_USER")
DB_PASSWORD=os.getenv("DB_PASSWORD")

OPENAI_API_KEY=os.getenv("OPENAI_API_KEY")

#Credenciais Twilio
TWILIO_SID=os.getenv("TWILIO_SID")
TWILIO_TOKEN=os.getenv("TWILIO_TOKEN")


#META ZAPI
VERIFY_TOKEN=os.getenv("META_VERIFY_TOKEN")
APP_SECRET=os.getenv("META_APP_SECRET")
META_ACCESS_TOKEN=os.getenv("META_ACCESS_TOKEN")
META_GRAPH_API_VERSION=os.getenv("META_GRAPH_API_VERSION", "v25.0")
COPILOT_META_WEBHOOK_TOKEN=os.getenv("COPILOT_META_WEBHOOK_TOKEN") 
COPILOT_META_WEBHOOK_TOKEN=os.getenv("COPILOT_META_WEBHOOK_TOKEN") 

if not OPENAI_API_KEY:
    raise RuntimeError(f"OPENAI_API_KEY não encontrada. Caminho testado: {ENV_PATH}")
