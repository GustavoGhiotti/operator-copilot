from src.infrastructure.repositories.sql_tabulacoes_repository import TabulacaoRepository


class ValidarTabulacaoMixin:
    def validar_campos(self, tabulacao, descricao, carteira, ocultar):
        if not tabulacao or not str(tabulacao).strip():
            return {
                "erro": "Campo obrigatório",
                "detalhe": "O campo tabulação é obrigatório"
            }

        if not descricao or not str(descricao).strip():
            return {
                "erro": "Campo obrigatório",
                "detalhe": "O campo descrição é obrigatório"
            }

        if not carteira or not str(carteira).strip():
            return {
                "erro": "Campo obrigatório",
                "detalhe": "O campo carteira é obrigatório"
            }

        if ocultar is None:
            return {
                "erro": "Campo obrigatório",
                "detalhe": "O campo ocultar é obrigatório"
            }

        try:
            ocultar = int(ocultar)
        except ValueError:
            return {
                "erro": "Campo inválido",
                "detalhe": "O campo ocultar deve ser 0 ou 1"
            }

        if ocultar not in [0, 1]:
            return {
                "erro": "Campo inválido",
                "detalhe": "O campo ocultar deve ser 0 ou 1"
            }

        return None

    def normalizar_payload(self, tabulacao, descricao, carteira, ocultar):
        return {
            "tabulacao": str(tabulacao).strip().upper(),
            "descricao": str(descricao).strip(),
            "carteira": str(carteira).strip().upper(),
            "ocultar": int(ocultar)
        }


class ListarTabulacoesService:
    def __init__(self):
        self.repository = TabulacaoRepository()

    def executar(self):
        try:
            return self.repository.listar()

        except Exception as e:
            return {
                "erro": "Erro ao listar tabulações",
                "detalhe": str(e)
            }
        
    def executar_operador(self, cartiera):
        try:
            return self.repository.listar_operador(cartiera)

        except Exception as e:
            return {
                "erro": "Erro ao listar tabulações",
                "detalhe": str(e)
            }
        
    


class BuscarTabulacaoPorIdService:
    def __init__(self):
        self.repository = TabulacaoRepository()

    def executar(self, id_tabulacao):
        try:
            return self.repository.buscar_por_id(id_tabulacao)

        except Exception as e:
            return {
                "erro": "Erro ao buscar tabulação",
                "detalhe": str(e)
            }


class CriarTabulacaoService(ValidarTabulacaoMixin):
    def __init__(self):
        self.repository = TabulacaoRepository()

    def executar(self, tabulacao, descricao, carteira, ocultar=1):
        erro_validacao = self.validar_campos(
            tabulacao,
            descricao,
            carteira,
            ocultar
        )

        if erro_validacao:
            return erro_validacao

        # dados = self.normalizar_payload(
        #     tabulacao,
        #     descricao,
        #     carteira,
        #     ocultar
        # )

        id_criado = self.repository.criar(tabulacao, descricao, carteira, ocultar)

        return {
                "status": "criado",
                "mensagem": "Tabulação cadastrada com sucesso",
                "id": id_criado
                # "dados": {
                #     "id": id_criado,
                #     **dados
                # }
            }


        # try:
        #     existente = self.repository.buscar_por_tabulacao_e_carteira(
        #         dados["tabulacao"],
        #         dados["carteira"]
        #     )

        #     if existente:
        #         return {
        #             "erro": "Tabulação já cadastrada",
        #             "detalhe": "Já existe uma tabulação com este nome para esta carteira"
        #         }

        #     id_criado = self.repository.criar(dados)

        #     return {
        #         "status": "criado",
        #         "mensagem": "Tabulação cadastrada com sucesso",
        #         "id": id_criado,
        #         "dados": {
        #             "id": id_criado,
        #             **dados
        #         }
        #     }

        # except Exception as e:
        #     return {
        #         "erro": "Erro ao criar tabulação",
        #         "detalhe": str(e)
        #     }


class AtualizarTabulacaoService(ValidarTabulacaoMixin):
    def __init__(self):
        self.repository = TabulacaoRepository()

    def executar(self, id_tabulacao, tabulacao, descricao, carteira, ocultar):
        try:
            self.repository.atualizar(tabulacao, descricao, carteira, id_tabulacao, ocultar)

            return {
                "status": "atualizado",
                "mensagem": "Tabulação atualizada com sucesso",
                "dados": {
                    "id": id_tabulacao
                }
            }

        except Exception as e:
            return {
                "erro": "Erro ao atualizar tabulação",
                "detalhe": str(e)
            }
        
class OcultarTabulacaoService:
    def __init__(self):
        self.repository = TabulacaoRepository()

    def executar(self, ocultar, id_tabulacao):
        try:
            self.repository.ocultar(ocultar, id_tabulacao)

            return {
                "status": "atualizado",
                "mensagem": "Tabulação atualizada com sucesso",
                "dados": {
                    "id": id_tabulacao
                }
            }

        except Exception as e:
            return {
                "erro": "Erro ao atualizar tabulação",
                "detalhe": str(e)
            }


class DeletarTabulacaoService:
    def __init__(self):
        self.repository = TabulacaoRepository()

    def executar(self, id_tabulacao):
        try:
            self.repository.deletar(id_tabulacao)

            return {
                "status": "deletado",
                "mensagem": "Tabulação deletada com sucesso",
                "id": id_tabulacao
            }

        except Exception as e:
            return {
                "erro": "Erro ao deletar tabulação",
                "detalhe": str(e)
            }