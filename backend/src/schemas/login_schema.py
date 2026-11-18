from pydantic import BaseModel

class LoginRequest(BaseModel):
    cpf_colaborador:str
    senha:str