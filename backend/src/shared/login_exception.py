class LoginException(Exception):
    def __init__(self, mensagem:str, status_code:int):
        super().__init__(mensagem)
        self.status_code = status_code

    