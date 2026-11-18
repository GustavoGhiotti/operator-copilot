from src.infrastructure.repositories.pequisa_gama_repository import PesquisaSatisfacaoRepository

class GravarPesquisaService:
    def executar(self,operador: str,nm_cliente: str,cpf_cliente: str,resposta_1):
        if not operador or not nm_cliente or not cpf_cliente or not resposta_1:
            return False

        return PesquisaSatisfacaoRepository().registrar_gama(operador,nm_cliente,cpf_cliente,resposta_1)