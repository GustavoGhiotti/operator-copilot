import requests
from requests.auth import HTTPBasicAuth
from src.shared.utils.env_load import TWILIO_SID,TWILIO_TOKEN

class TwilioClient:
    def enviar(self,payload: dict):
        url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"

        response = requests.post(url,data=payload,auth=HTTPBasicAuth(TWILIO_SID,TWILIO_TOKEN))

        if response.status_code == 201:
            resp = response.json()
            return {"sucesso":True,"sid":resp.get("sid"),"status":resp.get("status")}

        return {"sucesso":False,"erro":response.text}
