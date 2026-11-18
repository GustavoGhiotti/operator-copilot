import re

from flask import jsonify
from src.infrastructure.repositories.sql_matriculas_repository import *

repo = MatriculasRepository()

class ListarMatriculasService:
    def executar(self):

        dados = repo.listar_todas()

        if isinstance(dados,Exception):
            return jsonify({"erro":"Erro ao buscar todos"}),500

        return dados


class GravarMatriculaService:
    def executar(self, nome: str, usuario: str):

        if not nome or not usuario:
            return jsonify({"erro":"Dados incompletos para gravar matricula"}),500

        gravar = repo.gravar_matricula(nome, usuario)

        if isinstance(gravar,Exception):
            return jsonify({"erro":"Erro ao cadastrar nova matricula"}),500

        return True
    
class GravarMatriculaLoteService:
    def executar(self, registros):
        if not isinstance(registros, list) or not registros:
            return jsonify({"erro": "Nenhum registro informado."}), 400

        validos = []
        erros = []
        matriculas_vistas = set()

        for index, item in enumerate(registros, start=1):
            nome = str(item.get("nome", "")).strip()
            matricula = str(item.get("matricula", "")).strip().upper()

            if not nome:
                erros.append(f"Linha {index}: nome não informado.")
                continue

            if not re.fullmatch(r"X[A-Z0-9]{6}", matricula):
                erros.append(
                    f"Linha {index}: matrícula '{matricula}' inválida. Deve começar com X e ter 7 caracteres."
                )
                continue

            if matricula in matriculas_vistas:
                erros.append(f"Linha {index}: matrícula '{matricula}' duplicada na lista.")
                continue

            matriculas_vistas.add(matricula)
            validos.append({
                "nome": nome,
                "matricula": matricula
            })

        if erros:
            return jsonify({
                "erro": "Foram encontrados erros na lista.",
                "detalhes": erros
            }), 400

        resultado = repo.gravar_lote(validos)

        if isinstance(resultado, tuple):
            return resultado

        return {
            "mensagem": "Matrículas gravadas com sucesso.",
            "quantidade": len(validos)
        }
        

class AtualizarMatriculaService:
    def executar(self, matricula, nome: str, usuario: str):

        if not matricula or not nome or not usuario:
            return jsonify({"erro":"Dados incompletos para atualizar dados"}),500

        atualizar = repo.atualizar_matricula(matricula, nome, usuario)

        if isinstance(atualizar,Exception):
            return jsonify({"erro":"Erro ao atualizar dados"}),500

        return True


class DeletarMatriculaService:
    def executar(self,matricula: str):
        if not matricula:
            return False

        return repo.deletar_matricula(matricula)


class DeletarMultService:
    def executar(self, matriculas):
        if not isinstance(matriculas, list) or not matriculas:
            return 0

        # normalização: remove nulos/vazios e deduplica mantendo ordem
        limpas = []
        seen = set()
        for m in matriculas:
            if m is None:
                continue
            m = str(m).strip()
            if not m:
                continue
            if m not in seen:
                seen.add(m)
                limpas.append(m)

        if not limpas:
            return 0

        return repo.deletar_multiplas(limpas)
