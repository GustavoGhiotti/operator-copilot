from unittest.mock import patch

from src.infrastructure.external.acmeAPI.token import Token


def _resetar_cache_token():
    Token._token = None
    Token._token_timestamp = None
    Token._token_duracao = None


def test_token_cacheado_entre_instancias_nao_refaz_http():
    _resetar_cache_token()

    with patch.object(
        Token, "_gerar_token", return_value=("token-abc", 3600)
    ) as gerar:
        primeiro = Token().obter_token()
        # Uma nova instancia (como acontece em cada wrapper de API) deve
        # reaproveitar o cache de classe em vez de gerar outro token.
        segundo = Token().obter_token()

    assert primeiro == "token-abc"
    assert segundo == "token-abc"
    gerar.assert_called_once()


def test_token_regenera_quando_expira():
    _resetar_cache_token()

    with patch.object(
        Token, "_gerar_token", side_effect=[("token-1", 3600), ("token-2", 3600)]
    ) as gerar:
        primeiro = Token().obter_token()

        # Simula token vencido: timestamp muito no passado.
        Token._token_timestamp = 0.0
        segundo = Token().obter_token()

    assert primeiro == "token-1"
    assert segundo == "token-2"
    assert gerar.call_count == 2
