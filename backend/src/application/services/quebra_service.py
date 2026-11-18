from datetime import datetime
from src.infrastructure.repositories.sql_quebra_repository import AtualizarQuebraCombateRepository, AtualizarQuebraRepository

class AtualizarQuebraService:
    def executar(self,id_cliente: int,quebra,comando: str,id_acordo: int,id_contrato: int,carteira: str) -> bool:
        repo = AtualizarQuebraRepository()

        atualizado = repo.atualizar_quebra(id_cliente=id_cliente,quebra=quebra)
        if not atualizado:
            return False

        logado = repo.registrar_log(
            id_cliente=id_cliente,
            carteira=carteira,
            quebra=quebra,
            data=datetime.now(),
            id_acordo=id_acordo,
            id_contrato=id_contrato,
            comando=comando
        )

        return logado



class AtualizarQuebraCombateService:
    def executar(self,id_cliente:int,carteira:str,comando:str,quebra:str) -> bool:
        repo = AtualizarQuebraCombateRepository()

        atualizado = repo.atualizar_quebra(id_cliente,quebra)
        if not atualizado:
            return False

        log_ok = repo.registrar_log(id_cliente,carteira,quebra,comando,datetime.now())
        if not log_ok:
            return False

        return True
