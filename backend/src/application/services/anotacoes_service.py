from flask import jsonify
from src.infrastructure.repositories.sql_anotacoes_repository import AnotacoesRepository

repo = AnotacoesRepository()

CORES_POSTIT = {
    "automatico",
    "amarelo",
    "verde",
    "azul",
    "rosa",
    "lilas",
    "laranja"
}

def normalizar_preferencias(cor_postit, importante, fixado):
    cor = (cor_postit or "automatico").strip().lower()
    if cor not in CORES_POSTIT:
        return None

    return {
        "cor_postit": cor,
        "importante": bool(importante),
        "fixado": bool(fixado)
    }

class ListarAnotacoesService:
    def executar(self,usuario:str,destinatario:str,visao:str):
        

        if visao == "supervisor":
            if not usuario:
                return jsonify({"erro":"Usuário não informado"}),400
            dados = repo.listar_visao_supervisor(usuario)

        elif usuario:
            dados = repo.listar_por_usuario(usuario)

        elif destinatario:
            dados = repo.listar_por_destinatario(destinatario)

        else:
            return []

        if isinstance(dados,Exception):
            return jsonify({"erro":"Erro ao buscar anotações"}),500

        return dados

class CriarAnotacaoService:
    def executar(
        self,
        usuario,
        titulo,
        conteudo,
        categoria,
        destinatario,
        tipo_boleto,
        data_vencimento,
        cor_postit,
        importante,
        fixado
    ):
        if not usuario or not titulo or not categoria:
            return jsonify({"erro":"Campos obrigatórios não informados"}),400

        preferencias = normalizar_preferencias(
            cor_postit,
            importante,
            fixado
        )
        if preferencias is None:
            return jsonify({"erro":"Cor do post-it inválida"}),400

        is_manual = 1 if categoria == "envio_manual" else 0

        resultado = repo.criar(
            usuario.strip(),
            titulo.strip(),
            conteudo.strip() if conteudo else None,
            categoria.strip(),
            destinatario.strip() if destinatario else None,
            is_manual,
            tipo_boleto.strip() if tipo_boleto else None,
            data_vencimento,
            preferencias["cor_postit"],
            preferencias["importante"],
            preferencias["fixado"]
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao criar anotação"}),500

        return True

class AtualizarAnotacaoService:
    def executar(
        self,
        id_anotacao,
        titulo,
        conteudo,
        categoria,
        tipo_boleto,
        data_vencimento,
        cor_postit,
        importante,
        fixado
    ):
        if not id_anotacao:
            return jsonify({"erro":"ID da anotação não informado"}),400

        if not titulo or not categoria:
            return jsonify({"erro":"Campos obrigatórios não informados"}),400

        preferencias = normalizar_preferencias(
            cor_postit,
            importante,
            fixado
        )
        if preferencias is None:
            return jsonify({"erro":"Cor do post-it inválida"}),400

        resultado = repo.atualizar(
            id_anotacao,
            titulo.strip(),
            conteudo.strip() if conteudo else None,
            categoria.strip(),
            tipo_boleto.strip() if tipo_boleto else None,
            data_vencimento,
            preferencias["cor_postit"],
            preferencias["importante"],
            preferencias["fixado"]
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar anotação"}),500

        return True

class AtualizarPreferenciasAnotacaoService:
    def executar(
        self,
        id_anotacao,
        cor_postit,
        importante,
        fixado
    ):
        if not id_anotacao:
            return jsonify({"erro":"ID da anotação não informado"}),400

        preferencias = normalizar_preferencias(
            cor_postit,
            importante,
            fixado
        )
        if preferencias is None:
            return jsonify({"erro":"Cor do post-it inválida"}),400

        resultado = repo.atualizar_preferencias(
            id_anotacao,
            preferencias["cor_postit"],
            preferencias["importante"],
            preferencias["fixado"]
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar preferências"}),500

        return True

class DeletarAnotacaoService:
    def executar(self,id_anotacao):
        if not id_anotacao:
            return jsonify({"erro":"ID da anotação não informado"}),400

        resultado = repo.excluir(id_anotacao)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao excluir anotação"}),500

        return True

class ExcluirAnotacoesConfirmadasService:
    def executar(self):
        resultado = repo.excluir_confirmadas_manuais()

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao excluir anotações confirmadas"}),500

        return True

class ConfirmarAnotacaoService:
    def executar(self,id_anotacao):
        if not id_anotacao:
            return jsonify({"erro":"ID da anotação não informado"}),400

        resultado = repo.confirmar(id_anotacao)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao confirmar anotação"}),500

        return True
