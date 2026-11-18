from flask import jsonify
from src.infrastructure.repositories.sql_tarefas_repository import *

class ListarTarefasService:
    def executar(self,usuario: str):
        if not usuario:
            return jsonify({"erro":"Usuário não informado"}),400

        dados = TarefasRepository().listar_por_usuario(usuario)

        if isinstance(dados,Exception):
            return jsonify({"erro":"Erro ao buscar todos"}),500

        return dados

class CriarTarefasService:
    def executar(self,data: dict):
        usuario = data.get("usuario")
        titulo = data.get("titulo")
        descricao = data.get("descricao")
        categoria = data.get("categoria")
        prioridade = data.get("prioridade")
        data_vencimento = data.get("data_vencimento")

        if not all([usuario,titulo,categoria,prioridade]):
            return jsonify({"erro":"Campos obrigatórios não informados"}),400

        resultado = TarefasRepository().criar(
            usuario=usuario,
            titulo=titulo,
            descricao=descricao,
            categoria=categoria,
            prioridade=prioridade,
            data_vencimento=data_vencimento
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao criar tarefa"}),500

        return True

class AtualizarTarefasService:
    def executar(self,id_todo: int,data: dict):
        if not id_todo:
            return jsonify({"erro":"ID da tarefa é obrigatório"}),400

        titulo = data.get("titulo")
        descricao = data.get("descricao")
        categoria = data.get("categoria")
        prioridade = data.get("prioridade")
        status = data.get("status","pendente")
        data_vencimento = data.get("data_vencimento")

        if not all([titulo,categoria,prioridade,status]):
            return jsonify({"erro":"Campos obrigatórios não informados"}),400

        resultado = TarefasRepository().atualizar(
            id_todo=id_todo,
            titulo=titulo,
            descricao=descricao,
            categoria=categoria,
            prioridade=prioridade,
            status=status,
            data_vencimento=data_vencimento
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar tarefa"}),500

        return True

class AtualizarStatusTarefasService:
    def executar(self,*,id_todo: int,status: str):
        if not id_todo:
            return jsonify({"erro":"ID da tarefa é obrigatório"}),400

        if not status:
            return jsonify({"erro":"Status é obrigatório"}),400

        if status not in ["pendente","em_andamento","concluido"]:
            return jsonify({"erro":"Status inválido"}),400

        resultado = TarefasRepository().atualizar_status(
            id_todo=id_todo,
            status=status
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar status"}),500

        return True

class ExcluirTodoService:
    def executar(self,*,id_todo: int):
        if not id_todo:
            return jsonify({"erro":"ID da tarefa é obrigatório"}),400

        resultado = TarefasRepository().excluir(id_todo=id_todo)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao excluir tarefa"}),500

        return True
