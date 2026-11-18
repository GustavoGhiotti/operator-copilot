from datetime import datetime
from flask import jsonify
from src.infrastructure.repositories.sql_agendamentos_repository import AgendamentosRepository


class ListarAgendamentoService:
    def executar(self,usuario: str):
        rows = AgendamentosRepository().listar(usuario)

        if not rows:
            return []

        agendamentos = []

        for row in rows:
            ag = {
                "id": row.get("ID_AGENDAMENTO"),
                "nome": row.get("NOME_CLIENTE"),
                "cpf": row.get("CPF_CLIENTE"),
                "ec": row.get("EC"),
                "horario_retorno": row.get("HORARIO_RETORNO"),
                "data_criacao": row.get("DATA_CRIACAO")
            }

            if isinstance(ag["horario_retorno"],datetime):
                ag["horario_retorno"] = ag["horario_retorno"].strftime("%Y-%m-%d %H:%M:%S")

            if isinstance(ag["data_criacao"],datetime):
                ag["data_criacao"] = ag["data_criacao"].strftime("%Y-%m-%d %H:%M:%S")

            agendamentos.append(ag)

        return agendamentos


class CriarAgendamentoService:
    def executar(self,usuario,nome,cpf,ec,horario_retorno):
        if not all([usuario,nome,cpf,ec,horario_retorno]):
            return jsonify({"erro":"Dados obrigatórios não informados"}),400

        try:
            horario_formatado = datetime.strptime(horario_retorno,"%Y-%m-%dT%H:%M").strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            return jsonify({"erro":f"Data inválida: {str(e)}"}),400

        resultado = AgendamentosRepository().criar(usuario,nome,cpf,ec,horario_formatado)

        if isinstance(resultado,Exception):
            return jsonify({"erro":str(resultado)}),500

        return True


class ExcluirAgendamentoService:
    def executar(self,agendamento_id):
        if not agendamento_id:
            return jsonify({"erro":"ID do agendamento é obrigatório"}),400

        resultado = AgendamentosRepository().excluir(agendamento_id)

        if isinstance(resultado,Exception):
            return jsonify({"erro":str(resultado)}),500

        return True