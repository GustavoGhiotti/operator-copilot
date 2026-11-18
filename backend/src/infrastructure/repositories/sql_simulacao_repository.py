from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class SimulacaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def criar(self,operador_nome: str,centro_custo: str) -> int | None:
        query = """
            INSERT INTO TB_SIMULACAO_TREINAMENTO (OPERADOR_NOME,CENTRO_CUSTO)
            OUTPUT INSERTED.ID_SIMULACAO
            VALUES (?,?)
        """

        result = self.db.execute_insert_returning(query=query,parametros=(operador_nome,centro_custo))
        print(f"Simulação criada com ID: {result}")
        return int(result["ID_SIMULACAO"]) if result else None


class SimulacaoCenariosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def listar(self,usuario: str,centro_custo: str):
        query = """
            SELECT
                c.ID                 AS CENARIO_ID,
                c.TITULO,
                c.DESCRICAO,
                c.ICONE,
                c.DIFICULDADE,
                c.MAX_PONTOS,
                i.ID                 AS INTERACAO_ID,
                i.ORDEM,
                i.MENSAGEM_CLIENTE,
                r.ID                 AS RESPOSTA_ID,
                r.TEXTO              AS TEXTO_RESPOSTA,
                r.PONTOS,
                r.FEEDBACK,
                r.IS_POSITIVA,
                r.NEXT_INTERACAO_ID,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM TB_SIMULACAO_RESPONDIDOS x
                        WHERE x.NOME_USUARIO = ?
                          AND x.ID_CENARIO = c.ID
                          AND DATEPART(ISO_WEEK,x.DATA_RESPOSTA) = DATEPART(ISO_WEEK,GETDATE())
                          AND YEAR(x.DATA_RESPOSTA) = YEAR(GETDATE())
                    ) THEN 1 ELSE 0
                END AS RESPONDIDO
            FROM TB_SIMULACAO_CENARIO c
            LEFT JOIN TB_SIMULACAO_INTERACAO i ON i.ID_CENARIO = c.ID
            LEFT JOIN TB_SIMULACAO_OPCAO_RESPOSTA r ON r.ID_INTERACAO = i.ID
            WHERE UPPER(c.CENTRO_CUSTO) = ?
                OR c.CENTRO_CUSTO = 'GERAL'
            ORDER BY c.ID,i.ORDEM,r.ID
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(usuario, centro_custo),
            one=False
        )

class SimulacaoRespostasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def salvar(self,respostas):
        conn = self.db._connect()

        try:
            conn.autocommit = False
            cursor = conn.cursor()

            total_pontos = 0
            nome = None
            id_cenario = None

            for r in respostas:
                nome = r.get("nomeUsuario")
                id_cenario = r.get("id_cenario")
                id_interacao = r.get("id_interacao")
                id_opcao = r.get("id_opcao_escolhida")
                pontos = int(r.get("pontos") or 0)
                is_positiva = 1 if r.get("is_positiva") else 0

                if not all([nome,id_cenario,id_interacao,id_opcao]):
                    raise ValueError("Dados obrigatórios ausentes em uma resposta")

                total_pontos += pontos

                cursor.execute("""
                    INSERT INTO TB_SIMULACAO_RESPOSTA_USUARIO
                        (NOME_USUARIO,ID_CENARIO,ID_INTERACAO,ID_OPCAO_ESCOLHIDA,
                         PONTOS,IS_POSITIVA,DATA_REGISTRO)
                    VALUES (?,?,?,?,?,?,GETDATE())
                """,(nome,id_cenario,id_interacao,id_opcao,pontos,is_positiva))

            # Marca cenário como respondido na semana
            cursor.execute("""
                INSERT INTO TB_SIMULACAO_RESPONDIDOS
                    (NOME_USUARIO,ID_CENARIO,DATA_RESPOSTA,TOTAL_PONTOS)
                VALUES (?, ?, GETDATE(), ?)
            """,(nome,id_cenario,total_pontos))

            conn.commit()

        except:
            conn.rollback()
            raise

        finally:
            conn.close()

    def criar(self,id_interacao,texto,pontos,feedback,is_positiva,next_id):
        query = """
            INSERT INTO TB_SIMULACAO_OPCAO_RESPOSTA
                (ID_INTERACAO,TEXTO,PONTOS,FEEDBACK,IS_POSITIVA,NEXT_INTERACAO_ID)
            VALUES
                (?,?,?,?,?,?)
        """

        parametros = (id_interacao,texto,pontos,feedback,is_positiva,next_id)

        return self.db.execute_commit(query=query,parametros=parametros)
    
    def listar(self):
        query = """
            SELECT 
                ID,
                ID_INTERACAO,
                TEXTO,
                PONTOS,
                FEEDBACK,
                IS_POSITIVA,
                NEXT_INTERACAO_ID
            FROM TB_SIMULACAO_OPCAO_RESPOSTA
            ORDER BY ID_INTERACAO,ID
        """

        return self.db.execute_fetch(query=query,parametros=(),one=False)
    
    def excluir(self,id_resposta: int):
        query = "DELETE FROM TB_SIMULACAO_OPCAO_RESPOSTA WHERE ID = ?"
        return self.db.execute_commit(query=query,parametros=(id_resposta,))
        

class SimulacaoPontuacaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar(self,usuario: str):
        query = """
            SELECT 
                ISNULL(SUM(PONTOS),0) AS TOTAL_POINTS,
                ISNULL(
                    SUM(
                        CASE 
                            WHEN CONVERT(date,DATA_REGISTRO) = CONVERT(date,GETDATE())
                            THEN PONTOS ELSE 0
                        END
                    ),0
                ) AS DAILY_POINTS
            FROM TB_SIMULACAO_RESPOSTA_USUARIO
            WHERE NOME_USUARIO = ?
        """

        row = self.db.execute_fetch(
            query=query,
            parametros=(usuario,),
            one=True
        )

        if not row:
            return {"totalPoints":0,"dailyPoints":0}

        return {
            "totalPoints": row.get("TOTAL_POINTS",0),
            "dailyPoints": row.get("DAILY_POINTS",0)
        }

class SimulacaoPontuacaoPorCenarioRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar(self,usuario: str):
        query = """
            SELECT
                ID_CENARIO,
                SUM(PONTOS) AS TOTAL_PONTOS
            FROM TB_SIMULACAO_RESPOSTA_USUARIO
            WHERE NOME_USUARIO = ?
            GROUP BY ID_CENARIO
        """

        rows = self.db.execute_fetch(
            query=query,
            parametros=(usuario,),
            one=False
        )

        if not rows:
            return []

        return [
            {
                "idCenario": str(row.get("ID_CENARIO")),
                "totalPontos": row.get("TOTAL_PONTOS",0)
            }
            for row in rows
        ]
class SimulacaoCenarioRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")
    
    def listar(self):
        query = """
            SELECT
                ID,
                TITULO,
                DESCRICAO,
                ICONE,
                DIFICULDADE,
                MAX_PONTOS,
                CENTRO_CUSTO
            FROM TB_SIMULACAO_CENARIO
            ORDER BY ID DESC
        """

        rows = self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        )

        if not rows:
            return []

        return [
            {
                "id": str(row.get("ID")),
                "title": row.get("TITULO"),
                "description": row.get("DESCRICAO"),
                "icon": row.get("ICONE"),
                "difficulty": row.get("DIFICULDADE"),
                "maxPoints": row.get("MAX_PONTOS"),
                "centro_custo": row.get("CENTRO_CUSTO")
            }
            for row in rows
        ]

    def criar(self,titulo,descricao,icone,dificuldade,max_pontos,centro_custo):
        query = """
            INSERT INTO TB_SIMULACAO_CENARIO
                (TITULO,DESCRICAO,ICONE,DIFICULDADE,MAX_PONTOS,CENTRO_CUSTO)
            VALUES
                (?,?,?,?,?,?)
        """

        return self.db.execute_commit(
            query=query,
            parametros=(titulo,descricao,icone,dificuldade,max_pontos,centro_custo)
        )
    
    def atualizar(self,id_cenario,titulo,descricao,icone,dificuldade,max_pontos,centro_custo):
        query = """
            UPDATE TB_SIMULACAO_CENARIO
            SET
                TITULO = ?,
                DESCRICAO = ?,
                ICONE = ?,
                DIFICULDADE = ?,
                MAX_PONTOS = ?,
                CENTRO_CUSTO = ?
            WHERE ID = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(titulo,descricao,icone,dificuldade,max_pontos,centro_custo,id_cenario)
        )
    
    def excluir(self,id_cenario):
        query = "DELETE FROM TB_SIMULACAO_CENARIO WHERE ID = ?"

        return self.db.execute_commit(
            query=query,
            parametros=(id_cenario,)
        )
    
    def buscar_interacoes_respostas(self,id_cenario: int):
        query = """
            SELECT 
                i.ID              AS ID_INTERACAO,
                i.ORDEM           AS ORDEM,
                i.MENSAGEM_CLIENTE,
                r.ID              AS ID_RESPOSTA,
                r.TEXTO,
                r.PONTOS,
                r.FEEDBACK,
                r.IS_POSITIVA,
                r.NEXT_INTERACAO_ID
            FROM TB_SIMULACAO_INTERACAO i
            LEFT JOIN TB_SIMULACAO_OPCAO_RESPOSTA r 
                ON i.ID = r.ID_INTERACAO
            WHERE i.ID_CENARIO = ?
            ORDER BY i.ORDEM,r.ID
        """

        return self.db.execute_fetch(query=query,parametros=(id_cenario,),one=False)
    

class SimulacaoInteracoesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def criar_em_lote(self,scenario_id,interactions):
        conn = self.db._connect()

        try:
            conn.autocommit = False
            cursor = conn.cursor()

            for interaction in interactions:
                cursor.execute("""
                    INSERT INTO TB_SIMULACAO_INTERACAO
                        (ID_CENARIO,ORDEM,MENSAGEM_CLIENTE)
                    VALUES (?,?,?)
                """,(
                    scenario_id,
                    interaction["ordem"],
                    interaction["mensagem_cliente"].strip()
                ))

            conn.commit()

        except:
            conn.rollback()
            raise

        finally:
            conn.close()
    
    def listar(self,scenario_id=None):
        if scenario_id:
            query = """
                SELECT ID,ID_CENARIO,ORDEM,MENSAGEM_CLIENTE
                FROM TB_SIMULACAO_INTERACAO WITH (NOLOCK)
                WHERE ID_CENARIO = ?
                ORDER BY ORDEM
            """
            return self.db.execute_fetch(query=query,parametros=(scenario_id,),one=False)

        query = """
            SELECT ID,ID_CENARIO,ORDEM,MENSAGEM_CLIENTE
            FROM TB_SIMULACAO_INTERACAO WITH (NOLOCK)
            ORDER BY ID_CENARIO,ORDEM
        """
        return self.db.execute_fetch(query=query,parametros=(),one=False)
    
    def atualizar(self,id_interacao,ordem,mensagem_cliente):
        query = """
            UPDATE TB_SIMULACAO_INTERACAO
            SET ORDEM = ?, MENSAGEM_CLIENTE = ?
            WHERE ID = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(ordem,mensagem_cliente,id_interacao)
        )

    def excluir(self,id_interacao: int):
        query = "DELETE FROM TB_SIMULACAO_INTERACAO WHERE ID = ?"
        return self.db.execute_commit(query=query,parametros=(id_interacao,))
    

class SimulacaoPremiacoesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_por_categoria(self,categoria: str):
        query = """
            SELECT
                ID,
                TITULO,
                DESCRICAO,
                PONTOS_NECESSARIOS,
                ICONE,
                CATEGORIA,
                POSICAO,
                IS_ATIVO
            FROM TB_SIMULACAO_PREMIACAO
            WHERE CATEGORIA = ? AND IS_ATIVO = 1
            ORDER BY POSICAO ASC
        """

        return self.db.execute_fetch(query=query,parametros=(categoria,),one=False)
    
class SimulacaoRankingRepository:

    filtros = {
        "dia": "CONVERT(date,DATA_REGISTRO) = CONVERT(date,GETDATE())",
        "semana": """
            DATEPART(ISO_WEEK,DATA_REGISTRO) = DATEPART(ISO_WEEK,GETDATE())
            AND YEAR(DATA_REGISTRO) = YEAR(GETDATE())
        """,
        "mes": """
            MONTH(DATA_REGISTRO) = MONTH(GETDATE())
            AND YEAR(DATA_REGISTRO) = YEAR(GETDATE())
        """
    }

    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar(self,periodo: str,usuario: str | None):
        condicao = self.filtros[periodo]

        filtro_usuario = ""
        parametros = []

        if usuario:
            filtro_usuario = "AND NOME_USUARIO = ?"
            parametros.append(usuario)

        query = f"""
            SELECT
                NOME_USUARIO,
                SUM(PONTOS) AS TOTAL_PONTOS
            FROM TB_SIMULACAO_RESPOSTA_USUARIO WITH(NOLOCK)
            WHERE {condicao}
            {filtro_usuario}
            GROUP BY NOME_USUARIO
            ORDER BY TOTAL_PONTOS DESC
        """

        return self.db.execute_fetch(
            query=query,
            parametros=tuple(parametros),
            one=False
        )

    filtros = {
        "dia":"CONVERT(DATE,DATA_REGISTRO) = CONVERT(DATE,GETDATE())",
        "semana":"DATEPART(WEEK,DATA_REGISTRO) = DATEPART(WEEK,GETDATE()) AND YEAR(DATA_REGISTRO) = YEAR(GETDATE())",
        "mes":"MONTH(DATA_REGISTRO) = MONTH(GETDATE()) AND YEAR(DATA_REGISTRO) = YEAR(GETDATE())"
    }

    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_ranking(self,periodo: str):
        if periodo not in self.filtros:
            raise ValueError("Período inválido")

        query = f"""
            SELECT 
                NOME_USUARIO,
                SUM(PONTOS) AS TOTAL_PONTOS
            FROM TB_SIMULACAO_RESPOSTA_USUARIO WITH (NOLOCK)
            WHERE {self.filtros[periodo]}
            GROUP BY NOME_USUARIO
            ORDER BY TOTAL_PONTOS DESC
        """

        return self.db.execute_fetch(query=query,parametros=(),one=False)
