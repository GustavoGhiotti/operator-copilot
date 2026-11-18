import argparse
import hashlib
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
load_dotenv(BACKEND_DIR / ".env")

from src.application.services.aurora_insight_report_service import (  # noqa: E402
    AuroraInsightDailyEmailRenderer,
    AuroraInsightDailyReportService,
    dia_operacional_anterior,
)
from src.infrastructure.clients.smtp_email_client import SMTPEmailClient  # noqa: E402
from src.infrastructure.repositories.sql_aurora_insight_report_repository import (  # noqa: E402
    AuroraInsightReportExecutionRepository,
)


DEFAULT_TEST_RECIPIENT = "colaborador04@empresa.example"


def _env_bool(nome: str, padrao: bool) -> bool:
    valor = os.getenv(nome)
    if valor is None:
        return padrao
    return valor.strip().lower() in {"1", "true", "yes", "sim", "on"}


def _destinatarios() -> list[str]:
    valor = os.getenv("AURORA_INSIGHT_EMAIL_TO", DEFAULT_TEST_RECIPIENT)
    itens = [item.strip().lower() for item in valor.split(",") if item.strip()]
    return list(dict.fromkeys(itens))


def _data_relatorio(
    valor: str | None,
    hoje: date | None = None,
) -> date | None:
    if valor:
        return datetime.strptime(valor, "%Y-%m-%d").date()
    if hoje is None:
        try:
            report_timezone = ZoneInfo(
                os.getenv("AURORA_INSIGHT_TIMEZONE", "America/Sao_Paulo")
            )
        except ZoneInfoNotFoundError:
            report_timezone = timezone(timedelta(hours=-3))
        hoje = datetime.now(report_timezone).date()
    if hoje.weekday() == 6:
        return None
    return dia_operacional_anterior(hoje)


def _criar_email_client() -> SMTPEmailClient:
    username = os.getenv("SMTP_USERNAME", "").strip()
    sender = os.getenv("EMAIL_FROM", "").strip() or username
    default_host = "smtp.gmail.com" if username else "smtp-relay.gmail.com"
    return SMTPEmailClient(
        host=os.getenv("SMTP_HOST", default_host).strip(),
        port=int(os.getenv("SMTP_PORT", "587")),
        sender=sender,
        username=username,
        password=os.getenv("SMTP_PASSWORD", ""),
        use_starttls=_env_bool("SMTP_USE_STARTTLS", True),
        use_ssl=_env_bool("SMTP_USE_SSL", False),
        timeout_seconds=int(os.getenv("SMTP_TIMEOUT_SECONDS", "30")),
    )


def executar(
    *,
    data_relatorio: date,
    dry_run: bool = False,
    forcar: bool = False,
    output: str | None = None,
) -> dict:
    destinatarios = _destinatarios()
    relatorio = AuroraInsightDailyReportService().gerar(data_relatorio)
    renderer = AuroraInsightDailyEmailRenderer()
    assunto = renderer.assunto(relatorio)
    texto = renderer.texto(relatorio)
    html = renderer.html(relatorio)

    if output:
        Path(output).resolve().write_text(html, encoding="utf-8")

    resultado = {
        "status": "simulado" if dry_run else "pendente",
        "data_relatorio": data_relatorio.isoformat(),
        "destinatarios": destinatarios,
        "assunto": assunto,
        "total_perguntas": relatorio["summary"]["total_perguntas"],
        "output": str(Path(output).resolve()) if output else None,
    }
    if dry_run:
        return resultado

    destinatarios_texto = ",".join(sorted(destinatarios))
    chave_destinatarios = hashlib.sha256(
        destinatarios_texto.encode("utf-8")
    ).hexdigest()
    execucoes = AuroraInsightReportExecutionRepository()
    adquirido = execucoes.adquirir_execucao(
        data_relatorio=data_relatorio,
        chave_destinatarios=chave_destinatarios,
        destinatarios=destinatarios_texto,
        forcar=forcar,
    )
    if not adquirido:
        resultado["status"] = "ignorado"
        resultado["motivo"] = "Relatório já enviado ou em processamento."
        return resultado

    try:
        message_id = _criar_email_client().enviar(
            destinatarios=destinatarios,
            assunto=assunto,
            texto=texto,
            html=html,
        )
        execucoes.marcar_enviado(
            data_relatorio=data_relatorio,
            chave_destinatarios=chave_destinatarios,
            message_id=message_id,
        )
        resultado["status"] = "enviado"
        resultado["message_id"] = message_id
        return resultado
    except Exception as exc:
        execucoes.marcar_falha(
            data_relatorio=data_relatorio,
            chave_destinatarios=chave_destinatarios,
            erro=str(exc),
        )
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Envia o fechamento diário do Aurora Insight."
    )
    parser.add_argument(
        "--date",
        help=(
            "Data do fechamento no formato YYYY-MM-DD. "
            "Padrão: último dia operacional, desconsiderando domingo."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Gera o relatório sem enviar e-mail ou registrar execução.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Reenvia mesmo que o fechamento já esteja marcado como enviado.",
    )
    parser.add_argument(
        "--output",
        help="Caminho opcional para salvar a prévia HTML.",
    )
    args = parser.parse_args()

    data_relatorio = _data_relatorio(args.date)
    if data_relatorio is None:
        print(json.dumps({
            "status": "ignorado",
            "motivo": "Domingo não possui execução automática.",
        }, ensure_ascii=False, indent=2))
        return

    resultado = executar(
        data_relatorio=data_relatorio,
        dry_run=args.dry_run,
        forcar=args.force,
        output=args.output,
    )
    print(json.dumps(resultado, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
