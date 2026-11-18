import requests, time
from requests.auth import HTTPBasicAuth

from src.shared.utils.env_load import USER_API, PASSWORD_API
from src.shared.errors.acme_api_exceptions import TokenInvalido


class AcmeAPI:
    def __init__(self):
        self.url_base = "http://10.0.0.91:81"


class Token(AcmeAPI):
    _token: str | None = None
    _token_timestamp: float | None = None
    _token_duracao: int | None = None

    def __init__(self):
        super().__init__()

    @staticmethod
    def _tempo_para_segundos(hms: str) -> int:
        horas, minutos, segundos = map(int, hms.split(":"))
        return horas * 3600 + minutos * 60 + segundos

    def _gerar_token(self) -> tuple[str, int]:
        try:
            url = f"{self.url_base}/auth/token"

            response = requests.get(
                url=url,
                auth=HTTPBasicAuth(USER_API, PASSWORD_API),
                timeout=20
            )
            
            response.raise_for_status()

            result = response.json()

            token = result.get("token")
            expira_em = result.get("expira_em")

            if not token or not expira_em:
                raise TokenInvalido("Resposta invalida ao obter token da API Acme")

            tempo_str = expira_em.split("-")[-1].strip()
            duracao_token = self._tempo_para_segundos(tempo_str)

            return token, duracao_token

        except Exception as e:
            print(e)
            raise TokenInvalido("Erro obter token da API Acme")

    def obter_token(self) -> str:
        agora = time.time()

        if (
            self._token
            and self._token_timestamp
            and self._token_duracao
            and (agora - self._token_timestamp) < self._token_duracao
        ):
            return self._token

        # gera novo token
        token, duracao = self._gerar_token()

        # Grava no atributo de CLASSE para que o cache seja compartilhado entre
        # todas as instancias (Emitir, ConsultarAcordos, MensagemWhatsapp, ...).
        # Usar self._token aqui criaria um atributo de instancia, deixando o
        # cache de classe sempre vazio e forcando um novo GET /auth/token a cada
        # wrapper instanciado.
        Token._token = token
        Token._token_timestamp = agora
        Token._token_duracao = duracao

        return token


