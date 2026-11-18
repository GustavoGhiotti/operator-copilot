from datetime import datetime
from uuid import uuid4
from flask import jsonify
from src.infrastructure.repositories.sql_chat_repository import *
from src.infrastructure.repositories.chat_image_repository import ChatImageRepository

repo = ChatRoomsRepository()


def montar_url_imagem_chat(valor: str | None):
    if not valor:
        return None

    if valor.startswith((
        "http://",
        "https://",
        "/api/chat/uploads/",
        "/chat/uploads/"
    )):
        return valor

    return f"/api/chat/uploads/{valor}"

class ListarUsuariosChatService:
    def executar(self):
        rows = ChatUsersRepository().listar_todos()

        if not rows:
            return []

        usuarios = []

        for r in rows:
            usuarios.append({
                "id": str(r["ID_USUARIO"]),
                "nome": r["NOME"].strip() if r["NOME"] else None,
                "role": r["ROLE"],
                "carteira": r["CARTEIRA"],
                "status": r["STATUS"].lower() if r["STATUS"] else "offline",
                "last_seen": (
                    r["LAST_SEEN"].strftime("%Y-%m-%d %H:%M:%S")
                    if isinstance(r["LAST_SEEN"],datetime)
                    else None
                )
            })

        return usuarios

class ListarSalasChatService:
    def executar(self,*,usuario_nome: str,carteira: str | None,role: str | None = None):
        if not usuario_nome:
            return jsonify({"erro":"Usuário não informado"}),400

        usuario_id = repo.buscar_id_usuario(usuario_nome)

        if not usuario_id and role:
            usuario_id = ChatUsersRepository().ensure_usuario(
                nome=usuario_nome,
                role=role,
                carteira=carteira or ""
            )

        if not usuario_id:
            return jsonify({"erro":"Usuário não encontrado"}),404

        salas_db = repo.listar_salas(carteira) or []

        salas = []
        membros_cache = {}

        for sala in salas_db:
            if sala["TIPO"] == "privado":
                if not repo.usuario_tem_acesso_sala(
                    sala_id=sala["ID_SALA"],
                    usuario_id=usuario_id,
                    criado_por=sala["CRIADO_POR"]
                ):
                    continue

            membros_cache_key = (
                sala["TIPO"],
                sala["CARTEIRA"] if sala["TIPO"] == "carteira" else None,
                sala["ID_SALA"] if sala["TIPO"] == "privado" else None,
            )

            if membros_cache_key not in membros_cache:
                membros_cache[membros_cache_key] = repo.listar_membros_sala(
                    tipo=sala["TIPO"],
                    sala_id=sala["ID_SALA"],
                    carteira=sala["CARTEIRA"]
                ) or []

            membros = membros_cache[membros_cache_key]
            salas.append({
                "id": sala["ID_SALA"],
                "nome": sala["NOME"],
                "tipo": sala["TIPO"],
                "carteira": sala["CARTEIRA"],
                "criado_por": str(sala["CRIADO_POR"]),
                "descricao": sala["DESCRICAO"] or "",
                "membros": membros,
                "pinned_message": None,
                "is_active": True
            })

        return salas

class CriarSalaChatService:
    def executar(
        self,
        *,
        nome: str,
        tipo: str,
        carteira: str | None,
        criado_por_nome: str
    ):
        if not nome:
            return jsonify({"erro":"Nome da sala é obrigatório"}),400

        if tipo not in ["carteira","geral","privado"]:
            return jsonify({"erro":"Tipo de sala inválido"}),400

        if tipo == "carteira" and not carteira:
            return jsonify({"erro":"Carteira é obrigatória para sala do tipo carteira"}),400

        criado_por_id = repo.buscar_id_usuario(criado_por_nome)

        if not criado_por_id:
            return jsonify({"erro":"Usuário criador não encontrado"}),400

        sala_id = repo.criar_sala(
            nome=nome,
            tipo=tipo,
            carteira=carteira if tipo == "carteira" else None,
            criado_por_id=criado_por_id
        )

        if not sala_id:
            return jsonify({"erro":"Erro ao criar sala"}),500

        if tipo == "privado":
            repo.adicionar_membro(
                sala_id=sala_id,
                usuario_id=criado_por_id
            )

        membros = repo.listar_membros_sala(
            tipo=tipo,
            sala_id=sala_id,
            carteira=carteira if tipo == "carteira" else None
        ) or []

        return {
            "id": sala_id,
            "nome": nome,
            "tipo": tipo,
            "carteira": carteira if tipo == "carteira" else None,
            "criado_por": criado_por_nome,
            "membros": membros,
            "is_active": True
        }

class ListarMensagensService:
    def executar(self,*,sala_id: str):
        if not sala_id:
            return jsonify({"erro":"ID da sala é obrigatório"}),400

        rows = ChatMessagesRepository().listar_por_sala(sala_id)

        if not rows:
            return []

        reacoes_por_mensagem = {}
        for reacao in ChatMessagesRepository().listar_reacoes_por_sala(sala_id):
            message_id = reacao["ID_MENSAGEM"]
            emoji = reacao["EMOJI"]
            grupos = reacoes_por_mensagem.setdefault(message_id, {})
            usuarios = grupos.setdefault(emoji, [])
            usuarios.append(reacao["NOME"])

        mensagens = []

        for r in rows:
            message_id = r["ID_MENSAGEM"]
            resposta = None
            if r.get("REPLY_TO_ID"):
                resposta = {
                    "id": r["REPLY_TO_ID"],
                    "conteudo": r.get("REPLY_CONTEUDO")
                    or "Mensagem indisponível",
                    "tipo": r.get("REPLY_TIPO") or "texto",
                    "usuario_nome": r.get("REPLY_USUARIO_NOME")
                    or "Usuário",
                }

            mensagens.append({
                "id": message_id,
                "conteudo": r["CONTEUDO"],
                "tipo": r["TIPO"],
                "imagem_url": montar_url_imagem_chat(r["IMAGEM_URL"]),
                "timestamp": (
                    r["TIMESTAMP"].strftime("%Y-%m-%d %H:%M:%S")
                    if isinstance(r["TIMESTAMP"],datetime)
                    else None
                ),
                "usuario_id": r["ID_USUARIO"],
                "usuario_nome": r["NOME"],
                "usuario_role": r["ROLE"],
                "fixada": bool(r.get("FIXADA")) if isinstance(r, dict) else False,
                "resposta": resposta,
                "reacoes": [
                    {
                        "emoji": emoji,
                        "quantidade": len(usuarios),
                        "usuarios": usuarios,
                    }
                    for emoji, usuarios in reacoes_por_mensagem.get(
                        message_id,
                        {}
                    ).items()
                ],
            })

        return mensagens
    
class ChatQuizListService:
    def executar(self, *, sala_id: str):
        if not sala_id:
            return {"erro": "Sala inválida"}

        quizzes = repo.buscar_quizzes_com_alternativas(
            sala_id=sala_id
            )

        resposta = []

        for q in quizzes:
            resposta.append({
                "quiz_id": q["quiz_id"],
                "pergunta": q["pergunta"],
                "tempo_limite": q["tempo_limite"],
                "correta": q["correta"],
                "created_at": q["created_at"],
                "encerrado": q["encerrado"],
                "alternativas": q["alternativas"]
            })

        return resposta


class AdicionarMembroSalaService:
    def executar(self,*,sala_id: str,usuario_id: str):
        if not sala_id:
            return jsonify({"erro":"ID da sala é obrigatório"}),400

        if not usuario_id:
            return jsonify({"erro":"user_id é obrigatório"}),400

        if not repo.sala_existe(sala_id):
            return jsonify({"erro":"Sala não encontrada"}),404

        if not repo.usuario_existe(usuario_id):
            return jsonify({"erro":"Usuário não encontrado"}),404

        if repo.usuario_ja_membro(sala_id=sala_id,usuario_id=usuario_id):
            return jsonify({"erro":"Usuário já é membro da sala"}),409

        resultado = repo.adicionar_membro(
            sala_id=sala_id,
            usuario_id=usuario_id
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao adicionar usuário à sala"}),500

        return True

class RemoverMembroSalaService:
    def executar(self,*,sala_id: str,usuario_id: str):
        if not sala_id:
            return jsonify({"erro":"ID da sala é obrigatório"}),400

        if not usuario_id:
            return jsonify({"erro":"ID do usuário é obrigatório"}),400

        if not repo.sala_existe(sala_id):
            return jsonify({"erro":"Sala não encontrada"}),404

        if not repo.usuario_ja_membro(sala_id=sala_id,usuario_id=usuario_id):
            return jsonify({"erro":"Usuário não é membro da sala"}),404

        resultado = repo.remover_membro(
            sala_id=sala_id,
            usuario_id=usuario_id
        )

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao remover usuário da sala"}),500

        return True
    
class RemoverSalaService:
    def executar(self,*,sala_id: str):
        if not sala_id:
            return jsonify({"erro":"ID da sala é obrigatório"}),400

        if not repo.sala_existe(sala_id):
            return jsonify({"erro":"Sala não encontrada"}),404

        resultado = repo.remover_sala(
            sala_id=sala_id)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao remover usuário da sala"}),500

        return True
    

class EditarSalaService:
    def executar(self,*,sala_id: str, nome:str, descricao:str):
        if not sala_id:
            return jsonify({"erro":"ID da sala é obrigatório"}),400

        if not repo.sala_existe(sala_id):
            return jsonify({"erro":"Sala não encontrada"}),404

        resultado = repo.editar_sala(
            sala_id=sala_id,
            nome = nome,
            descricao = descricao)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao remover usuário da sala"}),500

        return True




class UploadImagemChatService:
    def executar(self, *, arquivo):
        if not arquivo:
            return jsonify({"error": "Nenhum arquivo enviado"}), 400

        if not arquivo.filename:
            return jsonify({"error": "Nome de arquivo invÃ¡lido"}), 400

        nome_arquivo = ChatImageRepository().salvar(arquivo)

        if not nome_arquivo:
            return jsonify({"error": "Nome de arquivo invÃ¡lido"}), 400

        return {
            "filename": nome_arquivo,
            "url": montar_url_imagem_chat(nome_arquivo)
        }


class EnviarMensagemService:
    def executar(
        self,
        *,
        sala_id: str,
        usuario_nome: str,
        usuario_role: str,
        carteira: str,
        conteudo: str,
        tipo: str,
        imagem_url: str | None = None,
        imagem_nome: str | None = None,
        reply_to_id: str | None = None
    ):
        if not all([sala_id,usuario_nome,conteudo]):
            return {"erro":"Dados obrigatórios não informados"}

        message_id = str(uuid4())

        user_repo = ChatUsersRepository()
        msg_repo = ChatMessagesRepository()

        usuario_id = user_repo.ensure_usuario(
            nome=usuario_nome,
            role=usuario_role,
            carteira=carteira
        )

        if not usuario_id:
            return {"erro":"Erro ao garantir usuário"}

        resposta = None
        if reply_to_id:
            referencia = msg_repo.buscar_mensagem_por_id(reply_to_id)
            if not referencia or referencia["sala_id"] != sala_id:
                return {"erro": "Mensagem respondida não pertence à sala"}
            resposta = msg_repo.buscar_mensagem(reply_to_id)

        msg_repo.criar_mensagem(
            message_id=message_id,
            sala_id=sala_id,
            usuario_id=usuario_id,
            conteudo=conteudo,
            tipo=tipo,
            imagem_url=imagem_nome or imagem_url,
            reply_to_id=reply_to_id
        )

        return {
            "id": message_id,
            "sala_id": sala_id,
            "usuario_id": str(usuario_id),
            "usuario_nome": usuario_nome,
            "usuario_role": usuario_role,
            "conteudo": conteudo,
            "tipo": tipo,
            "imagem_url": montar_url_imagem_chat(imagem_nome or imagem_url),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "resposta": (
                {
                    "id": resposta["id"],
                    "conteudo": resposta["conteudo"],
                    "tipo": resposta["tipo"],
                    "usuario_nome": resposta["usuario_nome"],
                }
                if resposta
                else None
            ),
            "reacoes": [],
        }


class AlternarReacaoMensagemService:
    EMOJIS_PERMITIDOS = {"👍", "✅", "👀", "🚨"}

    @staticmethod
    def _agrupar(rows):
        grupos = {}
        for row in rows:
            grupos.setdefault(row["EMOJI"], []).append(row["NOME"])
        return [
            {
                "emoji": emoji,
                "quantidade": len(usuarios),
                "usuarios": usuarios,
            }
            for emoji, usuarios in grupos.items()
        ]

    def executar(
        self,
        *,
        message_id: str,
        sala_id: str,
        usuario_nome: str,
        emoji: str,
    ):
        if not all([message_id, sala_id, usuario_nome, emoji]):
            return {"erro": "Dados da reação não informados"}
        if emoji not in self.EMOJIS_PERMITIDOS:
            return {"erro": "Reação não permitida"}

        msg_repo = ChatMessagesRepository()
        referencia = msg_repo.buscar_mensagem_por_id(message_id)
        if not referencia or referencia["sala_id"] != sala_id:
            return {"erro": "Mensagem não encontrada nesta sala"}

        usuario_id = ChatRoomsRepository().buscar_id_usuario(usuario_nome)
        if not usuario_id:
            return {"erro": "Usuário do chat não encontrado"}

        msg_repo.alternar_reacao(
            message_id=message_id,
            usuario_id=usuario_id,
            emoji=emoji,
        )
        return {
            "status": "ok",
            "sala_id": sala_id,
            "message_id": message_id,
            "reacoes": self._agrupar(
                msg_repo.buscar_reacoes_mensagem(message_id)
            ),
        }


class EntrarSalaChatService:
    def executar(self,*,sala_id: str,usuario_nome: str):
        if not sala_id:
            return {"erro":"ID da sala é obrigatório"}

        if not usuario_nome:
            return {"erro":"Usuário não informado"}

        room_repo = ChatRoomsRepository()
        user_repo = ChatUsersRepository()

        if not room_repo.sala_existe(sala_id):
            return {"erro":"Sala não encontrada"}

        usuario_id = room_repo.buscar_id_usuario(usuario_nome)

        if not usuario_id:
            return {"erro":"Usuário não encontrado"}

        # 🔒 Aqui no futuro você pode validar:
        # - se é membro da sala privada
        # - se sala está ativa
        # - se usuário está bloqueado

        return {
            "status":"ok",
            "sala_id":sala_id,
            "usuario_id":str(usuario_id)
        }

class SairSalaChatService:
    def executar(self,*,sala_id: str,usuario_nome: str):
        if not sala_id:
            return {"erro":"ID da sala é obrigatório"}

        if not usuario_nome:
            return {"erro":"Usuário não informado"}

        room_repo = ChatRoomsRepository()

        if not room_repo.sala_existe(sala_id):
            return {"erro":"Sala não encontrada"}

        usuario_id = room_repo.buscar_id_usuario(usuario_nome)

        if not usuario_id:
            return {"erro":"Usuário não encontrado"}

        # 🔒 Aqui no futuro você pode:
        # - registrar saída no banco
        # - atualizar LAST_SEEN
        # - emitir auditoria
        # - gerenciar presença real

        return {
            "status":"ok",
            "sala_id":sala_id,
            "usuario_nome":usuario_nome,
            "usuario_id":str(usuario_id)
        }

class PinMessageService:
    def executar(self, *, sala_id: str, message_id: str, role: str):

        if role not in ["admin", "supervisor"]:
            return {"erro": "Permissão negada"}

        if not sala_id or not message_id:
            return {"erro": "Sala ou mensagem inválida"}

        room_repo = ChatRoomsRepository()
        msg_repo = ChatMessagesRepository()

        if not room_repo.sala_existe(sala_id):
            return {"erro": "Sala não encontrada"}

        mensagem = msg_repo.buscar_mensagem(message_id)

        if not mensagem:
            return {"erro": "Mensagem não encontrada"}

        room_repo.fixar_mensagem(sala_id, message_id)

        return {
            "status": "ok",
            "sala_id": sala_id,
            "mensagem": {
                **mensagem,
                "imagem_url": montar_url_imagem_chat(mensagem.get("imagem_url"))
            }
        }

class UnpinMessageService:

    def executar(self, *, sala_id: str, role: str):

        if role not in ["admin", "supervisor"]:
            return {"erro": "Permissão negada"}

        if not sala_id:
            return {"erro": "Sala inválida"}

        room_repo = ChatRoomsRepository()

        if not room_repo.sala_existe(sala_id):
            return {"erro": "Sala não encontrada"}

        room_repo.desfixar_mensagem(sala_id)

        return {
            "status": "ok",
            "sala_id": sala_id
        }

class DeleteMessageService:

    def executar(self, *, message_id: str, role: str):

        if role not in ["admin", "supervisor"]:
            return {"erro": "Permissão negada"}

        if not message_id:
            return {"erro": "Mensagem inválida"}

        repo = ChatMessagesRepository()

        mensagem = repo.buscar_mensagem_por_id(message_id)

        if not mensagem:
            return {"erro": "Mensagem não encontrada"}

        sala_id = mensagem["sala_id"]

        repo.marcar_como_excluida(message_id)

        return {
            "status": "ok",
            "message_id": message_id,
            "sala_id": sala_id,
            "conteudo": "Mensagem excluída pelo supervisor",
            "tipo": "sistema"
        }
