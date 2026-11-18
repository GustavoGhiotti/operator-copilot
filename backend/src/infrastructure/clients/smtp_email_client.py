import smtplib
from email.message import EmailMessage
from email.utils import make_msgid


class SMTPEmailClient:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        sender: str,
        username: str = "",
        password: str = "",
        use_starttls: bool = True,
        use_ssl: bool = False,
        timeout_seconds: int = 30,
    ):
        if not host:
            raise ValueError("SMTP_HOST não configurado.")
        if not sender:
            raise ValueError("EMAIL_FROM não configurado.")
        if bool(username) != bool(password):
            raise ValueError("SMTP_USERNAME e SMTP_PASSWORD devem ser informados juntos.")
        if use_ssl and use_starttls:
            raise ValueError("Use apenas SMTP_USE_SSL ou SMTP_USE_STARTTLS.")

        self.host = host
        self.port = port
        self.sender = sender
        self.username = username
        self.password = password
        self.use_starttls = use_starttls
        self.use_ssl = use_ssl
        self.timeout_seconds = timeout_seconds

    def enviar(
        self,
        *,
        destinatarios: list[str],
        assunto: str,
        texto: str,
        html: str,
    ) -> str:
        if not destinatarios:
            raise ValueError("Nenhum destinatário configurado.")

        domain = self.sender.rsplit("@", 1)[-1] if "@" in self.sender else None
        message_id = make_msgid(domain=domain)
        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = ", ".join(destinatarios)
        message["Subject"] = assunto
        message["Message-ID"] = message_id
        message.set_content(texto)
        message.add_alternative(html, subtype="html")

        smtp_class = smtplib.SMTP_SSL if self.use_ssl else smtplib.SMTP
        with smtp_class(self.host, self.port, timeout=self.timeout_seconds) as smtp:
            if self.use_starttls:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
            if self.username:
                smtp.login(self.username, self.password)
            smtp.send_message(message)

        return message_id
