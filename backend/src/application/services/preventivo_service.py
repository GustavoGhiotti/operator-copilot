from datetime import datetime
from src.infrastructure.repositories.sql_preventivo_repository import AtualizarPreventivoRepository, AtualizarPreventivoCombateRepository

class AtualizarPreventivoService:
    def executar(self,id_cliente: int,preventivo,comando: str,id_acordo: int,id_contrato: int,carteira: str) -> bool:
        repo = AtualizarPreventivoRepository()

        atualizado = repo.atualizar_preventivo(id_cliente=id_cliente,preventivo=preventivo)
        if not atualizado:
            return False

        logado = repo.registrar_log(
            id_cliente=id_cliente,
            preventivo=preventivo,
            data=datetime.now(),
            id_acordo=id_acordo,
            id_contrato=id_contrato,
            carteira=carteira,
            comando=comando
        )

        return logado


class AtualizarPreventivoCombateService:
    def executar(self,id_cliente: int,carteira: str,comando: str,preventivo) -> bool:

        repo = AtualizarPreventivoCombateRepository()

        # 1️⃣ Atualiza o campo PREVENTIVO
        atualizado = repo.atualizar_preventivo(id_cliente=id_cliente,preventivo=preventivo)

        if not atualizado:
            return False

        # 2️⃣ Registra log da ação
        log_ok = repo.registrar_log(
            id_cliente=id_cliente,
            carteira=carteira,
            preventivo=preventivo,
            comando=comando,
            data=datetime.now()
        )

        if not log_ok:
            return False

        return True