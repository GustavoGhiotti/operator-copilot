from flask import jsonify
from src.infrastructure.repositories.sql_quiz_repository import *

class QuizRankingService:
    def __init__(self):
        self.repo = QuizRankingRepository()

    def gerar_ranking(self,periodo: str):
        linhas = self.repo.buscar_pontos(periodo)

        if not linhas:
            return []

        ranking = []

        for idx, row in enumerate(linhas, start=1):
            ranking.append({
                "nome": row.get("NOME_USUARIO","").strip(),
                "pontos": int(row.get("TOTAL_PONTOS",0)),
                "posicao": idx
            })

        return ranking

class QuizListarTemasService:
    def executar(self,centro_custo: str):
        resultado = QuizListarTemasRepository().buscar(centro_custo)

        if not resultado:
            return []

        temas = []

        for row in resultado:
            temas.append({
                "id": str(row.get("ID")),
                "codigo": row.get("TEMA"),
                "title": row.get("TITULO"),
                "description": row.get("DESCRICAO"),
                "centro_custo": row.get("CENTRO_CUSTO") or ""
            })

        return temas    

class QuizListarPerguntasService:
    def executar(self,tema_codigo: str,centro_custo: str,usuario: str):
        repo = QuizListarPerguntasRepository()

        id_tema = repo.buscar_id_tema(tema_codigo)

        if not id_tema:
            return {"erro":"Tema não encontrado","status":404}

        if repo.usuario_ja_respondeu(usuario,id_tema):
            return {"erro":"Você já completou esse tema hoje","status":403}

        perguntas_db = repo.buscar_perguntas(id_tema,centro_custo)

        if not perguntas_db:
            return {"erro":f"Nenhuma pergunta encontrada para '{centro_custo}' hoje","status":404}

        perguntas = []

        for row in perguntas_db:
            pergunta_id = row.get("ID")
            texto_pergunta = row.get("PERGUNTA")

            respostas_db = repo.buscar_respostas(pergunta_id)

            respostas = []

            for r in respostas_db:
                respostas.append({
                    "id": r.get("ID"),
                    "text": r.get("TEXTO"),
                    "points": r.get("PONTOS"),
                    "explanation": r.get("EXPLICACAO")
                })

            perguntas.append({
                "question": texto_pergunta,
                "answers": respostas
            })

        return perguntas


class QuizPerguntasAdminService:
    def listar(self):
        resultado = QuizPerguntasRepository().listar_todas()

        return [{
            "id":str(id),
            "tema_id":str(id_tema),
            "question":pergunta,
            "available_date":dt.strftime("%Y-%m-%d")
        } for id,id_tema,pergunta,dt in resultado]

    def criar(self,data: dict):
        QuizPerguntasRepository().criar(data["tema_id"],data["question"],data["available_date"],data.get("centro_custo","").strip().upper())

    def atualizar(self,id: str,data: dict):
        QuizPerguntasRepository().atualizar(id,data["tema_id"],data["question"],data["available_date"])

    def deletar(self,id: str):
        QuizPerguntasRepository().deletar(id)




class QuizTemasService:
    def executar(self,centro_custo: str):
        resultado = QuizTemasRepository().listar(centro_custo)

        if not resultado:
            return None

        return [{
            "id":str(id),
            "codigo":tema,
            "title":titulo,
            "description":descricao,
            "centro_custo":centro or ""
        } for id,tema,titulo,descricao,centro in resultado]

    def criar(self,data: dict):
        QuizTemasRepository().criar(data["codigo"],data["title"],data.get("description",""),data.get("centro_custo","").strip().upper())

    def atualizar(self,id: str,data: dict):
        QuizTemasRepository().atualizar(id,data["codigo"],data["title"],data.get("description",""))

    def deletar(self,id: str):
        QuizTemasRepository().deletar(id)

class QuizResponderService:
    def executar(self,usuario,id_tema,id_resposta,pontos):
        if not usuario or not id_tema or id_resposta is None or pontos is None:
            return jsonify({"erro":"Dados incompletos"}),400

        usuario = usuario.strip().upper()

        resultado = QuizResponderRepository().registrar_resposta(usuario,id_tema,id_resposta,pontos)

        if isinstance(resultado,Exception):
            return jsonify({"erro":f"Erro ao registrar resposta: {str(resultado)}"}),500

        return True
    
class QuizFinalizarService:
    def executar(self,usuario,tema_codigo,pontos):
        if not usuario or not tema_codigo or pontos is None:
            return jsonify({"erro":"Dados incompletos"}),400

        usuario = usuario.strip().upper()
        tema_codigo = tema_codigo.strip().upper()

        repo = QuizFinalizarRepository()

        id_tema = repo.buscar_id_tema(tema_codigo)

        if not id_tema:
            return jsonify({"erro":"Tema inválido"}),400

        resultado = repo.registrar_finalizacao(usuario,id_tema,pontos)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao salvar resposta"}),500

        return True
    
class QuizPontuacaoService:
    def executar(self,usuario: str):
        repo = QuizPontuacaoRepository()

        pontos_por_tema = repo.buscar_total_por_tema(usuario)

        if isinstance(pontos_por_tema,Exception):
            return jsonify({"erro":"Erro ao consultar pontuação"}),500

        total_points = sum(pontos_por_tema.values())

        daily_points = repo.buscar_pontos_hoje(usuario) or 0

        return {
            "totalPoints": total_points,
            "dailyPoints": daily_points,
            "porTema": pontos_por_tema
        }
    
class QuizListarRespostasService:
    def executar(self):
        rows = QuizRespostasRepository().listar_todas()

        if not rows:
            return []

        respostas = []

        for row in rows:
            respostas.append({
                "question_id": str(row.get("ID_PERGUNTA")),
                "text": row.get("TEXTO"),
                "explanation": row.get("EXPLICACAO"),
                "points": int(row.get("PONTOS",0))
            })

        return respostas

class QuizCriarRespostasService:
    def executar(self,id_pergunta,respostas):
        if not id_pergunta or not respostas:
            return jsonify({"erro":"Dados inválidos"}),400

        repo = QuizRespostasRepository()

        for resp in respostas:
            if not all(k in resp for k in ("text","explanation","points")):
                return jsonify({"erro":"Resposta mal formada"}),400

            resultado = repo.criar(
                id_pergunta,
                resp.get("text"),
                resp.get("explanation"),
                resp.get("points")
            )

            if isinstance(resultado,Exception):
                return jsonify({"erro":"Erro ao salvar respostas"}),500

        return True

class QuizConcluidosService:
    def executar(self,usuario: str):
        repo = QuizConcluidosRepository()

        ids = repo.buscar_concluidos_hoje(usuario)

        if isinstance(ids,Exception):
            return jsonify({"erro":"Erro ao consultar respostas"}),500

        return ids or []
class QuizOperadoresService:
    def executar(self,nome: str):
        repo = QuizOperadoresRepository()

        operadores = repo.listar(nome)

        if isinstance(operadores,Exception):
            return jsonify({"erro":"Erro ao buscar operadores"}),500

        return operadores or []
    
class QuizAnaliseOperadorService:
    def executar(self,operador: str):
        repo = QuizAnaliseOperadorRepository()

        resumo = repo.buscar_resumo_hoje(operador)

        if not resumo:
            return jsonify({"erro":"Erro ao buscar resumo"}),500

        detalhes = repo.buscar_detalhes_hoje(operador)

        return {
            "totalRespostas": resumo.get("TOTALRESPOSTAS",0),
            "respostasCorretas": resumo.get("RESPOSTASCORRETAS",0),
            "respostasParciais": resumo.get("RESPOSTASPARCIAIS",0),
            "respostasIncorretas": resumo.get("RESPOSTASINCORRETAS",0),
            "porcentagemAcerto": float(resumo.get("PORCENTAGEMACERTO") or 0),
            "pontosTotal": resumo.get("PONTOSTOTAL",0),
            "detalhes": detalhes or []
        }

class QuizPremiosService:
    def executar(self):
        repo = QuizPremiosRepository()

        premios = repo.listar_disponiveis()

        if isinstance(premios,Exception):
            return jsonify({"erro":"Erro ao buscar prêmios"}),500

        return premios
    
class QuizCriarPremioService:
    def executar(self,nome,descricao,pontos,categoria,icone,disponivel,quantidade):
        if not nome or not pontos or not categoria:
            return jsonify({"erro":"Dados obrigatórios não informados"}),400

        try:
            pontos = int(pontos)
            quantidade = int(quantidade) if quantidade is not None else None
            disponivel = bool(disponivel)
        except Exception:
            return jsonify({"erro":"Valores numéricos inválidos"}),400

        resultado = QuizPremiosRepository().criar(
            nome.strip(),
            descricao.strip() if descricao else None,
            pontos,
            categoria.strip(),
            icone.strip() if icone else None,
            disponivel,
            quantidade
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao criar prêmio"}),500

        return True

class QuizAtualizarPremioService:
    def executar(self,id_premio,nome,descricao,pontos,categoria,icone,disponivel,quantidade):
        if not id_premio:
            return jsonify({"erro":"ID do prêmio não informado"}),400

        if not nome or not pontos or not categoria:
            return jsonify({"erro":"Dados obrigatórios não informados"}),400

        try:
            pontos = int(pontos)
            quantidade = int(quantidade) if quantidade is not None else None
            disponivel = bool(disponivel)
        except Exception:
            return jsonify({"erro":"Valores numéricos inválidos"}),400

        resultado = QuizPremiosRepository().atualizar(
            id_premio,
            nome.strip(),
            descricao.strip() if descricao else None,
            pontos,
            categoria.strip(),
            icone.strip() if icone else None,
            disponivel,
            quantidade
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar prêmio"}),500

        return True

class QuizExcluirPremioService:
    def executar(self,id_premio):
        if not id_premio:
            return jsonify({"erro":"ID do prêmio não informado"}),400

        resultado = QuizPremiosRepository().excluir(id_premio)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao excluir prêmio"}),500

        return True
    
class QuizMeusResgatesService:
    def executar(self,usuario: str):
        if not usuario:
            return jsonify({"erro":"Usuário não informado"}),400

        resgates = QuizResgatesRepository().listar_por_usuario(usuario)

        if isinstance(resgates,Exception):
            return jsonify({"erro":"Erro ao buscar resgates"}),500

        return resgates

class QuizResgatarPremioService:
    def executar(self,usuario,premio_id,pontos_gastos):
        if not usuario or not premio_id or not pontos_gastos:
            return jsonify({"erro":"Dados incompletos"}),400

        try:
            premio_id = int(premio_id)
            pontos_gastos = int(pontos_gastos)
            usuario = usuario.strip().upper()
        except Exception:
            return jsonify({"erro":"Valores inválidos"}),400

        repo = QuizResgatesRepository()

        try:
            repo.resgatar(usuario,premio_id,pontos_gastos)
        except ValueError as e:
            return jsonify({"erro":str(e)}),403
        except Exception:
            return jsonify({"erro":"Erro ao realizar resgate"}),500

        return True
