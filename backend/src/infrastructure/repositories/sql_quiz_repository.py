from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class QuizRankingRepository:

    filtros = {
        "dia": """
            CONVERT(DATE, DT_RESPOSTA) = CONVERT(DATE, GETDATE())
        """,
        "semana": """
            DATEPART(WEEK, DT_RESPOSTA) = DATEPART(WEEK, GETDATE())
            AND YEAR(DT_RESPOSTA) = YEAR(GETDATE())
        """,
        "mes": """
            MONTH(DT_RESPOSTA) = MONTH(GETDATE())
            AND YEAR(DT_RESPOSTA) = YEAR(GETDATE())
        """
    }

    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_pontos(self,periodo: str):
        if periodo not in self.filtros:
            raise ValueError("Período inválido")

        query = f"""
            SELECT 
                NOME_USUARIO,
                SUM(PONTOS_OBTIDOS) AS TOTAL_PONTOS
            FROM TB_QUIZ_RESPOSTA_USUARIO WITH (NOLOCK)
            WHERE {self.filtros[periodo]}
            GROUP BY NOME_USUARIO
            ORDER BY TOTAL_PONTOS DESC
        """

        return self.db.execute_fetch(query=query,parametros=(),one=False)

class QuizListarTemasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar(self,centro_custo: str):
        if centro_custo:
            query = """
                SELECT ID,TEMA,TITULO,DESCRICAO,CENTRO_CUSTO
                FROM TB_QUIZ_TEMA WITH(NOLOCK)
                WHERE CENTRO_CUSTO = ? OR CENTRO_CUSTO IS NULL
            """
            parametros = (centro_custo,)
        else:
            query = """
                SELECT ID,TEMA,TITULO,DESCRICAO,CENTRO_CUSTO
                FROM TB_QUIZ_TEMA WITH(NOLOCK)
            """
            parametros = ()

        return self.db.execute_fetch(query=query,parametros=parametros,one=False)


class QuizListarPerguntasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def buscar_id_tema(self,tema_codigo: str):
        query = """
            SELECT ID
            FROM TB_QUIZ_TEMA WITH(NOLOCK)
            WHERE TEMA = ?
        """

        resultado = self.db.execute_fetch(query=query,parametros=(tema_codigo,),one=True)

        return resultado.get("ID") if resultado else None


    def usuario_ja_respondeu(self,usuario: str,id_tema: int):
        query = """
            SELECT 1
            FROM TB_QUIZ_RESPOSTA_USUARIO WITH(NOLOCK)
            WHERE NOME_USUARIO = ? AND ID_TEMA = ? AND DT_RESPOSTA = CAST(GETDATE() AS DATE)
        """

        resultado = self.db.execute_fetch(query=query,parametros=(usuario,id_tema),one=True)

        return bool(resultado)

    def buscar_perguntas(self,id_tema,centro_custo):
        query = """
            SELECT ID, PERGUNTA
            FROM TB_QUIZ_PERGUNTA WITH (NOLOCK)
            WHERE ID_TEMA = ? AND CENTRO_CUSTO = ? AND DT_DISPONIVEL = CAST(GETDATE() AS DATE)
        """

        return self.db.execute_fetch(query=query,parametros=(id_tema,centro_custo),one=False)


    def buscar_respostas(self,id_pergunta: int):
        query = """
            SELECT ID,TEXTO,PONTOS,EXPLICACAO
            FROM TB_QUIZ_RESPOSTA WITH(NOLOCK)
            WHERE ID_PERGUNTA = ?
        """

        return self.db.execute_fetch(query=query,parametros=(id_pergunta,),one=False)


class QuizPerguntasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def listar_todas(self):
        query = """
            SELECT ID,ID_TEMA,PERGUNTA,DT_DISPONIVEL
            FROM TB_QUIZ_PERGUNTA WITH(NOLOCK)
        """

        return self.db.execute_fetch(query=query,parametros=(),one=False)

    def criar(self,id_tema: str,pergunta: str,dt_disponivel: str,centro_custo: str):
        query = """
            INSERT INTO TB_QUIZ_PERGUNTA (ID_TEMA,PERGUNTA,DT_DISPONIVEL,CENTRO_CUSTO)
            VALUES (?,?,?,?)
        """

        self.db.execute_commit(query=query,parametros=(id_tema,pergunta,dt_disponivel,centro_custo))

    def atualizar(self,id: str,id_tema: str,pergunta: str,dt_disponivel: str):
        query = """
            UPDATE TB_QUIZ_PERGUNTA
            SET ID_TEMA = ?,PERGUNTA = ?,DT_DISPONIVEL = ?
            WHERE ID = ?
        """

        self.db.execute_commit(query=query,parametros=(id_tema,pergunta,dt_disponivel,id))

    def deletar(self,id: str):
        query = "DELETE FROM TB_QUIZ_PERGUNTA WHERE ID = ?"

        self.db.execute_commit(query=query,parametros=(id,))

class QuizTemasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def listar(self,centro_custo: str):
        if centro_custo:
            query = """
                SELECT ID,TEMA,TITULO,DESCRICAO,CENTRO_CUSTO
                FROM TB_QUIZ_TEMA WITH(NOLOCK)
                WHERE CENTRO_CUSTO = ? OR CENTRO_CUSTO IS NULL
            """
            parametros = (centro_custo,)
        else:
            query = """
                SELECT ID,TEMA,TITULO,DESCRICAO,CENTRO_CUSTO
                FROM TB_QUIZ_TEMA WITH(NOLOCK)
            """
            parametros = ()

        return self.db.execute_fetch(query=query,parametros=parametros,one=False)

    def criar(self,codigo: str,titulo: str,descricao: str,centro_custo: str):
        query = """
            INSERT INTO TB_QUIZ_TEMA (TEMA,TITULO,DESCRICAO,CENTRO_CUSTO)
            VALUES (?,?,?,?)
        """

        self.db.execute_commit(query=query,parametros=(codigo,titulo,descricao,centro_custo))

    def atualizar(self,id: str,codigo: str,titulo: str,descricao: str):
        query = """
            UPDATE TB_QUIZ_TEMA
            SET TEMA = ?,TITULO = ?,DESCRICAO = ?
            WHERE ID = ?
        """

        self.db.execute_commit(query=query,parametros=(codigo,titulo,descricao,id))

    def deletar(self,id: str):
        query = "DELETE FROM TB_QUIZ_TEMA WHERE ID = ?"

        self.db.execute_commit(query=query,parametros=(id,))

class QuizResponderRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def registrar_resposta(self,usuario,id_tema,id_resposta,pontos):
        query = """
            INSERT INTO TB_QUIZ_RESPOSTA_USUARIO
                (NOME_USUARIO,ID_TEMA,ID_RESPOSTA,PONTOS_OBTIDOS,DT_RESPOSTA)
            VALUES
                (?,?,?,?,CAST(GETDATE() AS DATE))
        """

        return self.db.execute_commit(query=query,parametros=(usuario,id_tema,id_resposta,pontos))

class QuizFinalizarRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_id_tema(self,tema_codigo: str):
        query = """
            SELECT ID
            FROM TB_QUIZ_TEMA WITH(NOLOCK)
            WHERE TEMA = ?
        """

        resultado = self.db.execute_fetch(query=query,parametros=(tema_codigo,),one=True)

        return resultado.get("ID") if resultado else None

    def registrar_finalizacao(self,usuario,id_tema,pontos):
        query = """
            INSERT INTO TB_QUIZ_RESPOSTA_USUARIO
                (NOME_USUARIO,ID_TEMA,DT_RESPOSTA,PONTOS_OBTIDOS)
            VALUES
                (?,?,CAST(GETDATE() AS DATE),?)
        """

        return self.db.execute_commit(query=query,parametros=(usuario,id_tema,pontos))

class QuizPontuacaoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_total_por_tema(self,usuario: str):
        query = """
            SELECT ID_TEMA,SUM(PONTOS_OBTIDOS) AS TOTAL
            FROM TB_QUIZ_RESPOSTA_USUARIO WITH(NOLOCK)
                WHERE NOME_USUARIO = ?
                GROUP BY ID_TEMA
            """

        rows = self.db.execute_fetch(
                query=query,
                parametros=(usuario,),
                one=False)

        if not rows:
            return {}

        return {str(row.get("ID_TEMA")): int(row.get("TOTAL",0)) for row in rows}

    def buscar_pontos_hoje(self,usuario: str):
        query = """
            SELECT SUM(PONTOS_OBTIDOS) AS TOTAL
            FROM TB_QUIZ_RESPOSTA_USUARIO WITH(NOLOCK)
            WHERE NOME_USUARIO = ?
              AND DT_RESPOSTA = CAST(GETDATE() AS DATE)
        """

        row = self.db.execute_fetch(query=query,parametros=(usuario,),one=True)
        if row == None or row.get("TOTAL") is None:
            return 0
        return int(row.get("TOTAL",0))

class QuizRespostasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_todas(self):
        query = """
            SELECT ID_PERGUNTA,TEXTO,EXPLICACAO,PONTOS
            FROM TB_QUIZ_RESPOSTA WITH(NOLOCK)
        """

        return self.db.execute_fetch(query=query,parametros=(),one=False)

class QuizRespostasRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def criar(self,id_pergunta,texto,explicacao,pontos):
        query = """
            INSERT INTO TB_QUIZ_RESPOSTA
                (ID_PERGUNTA,TEXTO,EXPLICACAO,PONTOS)
            VALUES
                (?,?,?,?)
        """

        return self.db.execute_commit(query=query,parametros=(id_pergunta,texto,explicacao,pontos))

class QuizConcluidosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_concluidos_hoje(self,usuario: str):
        query = """
            SELECT DISTINCT ID_TEMA
            FROM TB_QUIZ_RESPOSTA_USUARIO WITH(NOLOCK)
            WHERE NOME_USUARIO = ?
              AND DT_RESPOSTA = CAST(GETDATE() AS DATE)
        """

        rows = self.db.execute_fetch(query=query,parametros=(usuario,),one=False)

        if not rows:
            return []

        return [str(row.get("ID_TEMA")) for row in rows]

class QuizOperadoresRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar(self,nome: str):
        if nome:
            query = """
                SELECT DISTINCT NOME_USUARIO
                FROM TB_QUIZ_RESPOSTA_USUARIO WITH(NOLOCK)
                WHERE NOME_USUARIO LIKE ?
                ORDER BY NOME_USUARIO
            """
            parametros = (f"%{nome}%",)
        else:
            query = """
                SELECT DISTINCT NOME_USUARIO
                FROM TB_QUIZ_RESPOSTA_USUARIO WITH(NOLOCK)
                ORDER BY NOME_USUARIO
            """
            parametros = ()

        rows = self.db.execute_fetch(query=query,parametros=parametros,one=False)

        if not rows:
            return []

        return [row.get("NOME_USUARIO") for row in rows]

class QuizAnaliseOperadorRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_resumo_hoje(self,operador: str):
        query = """
            SELECT 
                COUNT(*) AS TOTALRESPOSTAS,
                SUM(CASE WHEN R.PONTOS = 100 THEN 1 ELSE 0 END) AS RESPOSTASCORRETAS,
                SUM(CASE WHEN R.PONTOS = 50 THEN 1 ELSE 0 END) AS RESPOSTASPARCIAIS,
                SUM(CASE WHEN R.PONTOS = 0 THEN 1 ELSE 0 END) AS RESPOSTASINCORRETAS,
                CAST(
                    100.0 * SUM(CASE WHEN R.PONTOS = 100 THEN 1 ELSE 0 END) 
                    / NULLIF(COUNT(*),0) 
                    AS DECIMAL(5,2)
                ) AS PORCENTAGEMACERTO,
                SUM(R.PONTOS) AS PONTOSTOTAL
            FROM TB_QUIZ_RESPOSTA_USUARIO Q WITH(NOLOCK)
            JOIN TB_QUIZ_RESPOSTA R ON R.ID = Q.ID_RESPOSTA
            WHERE Q.NOME_USUARIO = ?
              AND Q.DT_RESPOSTA = CAST(GETDATE() AS DATE)
        """

        return self.db.execute_fetch(query=query,parametros=(operador,),one=True)

class QuizPremiosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_disponiveis(self):
        query = """
            SELECT 
                ID,
                NOME,
                DESCRICAO,
                PONTOS_NECESSARIOS,
                CATEGORIA,
                ICONE,
                DISPONIVEL,
                QUANTIDADE_DISPONIVEL
            FROM TB_QUIZ_PREMIOS WITH(NOLOCK)
            WHERE DISPONIVEL = 1
        """

        rows = self.db.execute_fetch(query=query,parametros=(),one=False)

        if not rows:
            return []

        return [
            {
                "id": row.get("ID"),
                "nome": row.get("NOME"),
                "descricao": row.get("DESCRICAO"),
                "pontos_necessarios": row.get("PONTOS_NECESSARIOS"),
                "categoria": row.get("CATEGORIA"),
                "icone": row.get("ICONE"),
                "disponivel": bool(row.get("DISPONIVEL")),
                "quantidade_disponivel": row.get("QUANTIDADE_DISPONIVEL")
            }
            for row in rows
        ]

class QuizPremiosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def criar(self,nome,descricao,pontos,categoria,icone,disponivel,quantidade):
        query = """
            INSERT INTO TB_QUIZ_PREMIOS
                (NOME,DESCRICAO,PONTOS_NECESSARIOS,CATEGORIA,ICONE,DISPONIVEL,QUANTIDADE_DISPONIVEL)
            VALUES
                (?,?,?,?,?,?,?)
        """

        return self.db.execute_commit(
            query=query,
            parametros=(nome,descricao,pontos,categoria,icone,disponivel,quantidade)
        )

class QuizPremiosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def atualizar(self,id_premio,nome,descricao,pontos,categoria,icone,disponivel,quantidade):
        query = """
            UPDATE TB_QUIZ_PREMIOS
            SET
                NOME = ?,
                DESCRICAO = ?,
                PONTOS_NECESSARIOS = ?,
                CATEGORIA = ?,
                ICONE = ?,
                DISPONIVEL = ?,
                QUANTIDADE_DISPONIVEL = ?
            WHERE ID = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(nome,descricao,pontos,categoria,icone,disponivel,quantidade,id_premio)
        )

class QuizPremiosRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def excluir(self,id_premio):
        query = "DELETE FROM TB_QUIZ_PREMIOS WHERE ID = ?"

        return self.db.execute_commit(
            query=query,
            parametros=(id_premio,)
        )

class QuizResgatesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_por_usuario(self,usuario: str):
        query = """
            SELECT
                R.ID               AS RESGATE_ID,
                R.PREMIO_ID        AS PREMIO_ID,
                R.USUARIO          AS USUARIO,
                R.DATA_RESGATE     AS DATA_RESGATE,
                R.STATUS           AS STATUS,
                P.NOME             AS PREMIO_NOME,
                P.DESCRICAO        AS PREMIO_DESCRICAO,
                P.PONTOS_NECESSARIOS AS PONTOS_NECESSARIOS,
                P.CATEGORIA        AS CATEGORIA,
                P.ICONE            AS ICONE
            FROM TB_QUIZ_RESGATES R
            JOIN TB_QUIZ_PREMIOS P ON P.ID = R.PREMIO_ID
            WHERE R.USUARIO = ?
            ORDER BY R.DATA_RESGATE DESC
        """

        rows = self.db.execute_fetch(query=query,parametros=(usuario,),one=False)

        if not rows:
            return []

        return [
            {
                "id": row.get("RESGATE_ID"),
                "premio_id": row.get("PREMIO_ID"),
                "usuario": row.get("USUARIO"),
                "data_resgate": row.get("DATA_RESGATE"),
                "status": row.get("STATUS"),
                "premio": {
                    "nome": row.get("PREMIO_NOME"),
                    "descricao": row.get("PREMIO_DESCRICAO"),
                    "pontos_necessarios": row.get("PONTOS_NECESSARIOS"),
                    "categoria": row.get("CATEGORIA"),
                    "icone": row.get("ICONE")
                }
            }
            for row in rows
        ]

class QuizResgatesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def resgatar(self,usuario,premio_id,pontos_gastos):
        conn = self.db._connect()

        try:
            cursor = conn.cursor()
            conn.autocommit = False

            # 1️⃣ Pontos do usuário
            cursor.execute("""
                SELECT SUM(PONTOS_OBTIDOS)
                FROM TB_QUIZ_RESPOSTA_USUARIO WITH (NOLOCK)
                WHERE NOME_USUARIO = ?
            """,(usuario,))
            pontos_atuais = cursor.fetchone()[0] or 0

            if pontos_atuais < pontos_gastos:
                raise ValueError("Pontos insuficientes")

            # 2️⃣ Estoque do prêmio
            cursor.execute("""
                SELECT QUANTIDADE_DISPONIVEL
                FROM TB_QUIZ_PREMIOS
                WHERE ID = ?
            """,(premio_id,))
            row = cursor.fetchone()

            if not row:
                raise ValueError("Prêmio não encontrado")

            qtd = row[0]
            if qtd is not None and qtd <= 0:
                raise ValueError("Prêmio indisponível")

            # 3️⃣ Registrar resgate
            cursor.execute("""
                INSERT INTO TB_QUIZ_RESGATES (USUARIO,PREMIO_ID,PONTOS_GASTOS)
                VALUES (?,?,?)
            """,(usuario,premio_id,pontos_gastos))

            # 4️⃣ Debitar pontos
            cursor.execute("""
                INSERT INTO TB_QUIZ_RESPOSTA_USUARIO
                    (NOME_USUARIO,ID_TEMA,ID_RESPOSTA,PONTOS_OBTIDOS,DT_RESPOSTA)
                VALUES
                    (?,NULL,NULL,-?,CAST(GETDATE() AS DATE))
            """,(usuario,pontos_gastos))

            # 5️⃣ Atualizar estoque
            if qtd is not None:
                cursor.execute("""
                    UPDATE TB_QUIZ_PREMIOS
                    SET QUANTIDADE_DISPONIVEL = QUANTIDADE_DISPONIVEL - 1
                    WHERE ID = ?
                """,(premio_id,))

            conn.commit()

        except:
            conn.rollback()
            raise

        finally:
            conn.close()
