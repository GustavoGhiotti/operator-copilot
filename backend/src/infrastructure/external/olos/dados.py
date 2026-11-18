from src.shared.token_exception import ObterTokenException
import os
import requests
import time

class DadosOlos:
    def obter_token():
        for i in range(10):
            url = os.getenv("OLOS_TOKEN_URL", "http://10.0.0.26/WebApiAgentControl/token")

            headers = {"Content-Type": "application:/x-www-form-urlencoded"}

            body = {
                "username": os.getenv("OLOS_USERNAME", ""),
                "password": os.getenv("OLOS_PASSWORD", ""),
                "grant_type": "password",
                "client_id": os.getenv("OLOS_CLIENT_ID", ""),
                "client_secret": os.getenv("OLOS_CLIENT_SECRET", "")
            }

            response = requests.post(url=url, headers=headers, data=body)

            if response.status_code == 200:
                resultado = response.json()
                return resultado["access_token"]

            time.sleep(0.25)
                 
        raise ObterTokenException("Não foi possivel receber o token")

    def url() -> str:
        return "http://10.0.0.25/WsMailingControl/WSMailingCommand.asmx?op="