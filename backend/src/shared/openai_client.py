from openai import OpenAI
from src.shared.utils.env_load import OPENAI_API_KEY

client = OpenAI(api_key=OPENAI_API_KEY)