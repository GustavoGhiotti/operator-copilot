from unittest.mock import MagicMock, patch

from src.infrastructure.clients.smtp_email_client import SMTPEmailClient


@patch("src.infrastructure.clients.smtp_email_client.smtplib.SMTP")
def test_envio_smtp_com_starttls_e_autenticacao(mock_smtp):
    conexao = MagicMock()
    mock_smtp.return_value.__enter__.return_value = conexao
    client = SMTPEmailClient(
        host="smtp.example.com",
        port=587,
        sender="aurora@example.com",
        username="usuario",
        password="segredo",
    )

    message_id = client.enviar(
        destinatarios=["destino@example.com"],
        assunto="Relatório",
        texto="Resumo",
        html="<strong>Resumo</strong>",
    )

    conexao.starttls.assert_called_once()
    conexao.login.assert_called_once_with("usuario", "segredo")
    conexao.send_message.assert_called_once()
    assert "@example.com>" in message_id
