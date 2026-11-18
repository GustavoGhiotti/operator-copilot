from flask import jsonify
from src.infrastructure.repositories.sql_simulacao_repository import *

class SimulacaoService:
    def criar_simulacao(self,operador_nome: str,centro_custo: str) -> int:
        simulacao_id = SimulacaoRepository().criar(operador_nome,centro_custo)

        if not simulacao_id:
            raise RuntimeError("Falha ao criar simulação de treinamento")

        return simulacao_id

class SimulacaoCenariosService:
    def executar(self,usuario: str,centro_custo: str):
        if not usuario:
            return jsonify({"erro":"Parâmetro 'nome' é obrigatório"}),400

        if not centro_custo:
            return jsonify({"erro":"Parâmetro 'centro_custo' é obrigatório"}),400

        rows = SimulacaoCenariosRepository().listar(usuario,centro_custo)

        if isinstance(rows,Exception):
            return jsonify({"erro":"Erro ao buscar cenários"}),500

        cenarios = {}

        for row in rows:
            cid = row["CENARIO_ID"]

            if cid not in cenarios:
                cenarios[cid] = {
                    "id": str(cid),
                    "title": row["TITULO"],
                    "description": row["DESCRICAO"],
                    "icon": row["ICONE"],
                    "difficulty": row["DIFICULDADE"],
                    "maxPoints": row["MAX_PONTOS"],
                    "respondido": bool(row["RESPONDIDO"]),
                    "interactions": {}
                }

            iid = row["INTERACAO_ID"]
            if iid and iid not in cenarios[cid]["interactions"]:
                cenarios[cid]["interactions"][iid] = {
                    "id": iid,
                    "clientMessage": row["MENSAGEM_CLIENTE"],
                    "options": []
                }

            if row["RESPOSTA_ID"]:
                cenarios[cid]["interactions"][iid]["options"].append({
                    "id": row["RESPOSTA_ID"],
                    "text": row["TEXTO_RESPOSTA"],
                    "points": row["PONTOS"],
                    "feedback": row["FEEDBACK"],
                    "isPositive": bool(row["IS_POSITIVA"]),
                    "nextInteractionId": row["NEXT_INTERACAO_ID"]
                })

        return [
            {**c,"interactions":list(c["interactions"].values())}
            for c in cenarios.values()
        ]

class SimulacaoSalvarRespostasService:
    def executar(self,respostas):
        if not respostas or not isinstance(respostas,list):
            return jsonify({"erro":"Nenhuma resposta válida recebida"}),400

        try:
            SimulacaoRespostasRepository().salvar(respostas)
        except ValueError as e:
            return jsonify({"erro":str(e)}),400
        except Exception:
            return jsonify({"erro":"Erro ao salvar respostas"}),500

        return True

class SimulacaoPontuacaoService:
    def executar(self,usuario: str):
        if not usuario:
            return jsonify({"erro":"Nome do usuário não informado"}),400

        dados = SimulacaoPontuacaoRepository().buscar(usuario)

        if isinstance(dados,Exception):
            return jsonify({"erro":"Erro ao consultar pontuação"}),500

        return dados

class SimulacaoPontuacaoPorCenarioService:
    def executar(self,usuario: str):
        if not usuario:
            return jsonify({"erro":"Nome do usuário ausente"}),400

        dados = SimulacaoPontuacaoPorCenarioRepository().buscar(usuario)

        if isinstance(dados,Exception):
            return jsonify({"erro":"Erro ao buscar dados"}),500

        return dados

from flask import jsonify

class SimulacaoRankingService:
    def executar(self,periodo: str,usuario: str | None):
        if periodo not in ("dia","semana","mes"):
            return jsonify({"erro":"Período inválido"}),400

        dados = SimulacaoRankingRepository().buscar_ranking(periodo,usuario)

        if isinstance(dados,Exception):
            return jsonify({"erro":"Erro ao buscar ranking"}),500

        ranking = []
        for posicao,row in enumerate(dados,1):
            ranking.append({
                "nome": row["NOME_USUARIO"],
                "pontos": row["TOTAL_PONTOS"],
                "posicao": posicao
            })

        return ranking

class SimulacaoCriarCenarioService:
    def executar(self,centro_custo,titulo,descricao,icone,dificuldade,max_pontos):
        if not all([titulo,descricao,icone,dificuldade,max_pontos]):
            return jsonify({"erro":"Todos os campos são obrigatórios"}),400

        try:
            max_pontos = int(max_pontos)
        except Exception:
            return jsonify({"erro":"maxPoints inválido"}),400

        centro_custo = centro_custo.strip().upper() if centro_custo else None

        resultado = SimulacaoCenarioRepository().criar(
            titulo.strip(),
            descricao.strip(),
            icone.strip(),
            dificuldade.strip(),
            max_pontos,
            centro_custo
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao criar cenário"}),500

        return True

class SimulacaoListarCenariosService:
    def executar(self):
        dados = SimulacaoCenarioRepository().listar()

        if isinstance(dados,Exception):
            return jsonify({"erro":"Erro ao buscar cenários"}),500

        return dados
    
class SimulacaoAtualizarCenarioService:
    def executar(self,id_cenario,centro_custo,titulo,descricao,icone,dificuldade,max_pontos):
        if not id_cenario:
            return jsonify({"erro":"ID do cenário não informado"}),400

        if not all([titulo,descricao,icone,dificuldade,max_pontos]):
            return jsonify({"erro":"Todos os campos são obrigatórios"}),400

        try:
            max_pontos = int(max_pontos)
        except Exception:
            return jsonify({"erro":"maxPoints inválido"}),400

        centro_custo = centro_custo.strip().upper() if centro_custo else None

        resultado = SimulacaoCenarioRepository().atualizar(
            id_cenario,
            titulo.strip(),
            descricao.strip(),
            icone.strip(),
            dificuldade.strip(),
            max_pontos,
            centro_custo
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar cenário"}),500

        return True

class SimulacaoDeletarCenarioService:
    def executar(self,id_cenario):
        if not id_cenario:
            return jsonify({"erro":"ID do cenário não informado"}),400

        resultado = SimulacaoCenarioRepository().excluir(id_cenario)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao deletar cenário"}),500

        return True

class SimulacaoCriarInteracoesService:
    def executar(self,scenario_id,interactions):
        if not scenario_id or not interactions or not isinstance(interactions,list):
            return jsonify({"erro":"Cenário e interações são obrigatórios"}),400

        for i in interactions:
            if not i.get("ordem") or not i.get("mensagem_cliente"):
                return jsonify({"erro":"Todas as interações devem conter ordem e mensagem"}),400

        try:
            SimulacaoInteracoesRepository().criar_em_lote(
                int(scenario_id),
                interactions
            )
        except Exception:
            return jsonify({"erro":"Erro ao criar interações"}),500

        return True

class SimulacaoListarInteracoesService:
    def executar(self,scenario_id=None):
        try:
            rows = SimulacaoInteracoesRepository().listar(scenario_id)
        except Exception:
            return jsonify({"erro":"Erro ao buscar interações"}),500

        return [
            {
                "id":str(r["ID"]),
                "scenario_id":str(r["ID_CENARIO"]),
                "ordem":r["ORDEM"],
                "mensagem":r["MENSAGEM_CLIENTE"]
            }
            for r in rows
        ]

class SimulacaoAtualizarInteracaoService:
    def executar(self,id_interacao,ordem,mensagem_cliente):
        if not id_interacao:
            return jsonify({"erro":"ID da interação é obrigatório"}),400

        if ordem is None or not mensagem_cliente:
            return jsonify({"erro":"Todos os campos são obrigatórios"}),400

        resultado = SimulacaoInteracoesRepository().atualizar(
            id_interacao,
            ordem,
            mensagem_cliente
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar interação"}),500

        return True

class SimulacaoExcluirInteracaoService:
    def executar(self,id_interacao: int):
        if not id_interacao:
            return jsonify({"erro":"ID da interação é obrigatório"}),400

        resultado = SimulacaoInteracoesRepository().excluir(id_interacao)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao deletar interação"}),500

        return True
    
class SimulacaoCriarRespostasService:
    def executar(self,data: dict):
        id_interacao = data.get("interaction_id")
        respostas = data.get("responses",[])

        if not id_interacao or not respostas or not isinstance(respostas,list):
            return jsonify({"erro":"Interação e respostas são obrigatórias"}),400

        repo = SimulacaoRespostasRepository()

        for resp in respostas:
            texto = resp.get("text")
            pontos = resp.get("points",0)
            feedback = resp.get("feedback","")
            is_positiva = int(resp.get("is_positive",False))
            next_id = resp.get("next_interaction_id")

            if not texto:
                return jsonify({"erro":"Texto da resposta é obrigatório"}),400

            resultado = repo.criar(
                id_interacao,
                texto,
                pontos,
                feedback,
                is_positiva,
                next_id
            )

            if isinstance(resultado,Exception):
                return jsonify({"erro":"Erro ao criar uma das respostas"}),500

        return True
    
class SimulacaoListarRespostasService:
    def executar(self):
        rows = SimulacaoRespostasRepository().listar()

        if not rows:
            return []

        respostas = []

        for row in rows:
            respostas.append({
                "id":row["ID"],
                "idInteracao":row["ID_INTERACAO"],
                "texto":row["TEXTO"],
                "pontos":row["PONTOS"],
                "feedback":row["FEEDBACK"],
                "isPositiva":bool(row["IS_POSITIVA"]),
                "nextInteractionId":row["NEXT_INTERACAO_ID"]
            })

        return respostas

class SimulacaoExcluirRespostaService:
    def executar(self,id_resposta: int):
        if not id_resposta:
            return jsonify({"erro":"ID da resposta é obrigatório"}),400

        resultado = SimulacaoRespostasRepository().excluir(id_resposta)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao deletar resposta"}),500

        return True
    
class SimulacaoBuscarCenarioService:
    def executar(self,id_cenario: int):
        if not id_cenario:
            return jsonify({"erro":"ID do cenário é obrigatório"}),400

        rows = SimulacaoCenarioRepository().buscar_interacoes_respostas(id_cenario)

        if not rows:
            return []

        interacoes = {}

        for row in rows:
            id_interacao = row["ID_INTERACAO"]

            if id_interacao not in interacoes:
                interacoes[id_interacao] = {
                    "id":id_interacao,
                    "ordem":row["ORDEM"],
                    "mensagemCliente":row["MENSAGEM_CLIENTE"],
                    "respostas":[]
                }

            if row["ID_RESPOSTA"]:
                interacoes[id_interacao]["respostas"].append({
                    "id":row["ID_RESPOSTA"],
                    "texto":row["TEXTO"],
                    "pontos":row["PONTOS"],
                    "feedback":row["FEEDBACK"],
                    "isPositiva":bool(row["IS_POSITIVA"]),
                    "nextInteractionId":row["NEXT_INTERACAO_ID"]
                })

        return list(interacoes.values())
    
class SimulacaoListarPremiacoesService:
    def executar(self,categoria: str):
        if not categoria:
            return jsonify({"erro":"Categoria é obrigatória"}),400

        rows = SimulacaoPremiacoesRepository().listar_por_categoria(categoria)

        if not rows:
            return []

        premicoes = []

        for row in rows:
            premicoes.append({
                "id":row["ID"],
                "title":row["TITULO"],
                "description":row["DESCRICAO"],
                "pointsRequired":row["PONTOS_NECESSARIOS"],
                "icon":row["ICONE"],
                "category":row["CATEGORIA"],
                "position":row["POSICAO"],
                "isActive":bool(row["IS_ATIVO"]),
                "currentWinner":None
            })

        return premicoes
    
class SimulacaoRankingPremiacoesService:
    def executar(self,categoria: str,nome_usuario: str):
        periodos = {
            "daily":"dia",
            "weekly":"semana",
            "monthly":"mes"
        }

        if categoria not in periodos:
            return jsonify({"erro":"Categoria inválida"}),400

        rows = SimulacaoRankingRepository().buscar_ranking(periodos[categoria])

        if not rows:
            return {
                "ranking":[],
                "userPoints":0,
                "userPosition":0
            }

        ranking = []
        user_points = 0
        user_position = 0

        for posicao,row in enumerate(rows,1):
            ranking.append({
                "name":row["NOME_USUARIO"],
                "points":row["TOTAL_PONTOS"],
                "position":posicao,
                "progress":0
            })

            if row["NOME_USUARIO"] == nome_usuario:
                user_points = row["TOTAL_PONTOS"]
                user_position = posicao

        return {
            "ranking":ranking,
            "userPoints":user_points,
            "userPosition":user_position
        }
