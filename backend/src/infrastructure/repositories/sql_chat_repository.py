from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66

class ChatUsersRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_todos(self):
        query = """
            SELECT 
                ID_USUARIO,
                NOME,
                ROLE,
                CARTEIRA,
                STATUS,
                LAST_SEEN
            FROM TB_CHAT_USUARIOS
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False
        )
    
    def ensure_usuario(self,*,nome: str,role: str,carteira: str):
        query_select = "SELECT ID_USUARIO FROM TB_CHAT_USUARIOS WHERE NOME = ?"

        result = self.db.execute_fetch(
            query=query_select,
            parametros=(nome,),
            one=True
        )

        if result:
            query_update = """
                UPDATE TB_CHAT_USUARIOS
                SET ROLE = ?,
                    CARTEIRA = ?,
                    STATUS = ?,
                    LAST_SEEN = GETDATE()
                WHERE ID_USUARIO = CAST(? AS uniqueidentifier)
            """

            self.db.execute_commit(
                query=query_update,
                parametros=(role,carteira,"online",result["ID_USUARIO"])
            )

            return result["ID_USUARIO"]

        query_insert = """
            INSERT INTO TB_CHAT_USUARIOS
                (ID_USUARIO,NOME,ROLE,CARTEIRA,STATUS,LAST_SEEN)
            OUTPUT INSERTED.ID_USUARIO
            VALUES
                (NEWID(),?,?,?,?,GETDATE())
        """

        insert = self.db.execute_fetch(
            query=query_insert,
            parametros=(nome,role,carteira,"online"),
            one=True
        )

        return insert["ID_USUARIO"] if insert else None
    
class ChatRoomsRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def buscar_id_usuario(self,usuario_nome: str):
        query = "SELECT ID_USUARIO FROM TB_CHAT_USUARIOS WHERE NOME = ?"

        result = self.db.execute_fetch(
            query=query,
            parametros=(usuario_nome,),
            one=True
        )

        return result["ID_USUARIO"] if result else None

    def listar_salas(self,carteira: str | None):
        query = """
            SELECT ID_SALA,NOME,TIPO,CARTEIRA,PINNED_MESSAGE_ID,CRIADO_POR,DESCRICAO
            FROM TB_CHAT_SALAS
            WHERE IS_ACTIVE = 1
        """

        params = ()

        if carteira:
            query += " AND (CARTEIRA = ? OR TIPO IN ('geral','privado'))"
            params = (carteira,)

        return self.db.execute_fetch(
            query=query,
            parametros=params,
            one=False
        )

    def sala_existe(self,sala_id: str):
        query = "SELECT 1 FROM TB_CHAT_SALAS WHERE ID_SALA = CAST(? AS uniqueidentifier)"

        return bool(
            self.db.execute_fetch(
                query=query,
                parametros=(sala_id,),
                one=True
            )
        )

    def usuario_existe(self,usuario_id: str):
        query = "SELECT 1 FROM TB_CHAT_USUARIOS WHERE ID_USUARIO = CAST(? AS uniqueidentifier)"

        return bool(
            self.db.execute_fetch(
                query=query,
                parametros=(usuario_id,),
                one=True
            )
        )

    def usuario_ja_membro(self,*,sala_id: str,usuario_id: str):
        query = """
            SELECT 1
            FROM TB_CHAT_MEMBROS
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
              AND ID_USUARIO = CAST(? AS uniqueidentifier)
        """

        return bool(
            self.db.execute_fetch(
                query=query,
                parametros=(sala_id,usuario_id),
                one=True
            )
        )

    def adicionar_membro(self,*,sala_id: str,usuario_id: str):
        query = """
            INSERT INTO TB_CHAT_MEMBROS (ID_SALA,ID_USUARIO)
            VALUES (CAST(? AS uniqueidentifier),CAST(? AS uniqueidentifier))
        """

        return self.db.execute_commit(
            query=query,
            parametros=(sala_id,usuario_id)
        )

    def usuario_tem_acesso_sala(self,*,sala_id,usuario_id,criado_por):
        if criado_por == usuario_id:
            return True

        query = """
            SELECT 1
            FROM TB_CHAT_MEMBROS
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
              AND ID_USUARIO = CAST(? AS uniqueidentifier)
        """

        return bool(
            self.db.execute_fetch(
                query=query,
                parametros=(sala_id,usuario_id),
                one=True
            )
        )

    def listar_membros_sala(self, *, tipo: str, sala_id, carteira: str | None):
        if tipo == "carteira":
            query = """
                SELECT CPF_COLABORADOR, NM_COLABORADOR, FUNCAO_COLABORADOR, CENTRO_CUSTO
                FROM login.TB_USUARIOS
                WHERE CENTRO_CUSTO = ?
            """
            rows = self.db.execute_fetch(query=query, parametros=(carteira,), one=False) or []
            return self._map_membros_login(rows)

        if tipo == "geral":
            query = """
                SELECT CPF_COLABORADOR, NM_COLABORADOR, FUNCAO_COLABORADOR, CENTRO_CUSTO
                FROM login.TB_USUARIOS
            """
            rows = self.db.execute_fetch(query=query, parametros=(), one=False) or []
            return self._map_membros_login(rows)

        if tipo == "privado":
            query = """
                SELECT u.ID_USUARIO, u.NOME, u.ROLE, u.CARTEIRA
                FROM TB_CHAT_MEMBROS m
                JOIN TB_CHAT_USUARIOS u ON u.ID_USUARIO = m.ID_USUARIO
                WHERE m.ID_SALA = CAST(? AS uniqueidentifier)
            """
            rows = self.db.execute_fetch(query=query, parametros=(sala_id,), one=False) or []

            return [{
                "id": str(r["ID_USUARIO"]),
                "nome": r["NOME"],
                "role": r["ROLE"],
                "carteira": r["CARTEIRA"],
                "status": "offline"
            } for r in rows]

        return []
    
    def _map_membros_login(self,rows):
        membros = []

        for r in rows or []:
            funcao = (r["FUNCAO_COLABORADOR"] or "").lower()

            role = (
                "admin" if funcao == "admin"
                else "supervisor" if "super" in funcao
                else "operador"
            )

            membros.append({
                "id": str(r["CPF_COLABORADOR"]),
                "nome": r["NM_COLABORADOR"],
                "role": role,
                "carteira": r["CENTRO_CUSTO"],
                "status": "offline"
            })

        return membros

    def buscar_id_usuario(self,usuario_nome: str):
        query = "SELECT ID_USUARIO FROM TB_CHAT_USUARIOS WHERE NOME = ?"

        result = self.db.execute_fetch(
            query=query,
            parametros=(usuario_nome,),
            one=True
        )

        return result["ID_USUARIO"] if result else None

    def criar_sala(
        self,
        *,
        nome: str,
        tipo: str,
        carteira: str | None,
        criado_por_id
    ):
        query = """
            INSERT INTO TB_CHAT_SALAS
                (NOME,TIPO,CARTEIRA,CRIADO_POR,CREATED_AT,IS_ACTIVE)
            OUTPUT INSERTED.ID_SALA
            VALUES
                (?,?,?,?,GETDATE(),1)
        """

        parametros = (nome,tipo,carteira,criado_por_id)

        result = self.db.execute_fetch(
            query=query,
            parametros=parametros,
            one=True
        )

        return result["ID_SALA"] if result else None

    def adicionar_membro(self,*,sala_id,usuario_id):
        query = """
            INSERT INTO TB_CHAT_MEMBROS (ID_SALA,ID_USUARIO)
            VALUES (CAST(? AS uniqueidentifier),CAST(? AS uniqueidentifier))
        """

        return self.db.execute_commit(
            query=query,
            parametros=(sala_id,usuario_id)
        )

    def remover_membro(self,*,sala_id: str,usuario_id: str):
        query = """
            DELETE FROM TB_CHAT_MEMBROS
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
              AND ID_USUARIO = CAST(? AS uniqueidentifier)
        """

        return self.db.execute_commit(
            query=query,
            parametros=(sala_id,usuario_id)
        )
    def remover_sala(self,*,sala_id: str):
        query = """
UPDATE [dbo].[TB_CHAT_SALAS] 
SET  IS_ACTIVE = 0
WHERE ID_SALA = ?
        """

        return self.db.execute_commit(
            query=query,
            parametros=(sala_id,)
        )
    

    def editar_sala(self,*,sala_id: str, nome:str, descricao:str):
        query = """
UPDATE [dbo].[TB_CHAT_SALAS] 
SET  NOME = ?,
DESCRICAO = ?
WHERE ID_SALA = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(nome,descricao,sala_id,)
        )

    def sala_existe(self, sala_id: str) -> bool:
        query = """
            SELECT 1
            FROM TB_CHAT_SALAS
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
              AND IS_ACTIVE = 1
        """
        return bool(self.db.execute_fetch(query=query, parametros=(sala_id,), one=True))

    def fixar_mensagem(self, sala_id: str, message_id: str):
        query = """
            UPDATE TB_CHAT_SALAS
            SET PINNED_MESSAGE_ID = CAST(? AS uniqueidentifier)
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
        """
        self.db.execute_commit(
            query=query,
            parametros=(message_id, sala_id)
        )

    def desfixar_mensagem(self, sala_id: str):
        query = """
            UPDATE TB_CHAT_SALAS
            SET PINNED_MESSAGE_ID = NULL
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
        """
        self.db.execute_commit(
            query=query,
            parametros=(sala_id,)
        )

    def buscar_quizzes_com_alternativas(self, sala_id: str):
        query = """
            SELECT
                CONVERT(varchar(36), q.ID_QUIZ)      AS quiz_id,
                q.PERGUNTA                          AS pergunta,
                q.TEMPO_LIMITE                      AS tempo_limite,
                q.CORRETA                           AS correta,
                q.CREATED_AT                        AS created_at,
                q.ENCERRADO                         AS encerrado,
                a.TEXTO                             AS alternativa
            FROM TB_CHAT_QUIZ q
            LEFT JOIN TB_CHAT_QUIZ_ALTERNATIVAS a
                ON a.ID_QUIZ = q.ID_QUIZ
            WHERE q.ID_SALA = CAST(? AS uniqueidentifier)
            ORDER BY q.CREATED_AT DESC
        """

        result = self.db.execute_fetch(query=query, parametros=(sala_id,)) or []
        
        quizzes = {}

        for r in result:
            quiz_id = r["quiz_id"] if isinstance(r, dict) else r[0]

            if quiz_id not in quizzes:
                quizzes[quiz_id] = {
                    "quiz_id": quiz_id,
                    "pergunta": r["pergunta"] if isinstance(r, dict) else r[1],
                    "tempo_limite": r["tempo_limite"] if isinstance(r, dict) else r[2],
                    "correta": r["correta"] if isinstance(r, dict) else r[3],
                    "created_at": (
                        r["created_at"].strftime("%Y-%m-%d %H:%M:%S")
                        if isinstance(r, dict)
                        else r[4].strftime("%Y-%m-%d %H:%M:%S")
                    ),
                    "encerrado": bool(r["encerrado"] if isinstance(r, dict) else r[5]),
                    "alternativas": []
                }

            alternativa = r["alternativa"] if isinstance(r, dict) else r[6]
            if alternativa:
                quizzes[quiz_id]["alternativas"].append(alternativa)

        return list(quizzes.values())



class ChatMessagesRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66,"DB_COPILOT_ACME")

    def listar_por_sala(self,sala_id: str):
        query = """
            SELECT
                CONVERT(varchar(36), m.ID_MENSAGEM) AS ID_MENSAGEM,
                m.CONTEUDO,
                m.TIPO,
                m.IMAGEM_URL,
                m.TIMESTAMP,
                CONVERT(varchar(36), m.REPLY_TO_ID) AS REPLY_TO_ID,
                reply.CONTEUDO AS REPLY_CONTEUDO,
                reply.TIPO AS REPLY_TIPO,
                reply_user.NOME AS REPLY_USUARIO_NOME,
                CONVERT(varchar(36), u.ID_USUARIO) AS ID_USUARIO,
                u.NOME,
                u.ROLE,
                CASE
                    WHEN s.PINNED_MESSAGE_ID = m.ID_MENSAGEM THEN 1
                    ELSE 0
                END AS FIXADA
            FROM TB_CHAT_MENSAGENS m
            JOIN TB_CHAT_USUARIOS u ON m.ID_USUARIO = u.ID_USUARIO
            JOIN TB_CHAT_SALAS s ON s.ID_SALA = m.ID_SALA
            LEFT JOIN TB_CHAT_MENSAGENS reply
                ON reply.ID_MENSAGEM = m.REPLY_TO_ID
            LEFT JOIN TB_CHAT_USUARIOS reply_user
                ON reply_user.ID_USUARIO = reply.ID_USUARIO
            WHERE m.ID_SALA = CAST(? AS uniqueidentifier)
            ORDER BY m.TIMESTAMP ASC
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(sala_id,),
            one=False
        )

    def sala_existe(self, sala_id: str) -> bool:
        query = """
            SELECT 1
            FROM TB_CHAT_SALAS
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
              AND IS_ACTIVE = 1
        """
        return bool(
            self.db.execute_fetch(
                query=query,
                parametros=(sala_id,),
                one=True
            )
        )

    def fixar_mensagem(self, sala_id: str, message_id: str):
        query = """
            UPDATE TB_CHAT_SALAS
            SET PINNED_MESSAGE_ID = CAST(? AS uniqueidentifier)
            WHERE ID_SALA = CAST(? AS uniqueidentifier)
        """
        self.db.execute_commit(
            query=query,
            parametros=(message_id, sala_id)
        )

    def criar_mensagem(
        self,
        *,
        message_id: str,
        sala_id: str,
        usuario_id: str,
        conteudo: str,
        tipo: str,
        imagem_url: str | None = None,
        reply_to_id: str | None = None
    ):
        query = """
            INSERT INTO TB_CHAT_MENSAGENS
                (
                    ID_MENSAGEM,
                    ID_SALA,
                    ID_USUARIO,
                    CONTEUDO,
                    TIPO,
                    IMAGEM_URL,
                    REPLY_TO_ID,
                    TIMESTAMP
                )
            VALUES
                (CAST(? AS uniqueidentifier),
                 CAST(? AS uniqueidentifier),
                 CAST(? AS uniqueidentifier),
                 ?,?,?,CAST(? AS uniqueidentifier),
                 GETDATE())
        """

        parametros = (
            message_id,
            sala_id,
            usuario_id,
            conteudo,
            tipo,
            imagem_url,
            reply_to_id
        )

        return self.db.execute_commit(query=query,parametros=parametros)

    def listar_reacoes_por_sala(self, sala_id: str):
        query = """
            SELECT
                CONVERT(varchar(36), r.ID_MENSAGEM) AS ID_MENSAGEM,
                r.EMOJI,
                u.NOME
            FROM TB_CHAT_REACOES r
            JOIN TB_CHAT_MENSAGENS m
                ON m.ID_MENSAGEM = r.ID_MENSAGEM
            JOIN TB_CHAT_USUARIOS u
                ON u.ID_USUARIO = r.ID_USUARIO
            WHERE m.ID_SALA = CAST(? AS uniqueidentifier)
            ORDER BY r.CREATED_AT ASC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(sala_id,),
            one=False
        ) or []

    def buscar_reacoes_mensagem(self, message_id: str):
        query = """
            SELECT r.EMOJI, u.NOME
            FROM TB_CHAT_REACOES r
            JOIN TB_CHAT_USUARIOS u
                ON u.ID_USUARIO = r.ID_USUARIO
            WHERE r.ID_MENSAGEM = CAST(? AS uniqueidentifier)
            ORDER BY r.CREATED_AT ASC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(message_id,),
            one=False
        ) or []

    def alternar_reacao(
        self,
        *,
        message_id: str,
        usuario_id: str,
        emoji: str
    ):
        existente = self.db.execute_fetch(
            query="""
                SELECT 1
                FROM TB_CHAT_REACOES
                WHERE ID_MENSAGEM = CAST(? AS uniqueidentifier)
                  AND ID_USUARIO = CAST(? AS uniqueidentifier)
                  AND EMOJI = ?
            """,
            parametros=(message_id, usuario_id, emoji),
            one=True
        )

        if existente:
            self.db.execute_commit(
                query="""
                    DELETE FROM TB_CHAT_REACOES
                    WHERE ID_MENSAGEM = CAST(? AS uniqueidentifier)
                      AND ID_USUARIO = CAST(? AS uniqueidentifier)
                      AND EMOJI = ?
                """,
                parametros=(message_id, usuario_id, emoji)
            )
            return False

        self.db.execute_commit(
            query="""
                INSERT INTO TB_CHAT_REACOES
                    (ID_REACAO, ID_MENSAGEM, ID_USUARIO, EMOJI, CREATED_AT)
                VALUES
                    (NEWID(), CAST(? AS uniqueidentifier),
                     CAST(? AS uniqueidentifier), ?, GETDATE())
            """,
            parametros=(message_id, usuario_id, emoji)
        )
        return True

    def buscar_mensagem(self, message_id: str):
        query = """
            SELECT 
                CONVERT(varchar(36), m.ID_MENSAGEM) AS ID_MENSAGEM,
                m.CONTEUDO AS CONTEUDO,
                m.TIPO AS TIPO,
                m.IMAGEM_URL AS IMAGEM_URL,
                m.TIMESTAMP AS TIMESTAMP,
                CONVERT(varchar(36), u.ID_USUARIO) AS ID_USUARIO,
                u.NOME AS NOME,
                u.ROLE AS ROLE
            FROM TB_CHAT_MENSAGENS m
            JOIN TB_CHAT_USUARIOS u ON m.ID_USUARIO = u.ID_USUARIO
            WHERE m.ID_MENSAGEM = CAST(? AS uniqueidentifier)
        """

        row = self.db.execute_fetch(
            query=query,
            parametros=(message_id,),
            one=True
        )

        if not row:
            return None

        return {
            "id": row["ID_MENSAGEM"] if isinstance(row, dict) else row[0],
            "conteudo": row["CONTEUDO"] if isinstance(row, dict) else row[1],
            "tipo": row["TIPO"] if isinstance(row, dict) else row[2],
            "imagem_url": row["IMAGEM_URL"] if isinstance(row, dict) else row[3],
            "timestamp": (
                row["TIMESTAMP"].strftime("%Y-%m-%d %H:%M:%S")
                if isinstance(row, dict)
                else row[4].strftime("%Y-%m-%d %H:%M:%S")
            ),
            "usuario_id": row["ID_USUARIO"] if isinstance(row, dict) else row[5],
            "usuario_nome": row["NOME"] if isinstance(row, dict) else row[6],
            "usuario_role": row["ROLE"] if isinstance(row, dict) else row[7],
        }
    
    def buscar_mensagem_por_id(self, message_id: str):
        query = """
            SELECT 
                CONVERT(varchar(36), ID_SALA) AS ID_SALA
            FROM TB_CHAT_MENSAGENS
            WHERE ID_MENSAGEM = CAST(? AS uniqueidentifier)
        """
        row = self.db.execute_fetch(
            query=query,
            parametros=(message_id,),
            one=True
        )

        if not row:
            return None

        return {
            "sala_id": row["ID_SALA"] if isinstance(row, dict) else row[0]
        }

    def marcar_como_excluida(self, message_id: str):
        query = """
            UPDATE TB_CHAT_MENSAGENS
            SET 
                CONTEUDO = 'Mensagem excluída pelo supervisor',
                TIPO = 'sistema'
            WHERE ID_MENSAGEM = CAST(? AS uniqueidentifier)
        """
        self.db.execute_commit(
            query=query,
            parametros=(message_id,)
        )
