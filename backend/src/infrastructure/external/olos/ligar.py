from .dados import DadosOlos
import json
import requests
import random

class Ligacao(DadosOlos):
    def __init__(self, telefone:str, cpf:str):
        super().__init__()
        self.telefone = telefone
        self.cpf = cpf
        self.token = DadosOlos.obter_token()

    def ligar(self):
        url = "http://10.0.0.26/WsMailingControl/WSMailingCommand.asmx/UpsertRecordDataJSON"
        
        headers = {"Authorization": f"Bearer {self.token}",
                   "Content-Type": "application/x-www-form-urlencoded"
                   }
        
        ddd = self.telefone[:2]
        numero = self.telefone[2:]

        customer = random.randint(10**5, 10**6 -1) 

        payload  = {"customer": customer,
                            "fields":{
                                        "CPF": self.cpf,
                                        "IDCLIENTE": "0",
                                        "PHONEID1": self.telefone
                                        },
                            "mediaData":[{
                                            "type": 9,
                                            "addr": {
                                                "isd": "55",
                                                "prefix": ddd,
                                                "phone": numero
                                                },
                                            "fields": {
                                                "Phone_Score": 1
                                                }
                                        }]
                            }

        json_playload = json.dumps(payload)

        body = {
                "mailingName":"Portal_PortalAcordo",
                "campaignId": "480",
                "layoutId": "13",
                "json": json_playload
            }

        response = requests.post(url=url, headers=headers, data=body, verify=False)
        