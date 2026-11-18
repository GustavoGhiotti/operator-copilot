import json
import unicodedata
from datetime import datetime, timedelta

from src.application.services.permissao_service import PermissaoService
from src.infrastructure.repositories.sql_arena_repository import ArenaRepository


class ArenaServiceError(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


class ArenaService:
    XP_POR_NIVEL = 500
    AURORA_CHARACTER_SLOTS = {
        "VISUAL",
        "CABECA",
        "OCULOS",
        "BRINCO",
        "MAQUIAGEM",
        "SUPERIOR",
        "INFERIOR",
        "CALCADO",
    }
    AURORA_SLOTS = {
        "VISUAL",
        "FUNDO",
        "AURA",
        "MOLDURA",
    }
    # Somente itens com render de corpo inteiro revisado podem ser publicados.
    # As variantes por filtro e as pecas sem calcado completo ficam preservadas
    # no historico do banco, mas nao entram no provador.
    AURORA_LEGACY_PRESET_CODES = {
        "OCULOS_PULSE",
        "OCULOS_SOLAR_ORBITA",
        "BONE_ARENA",
        "FONE_NEON",
        "BRINCO_ORBITA",
        "JAQUETA_LUNAR",
        "MOLETOM_COSMOS",
        "CALCA_CARGO_CIANO",
        "CALCA_PULSE_ORANGE",
        "SANDALIA_HOLO",
        "TENIS_CASUAL_ARENA",
        "COTURNO_COSMOS",
    }
    AURORA_LEGACY_PRESET_KEYS = {
        "oculos-pulse",
        "oculos-solar-orbita",
        "bone-arena",
        "fone-neon",
        "brinco-orbita",
        "jaqueta-lunar",
        "moletom-cosmos",
        "calca-cargo-ciano",
        "calca-pulse-orange",
        "sandalia-holo",
        "tenis-casual-arena",
        "coturno-cosmos",
    }
    AURORA_PRESET_CODES = {
        f"AURORA_LOOK_{numero:02d}" for numero in range(1, 51)
    } | AURORA_LEGACY_PRESET_CODES
    AURORA_PRESET_KEYS = {
        f"look-{numero:02d}" for numero in range(1, 51)
    } | AURORA_LEGACY_PRESET_KEYS
    AURORA_ENVIRONMENT_CODES = {
        "FUNDO_ESTUDIO",
        "FUNDO_ARQUIBANCADA",
        "FUNDO_NEBULOSA",
        "FUNDO_PODIO",
        "AURA_PULSO",
        "AURA_CHAMA",
        "AURA_AURORA",
        "AURA_LENDARIA",
        "MOLDURA_BRONZE",
        "MOLDURA_PRATA",
        "MOLDURA_OURO",
    }
    # Janela em que outros bingos ainda sao aceitos depois do primeiro.
    # Cobre com folga a variacao de entrega medida (o polling de reserva do
    # cliente e de 3s), sem que a sala perceba a pausa.
    JANELA_DISPUTA_SEGUNDOS = 3

    # Quem acompanha qualquer partida agora e a area 'arena.observatorio' em
    # TB_PERMISSAO_VISAO -- incluir uma gerencia nova virou INSERT, nao deploy.
    # Destes, quem tambem pode assumir o comando de uma partida alheia continua
    # restrito a quem mantem o sistema.
    ARENA_CENTROS_CONTROLE = {"DESENVOLVIMENTO"}

    def __init__(self, permissoes=None):
        self.repo = ArenaRepository()
        self.permissoes = permissoes or PermissaoService()

    @staticmethod
    def _normalizar(valor):
        texto = " ".join(str(valor or "").strip().upper().split())
        return "".join(
            caractere
            for caractere in unicodedata.normalize("NFD", texto)
            if unicodedata.category(caractere) != "Mn"
        )

    @staticmethod
    def _serializar_data(valor):
        if valor is None:
            return None
        if hasattr(valor, "isoformat"):
            return valor.isoformat()
        return str(valor)

    def _usuario(self, cpf):
        usuario = self.repo.obter_usuario(str(cpf or "").strip())
        if not usuario:
            raise ArenaServiceError("Usuário não encontrado ou inativo.", 403)
        return usuario

    def _areas(self, usuario):
        return self.permissoes.areas_para(
            funcao=(usuario or {}).get("funcao"),
            centro_custo=(usuario or {}).get("centro_custo"),
            cpf=(usuario or {}).get("cpf"),
        )

    def _supervisor(self, cpf):
        usuario = self._usuario(cpf)
        if "arena.supervisor" not in self._areas(usuario):
            raise ArenaServiceError(
                "A criação de campanhas é exclusiva dos supervisores.",
                403,
            )
        return usuario

    def _observador(self, cpf):
        """Quem pode acompanhar qualquer partida da empresa.

        A guarda mora aqui, e nao na tela: o observatorio expoe a cartela e o
        desempenho de qualquer operador: esconder o botao no front nao seria
        controle de acesso.
        """
        usuario = self._usuario(cpf)
        if "arena.observatorio" not in self._areas(usuario):
            raise ArenaServiceError(
                "O observatório da Arena é restrito.",
                403,
            )
        return usuario

    def _eh_observador(self, usuario):
        """Sem levantar: as leituras de estado precisam so do booleano."""
        return "arena.observatorio" in self._areas(usuario)

    def _pode_assumir(self, cpf):
        """Quem pode tomar o comando de uma partida alheia."""
        usuario = self._observador(cpf)
        centro = self._normalizar(usuario.get("centro_custo"))
        if centro not in self.ARENA_CENTROS_CONTROLE:
            raise ArenaServiceError(
                "Seu acesso ao observatório é somente de acompanhamento.",
                403,
            )
        return usuario

    @staticmethod
    def _limite(valor, padrao=20, maximo=100):
        try:
            return max(1, min(int(valor or padrao), maximo))
        except (TypeError, ValueError):
            raise ArenaServiceError("Limite inválido.", 400)

    def listar_tipos_jogo(self, cpf):
        self._usuario(cpf)
        return self.repo.listar_tipos_jogo()

    def obter_hub(self, cpf):
        usuario = self._usuario(cpf)
        temporada = self.repo.obter_temporada_atual()
        id_temporada = temporada.get("id") if temporada else None
        perfil = self.repo.obter_perfil(str(cpf), id_temporada)
        xp_total = int(perfil.get("xp_total") or 0)
        nivel_calculado = max(1, xp_total // self.XP_POR_NIVEL + 1)
        nivel = max(int(perfil.get("nivel") or 1), nivel_calculado)
        inicio_nivel = (nivel - 1) * self.XP_POR_NIVEL
        proximo_nivel = nivel * self.XP_POR_NIVEL

        campanhas = []
        for row in self.repo.listar_hub_operador(str(cpf)):
            campanhas.append({
                **row,
                "data_agendada": self._serializar_data(row.get("data_agendada")),
                "convite_expira_em": self._serializar_data(
                    row.get("convite_expira_em")
                ),
                "limite_entrada_em": self._serializar_data(
                    row.get("limite_entrada_em")
                ),
            })

        return {
            "usuario": {
                "cpf": usuario["cpf"],
                "nome": usuario["nome"],
                "centro_custo": usuario.get("centro_custo"),
            },
            "temporada": None if not temporada else {
                **temporada,
                "data_inicio": self._serializar_data(temporada.get("data_inicio")),
                "data_fim": self._serializar_data(temporada.get("data_fim")),
            },
            "perfil": {
                "xp_total": xp_total,
                "xp_temporada": int(perfil.get("xp_temporada") or 0),
                "nivel": nivel,
                "titulo": perfil.get("titulo") or "Iniciante",
                "xp_inicio_nivel": inicio_nivel,
                "xp_proximo_nivel": proximo_nivel,
            },
            "campanhas": campanhas,
        }

    def _garantir_personalizacao_aurora(self):
        if not self.repo.personalizacao_aurora_habilitada():
            raise ArenaServiceError(
                "A personalizaÃ§Ã£o da Aurora ainda nÃ£o foi habilitada no banco.",
                503,
            )

    def obter_personalizacao_aurora(self, cpf):
        self._usuario(cpf)
        self._garantir_personalizacao_aurora()
        estado = self.repo.obter_personalizacao_aurora(str(cpf))
        saldo_coins = int(estado.get("saldo_coins") or 0)
        xp_total = int(estado.get("xp_total") or 0)
        itens = []
        equipado = {}
        filtros = {}
        candidatos_equipados = {}
        for row in estado.get("itens") or []:
            slot_original = self._normalizar(row.get("slot"))
            codigo = self._normalizar(row.get("codigo"))
            chave_visual = str(
                row.get("chave_visual") or row.get("codigo") or ""
            )
            filtro_cor = row.get("filtro_cor") or None
            eh_personagem = slot_original in self.AURORA_CHARACTER_SLOTS

            if eh_personagem and (
                codigo not in self.AURORA_PRESET_CODES
                or chave_visual not in self.AURORA_PRESET_KEYS
                or filtro_cor
            ):
                continue

            slot = "VISUAL" if eh_personagem else slot_original
            if slot not in self.AURORA_SLOTS:
                continue
            adquirido = bool(row.get("adquirido"))
            esta_equipado = bool(row.get("equipado"))
            preco = int(row.get("preco_coins") or 0)
            xp_necessario = int(row.get("xp_necessario") or 0)
            item = {
                "id": int(row["id"]),
                "codigo": codigo,
                "nome": row.get("nome") or "Visual da Aurora",
                "descricao": row.get("descricao"),
                "slot": slot,
                "raridade": self._normalizar(row.get("raridade") or "COMUM"),
                "preco_coins": preco,
                "xp_necessario": xp_necessario,
                "chave_visual": chave_visual,
                "filtro_cor": None,
                "codigo_conjunto": row.get("codigo_conjunto") or None,
                "nome_conjunto": row.get("nome_conjunto") or None,
                "adquirido": adquirido,
                "adquirido_em": self._serializar_data(row.get("adquirido_em")),
                "equipado": False,
                "desbloqueado": xp_total >= xp_necessario,
                "pode_comprar": (
                    not adquirido
                    and xp_total >= xp_necessario
                    and saldo_coins >= preco
                ),
            }
            itens.append(item)
            if esta_equipado:
                pontuacao = (
                    self._serializar_data(row.get("equipado_em")) or "",
                    item["id"],
                )
                anterior = candidatos_equipados.get(slot)
                if anterior is None or pontuacao > anterior[0]:
                    candidatos_equipados[slot] = (pontuacao, len(itens) - 1)

        for slot, (_, indice) in candidatos_equipados.items():
            itens[indice]["equipado"] = True
            equipado[slot] = itens[indice]["chave_visual"]

        return {
            "xp_total": xp_total,
            "saldo_coins": saldo_coins,
            "equipado": equipado,
            "filtros": filtros,
            "colecao": self._resumo_colecao(itens, xp_total),
            "conjuntos": self._resumo_conjuntos(itens),
            "itens": itens,
        }

    @staticmethod
    def _resumo_colecao(itens, xp_total):
        """Quanto do armario ja e seu e qual e a proxima conquista.

        O proximo desbloqueio vem calculado daqui, e nao da tela: mostrar
        "faltam 725 XP" e o que transforma um cadeado em objetivo.
        """
        adquiridos = [item for item in itens if item["adquirido"]]
        bloqueados = sorted(
            (item for item in itens if not item["desbloqueado"]),
            key=lambda item: item["xp_necessario"],
        )
        proximo = bloqueados[0] if bloqueados else None
        return {
            "total": len(itens),
            "adquiridos": len(adquiridos),
            "proximo_desbloqueio": None if not proximo else {
                "codigo": proximo["codigo"],
                "nome": proximo["nome"],
                "raridade": proximo["raridade"],
                "xp_necessario": proximo["xp_necessario"],
                "xp_faltando": max(0, proximo["xp_necessario"] - xp_total),
            },
        }

    @staticmethod
    def _resumo_conjuntos(itens):
        """Conjuntos so contam como completos com TODAS as pecas adquiridas."""
        conjuntos = {}
        for item in itens:
            codigo = item["codigo_conjunto"]
            if not codigo:
                continue
            grupo = conjuntos.setdefault(codigo, {
                "codigo": codigo,
                "nome": item["nome_conjunto"] or codigo,
                "total": 0,
                "adquiridos": 0,
                "equipados": 0,
            })
            grupo["total"] += 1
            if item["adquirido"]:
                grupo["adquiridos"] += 1
            if item["equipado"]:
                grupo["equipados"] += 1
        for grupo in conjuntos.values():
            grupo["completo"] = grupo["adquiridos"] == grupo["total"]
            # Bonus visual so vale com o conjunto inteiro VESTIDO — ter as
            # pecas guardadas nao e o mesmo que usar o look.
            grupo["ativo"] = grupo["equipados"] == grupo["total"]
        return sorted(conjuntos.values(), key=lambda grupo: grupo["nome"])

    def comprar_visual_aurora(self, cpf, dados):
        self._usuario(cpf)
        self._garantir_personalizacao_aurora()
        codigo_item = self._normalizar((dados or {}).get("codigo_item"))
        if not codigo_item or len(codigo_item) > 60:
            raise ArenaServiceError("Informe um visual vÃ¡lido.", 400)
        if codigo_item not in (
            self.AURORA_PRESET_CODES | self.AURORA_ENVIRONMENT_CODES
        ):
            raise ArenaServiceError(
                "Este visual ainda nÃ£o possui um preset completo aprovado.",
                409,
            )
        try:
            self.repo.comprar_visual_aurora(str(cpf), codigo_item)
        except ValueError as erro:
            codigo = str(erro)
            mensagens = {
                "ITEM_NAO_ENCONTRADO": ("Visual nÃ£o encontrado.", 404),
                "ITEM_JA_ADQUIRIDO": ("Este visual jÃ¡ estÃ¡ no seu guarda-roupa.", 409),
                "XP_INSUFICIENTE": ("VocÃª ainda nÃ£o possui XP suficiente para desbloquear este visual.", 409),
                "COINS_INSUFICIENTES": ("Saldo insuficiente de Aurora Coins.", 409),
            }
            if codigo in mensagens:
                mensagem, status = mensagens[codigo]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_personalizacao_aurora(cpf)

    def equipar_visual_aurora(self, cpf, dados):
        self._usuario(cpf)
        self._garantir_personalizacao_aurora()
        slot = self._normalizar((dados or {}).get("slot"))
        codigo_bruto = (dados or {}).get("codigo_item")
        codigo_item = (
            self._normalizar(codigo_bruto)
            if codigo_bruto is not None
            else None
        )
        if slot not in self.AURORA_SLOTS:
            raise ArenaServiceError("Categoria de visual invÃ¡lida.", 400)
        if codigo_item is not None and (
            not codigo_item or len(codigo_item) > 60
        ):
            raise ArenaServiceError("Informe um visual vÃ¡lido.", 400)
        if (
            slot == "VISUAL"
            and codigo_item is not None
            and codigo_item not in self.AURORA_PRESET_CODES
        ):
            raise ArenaServiceError(
                "Este visual ainda nÃ£o possui um preset completo aprovado.",
                409,
            )
        try:
            self.repo.equipar_visual_aurora(
                str(cpf),
                slot,
                codigo_item,
            )
        except ValueError as erro:
            codigo = str(erro)
            mensagens = {
                "ITEM_NAO_ADQUIRIDO": (
                    "Compre o visual antes de equipÃ¡-lo.",
                    409,
                ),
                "SLOT_INVALIDO": ("O visual nÃ£o pertence a esta categoria.", 400),
            }
            if codigo in mensagens:
                mensagem, status = mensagens[codigo]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_personalizacao_aurora(cpf)

    def ranking_centros(self, cpf, limite=20):
        self._usuario(cpf)
        temporada = self.repo.obter_temporada_atual()
        id_temporada = temporada.get("id") if temporada else None
        rows = self.repo.listar_ranking_centros(
            id_temporada,
            self._limite(limite),
        )
        return {
            "temporada": temporada.get("nome") if temporada else None,
            "ranking": [
                {
                    "posicao": indice,
                    "centro_custo": row["centro_custo"],
                    "xp_total": int(row.get("xp_total") or 0),
                    "participantes": int(row.get("participantes") or 0),
                    "xp_medio": float(row.get("xp_medio") or 0),
                }
                for indice, row in enumerate(rows, start=1)
            ],
        }

    def ranking_operadores(self, cpf, centro_custo, limite=50):
        self._usuario(cpf)
        centro = " ".join(str(centro_custo or "").strip().split())
        if not centro:
            raise ArenaServiceError("Centro de Custo é obrigatório.", 400)
        temporada = self.repo.obter_temporada_atual()
        id_temporada = temporada.get("id") if temporada else None
        rows = self.repo.listar_ranking_operadores(
            id_temporada,
            centro,
            self._limite(limite, 50, 200),
        )
        return {
            "centro_custo": centro,
            "temporada": temporada.get("nome") if temporada else None,
            "ranking": [
                {
                    "posicao": indice,
                    "cpf": row["cpf"],
                    "nome": row.get("nome") or "Operador",
                    "xp_total": int(row.get("xp_total") or 0),
                    "campanhas": int(row.get("campanhas") or 0),
                }
                for indice, row in enumerate(rows, start=1)
            ],
        }

    def responder_convite(self, cpf, id_convite, dados):
        self._usuario(cpf)
        resposta = self._normalizar(dados.get("resposta"))
        if resposta not in {"ACEITO", "RECUSADO"}:
            raise ArenaServiceError(
                "A resposta deve ser ACEITO ou RECUSADO.",
                400,
            )
        try:
            return self.repo.responder_convite(
                int(id_convite),
                str(cpf),
                resposta,
            )
        except (TypeError, ValueError) as erro:
            codigo = str(erro)
            if codigo == "CONVITE_JA_RESPONDIDO":
                raise ArenaServiceError("Este convite já foi respondido.", 409)
            if codigo == "CONVITE_NAO_ENCONTRADO":
                raise ArenaServiceError("Convite não encontrado.", 404)
            raise

    @staticmethod
    def _visual_do_participante(participante):
        """Converte o JSON do banco no formato que o avatar consome.

        Vem como JSON de uma subconsulta para nao multiplicar as linhas de
        participante por peca equipada.
        """
        bruto = participante.get("visual_json")
        if not bruto:
            return {"equipado": {}, "filtros": {}}
        try:
            pecas = json.loads(bruto)
        except (TypeError, ValueError):
            return {"equipado": {}, "filtros": {}}

        equipado = {}
        for peca in pecas or []:
            slot = str(peca.get("slot") or "").upper()
            if not slot:
                continue
            chave = peca.get("chave")
            if slot in ArenaService.AURORA_CHARACTER_SLOTS:
                if (
                    "VISUAL" not in equipado
                    and not peca.get("filtro")
                    and chave in ArenaService.AURORA_PRESET_KEYS
                ):
                    equipado["VISUAL"] = chave
                continue
            if slot in {"FUNDO", "AURA", "MOLDURA"}:
                equipado[slot] = chave
        return {"equipado": equipado, "filtros": {}}

    def _serializar_estado_sessao(self, estado):
        if not estado:
            raise ArenaServiceError("Sala não encontrada.", 404)
        campos_data = {
            "aberta_em",
            "limite_entrada_em",
            "iniciada_em",
            "finalizada_em",
            "servidor_agora",
        }
        resultado = {
            chave: self._serializar_data(valor) if chave in campos_data else valor
            for chave, valor in estado.items()
            if chave != "participantes"
        }
        resultado["entrada_aberta"] = bool(resultado.get("entrada_aberta"))
        resultado["participantes"] = [
            {
                **{
                    chave: valor for chave, valor in participante.items()
                    if chave != "visual_json"
                },
                "visual": self._visual_do_participante(participante),
                "entrou_em": self._serializar_data(participante.get("entrou_em")),
                "ultimo_heartbeat_em": self._serializar_data(
                    participante.get("ultimo_heartbeat_em")
                ),
            }
            for participante in estado.get("participantes") or []
        ]
        return resultado

    def obter_estado_sessao(self, cpf, id_sessao):
        usuario = self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
        except (TypeError, ValueError):
            raise ArenaServiceError("Sala inválida.", 400)
        acesso = self.repo.obter_acesso_sessao(
            sessao_id,
            str(cpf),
            self._eh_observador(usuario),
        )
        if not acesso:
            raise ArenaServiceError("Você não possui acesso a esta sala.", 403)
        if acesso.get("status") == "AGUARDANDO" and acesso.get("pode_iniciar"):
            try:
                self.repo.iniciar_sessao(
                    sessao_id,
                    str(acesso.get("cpf_criador")),
                )
            except ValueError as erro:
                # `SALA_VAZIA` substituiu `JANELA_AINDA_ABERTA` aqui: com o
                # prazo vencido e ninguem dentro, este inicio preguicoso passa
                # a falhar — e sem engolir, qualquer leitura do estado da sala
                # viraria erro 500 para quem abrisse a tela.
                if str(erro) not in {"SESSAO_JA_INICIADA", "SALA_VAZIA"}:
                    raise
        estado = self._serializar_estado_sessao(
            self.repo.obter_estado_sessao(sessao_id)
        )
        estado["papel"] = "SUPERVISOR" if acesso.get("supervisor") else "OPERADOR"
        return estado

    def entrar_sala(self, cpf, id_sessao):
        self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
            self.repo.entrar_sala(sessao_id, str(cpf))
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala não encontrada.", 404),
                "CONVITE_NAO_ACEITO": (
                    "Aceite o convite antes de entrar na sala.",
                    409,
                ),
                "JANELA_ENCERRADA": (
                    "A janela de entrada desta sala já foi encerrada.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_sessao(cpf, sessao_id)

    def atualizar_conexao_sessao(self, cpf, id_sessao, conectado):
        usuario = self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
        except (TypeError, ValueError):
            raise ArenaServiceError("Sala inválida.", 400)
        acesso = self.repo.obter_acesso_sessao(
            sessao_id,
            str(cpf),
            self._eh_observador(usuario),
        )
        if not acesso:
            raise ArenaServiceError("Você não possui acesso a esta sala.", 403)
        # Nem supervisor nem observador aparecem como presentes na sala: os
        # dois estão assistindo, não jogando, e contá-los inflaria o número de
        # participantes que o próprio jogo usa para decidir coisas.
        if not acesso.get("supervisor") and not acesso.get("observador"):
            self.repo.atualizar_conexao_sessao(
                sessao_id,
                str(cpf),
                bool(conectado),
            )
        return self.obter_estado_sessao(cpf, sessao_id)

    def registrar_heartbeat(self, cpf, id_sessao):
        usuario = self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
        except (TypeError, ValueError):
            raise ArenaServiceError("Sala inválida.", 400)
        acesso = self.repo.obter_acesso_sessao(
            sessao_id,
            str(cpf),
            self._eh_observador(usuario),
        )
        if not acesso:
            raise ArenaServiceError("Você não possui acesso a esta sala.", 403)
        if not acesso.get("supervisor") and not acesso.get("observador"):
            self.repo.atualizar_conexao_sessao(
                sessao_id,
                str(cpf),
                True,
            )
        return {"status": "ok"}

    def processar_fluxo_quiz(self, id_sessao):
        try:
            return self.repo.processar_fluxo_quiz(int(id_sessao))
        except (TypeError, ValueError) as erro:
            if str(erro) == "SESSAO_NAO_ENCONTRADA":
                raise ArenaServiceError("Sala não encontrada.", 404)
            raise

    def obter_estado_quiz(self, cpf, id_sessao, recuperar=True):
        usuario = self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
        except (TypeError, ValueError):
            raise ArenaServiceError("Sala inválida.", 400)
        acesso = self.repo.obter_acesso_sessao(
            sessao_id,
            str(cpf),
            self._eh_observador(usuario),
        )
        if not acesso:
            raise ArenaServiceError("Você não possui acesso a esta sala.", 403)
        if recuperar and acesso.get("status") in {"EM_ANDAMENTO", "FINALIZADA"}:
            self.repo.processar_fluxo_quiz(sessao_id)
        estado = self.repo.obter_estado_quiz(
            sessao_id,
            str(cpf),
            self._eh_observador(usuario),
        )
        if not estado:
            raise ArenaServiceError("Quiz não encontrado para esta sala.", 404)
        rodada = estado.get("rodada")
        if rodada:
            for campo in ("iniciada_em", "encerra_em", "encerrada_em"):
                rodada[campo] = self._serializar_data(rodada.get(campo))
            rodada["alternativas"] = [
                {
                    **alternativa,
                    "correta": (
                        None if alternativa.get("correta") is None
                        else bool(alternativa.get("correta"))
                    ),
                }
                for alternativa in rodada.get("alternativas") or []
            ]
            if rodada.get("resposta"):
                resposta = rodada["resposta"]
                resposta["respondida_em"] = self._serializar_data(
                    resposta.get("respondida_em")
                )
                resposta["correta"] = (
                    None if resposta.get("correta") is None
                    else bool(resposta.get("correta"))
                )
        status_sessao = estado.get("status_sessao")
        if status_sessao == "FINALIZADA":
            fase = "FINALIZADO"
        elif rodada and rodada.get("status") == "ABERTA":
            fase = "PERGUNTA"
        elif rodada and rodada.get("status") == "ENCERRADA":
            fase = "RESULTADO"
        else:
            fase = "AGUARDANDO"
        return {
            **estado,
            "servidor_agora": self._serializar_data(estado.get("servidor_agora")),
            "fase": fase,
            "pontuacao": int(estado.get("pontuacao") or 0),
            "xp_concedido": int(estado.get("xp_concedido") or 0),
            "rodada": rodada,
            "placar": [] if status_sessao != "FINALIZADA" else [
                {
                    **item,
                    "pontos": int(item.get("pontos") or 0),
                    "acertos": int(item.get("acertos") or 0),
                    "xp": int(item.get("xp") or 0),
                    "pontos": int(item.get("pontos") or 0),
                }
                for item in estado.get("placar") or []
            ],
        }

    def responder_quiz(self, cpf, id_sessao, dados):
        self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
            id_rodada = int(dados.get("id_rodada"))
            id_alternativa = int(dados.get("id_alternativa"))
        except (TypeError, ValueError):
            raise ArenaServiceError("Resposta inválida.", 400)
        acesso = self.repo.obter_acesso_sessao(sessao_id, str(cpf))
        if not acesso or acesso.get("supervisor"):
            raise ArenaServiceError(
                "Somente operadores participantes podem responder.",
                403,
            )
        try:
            self.repo.responder_quiz(
                sessao_id,
                str(cpf),
                id_rodada,
                id_alternativa,
            )
        except ValueError as erro:
            mensagens = {
                "PARTICIPANTE_INVALIDO": ("Você não está participando desta rodada.", 403),
                "RODADA_ENCERRADA": ("Esta pergunta já foi encerrada.", 409),
                "TEMPO_ESGOTADO": ("O tempo para responder terminou.", 409),
                "RESPOSTA_JA_REGISTRADA": ("Sua resposta já foi registrada.", 409),
                "ALTERNATIVA_INVALIDA": ("Alternativa inválida.", 400),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_quiz(cpf, sessao_id, recuperar=False)

    def obter_estado_bingo(self, cpf, id_sessao):
        usuario = self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
        except (TypeError, ValueError):
            raise ArenaServiceError("Sala inválida.", 400)
        acesso = self.repo.obter_acesso_sessao(
            sessao_id,
            str(cpf),
            self._eh_observador(usuario),
        )
        if not acesso:
            raise ArenaServiceError("Você não possui acesso a esta sala.", 403)
        # Fechamento preguiçoso da janela: se a tarefa de fundo não rodou, a
        # primeira leitura depois do prazo resolve. Sem isso, uma tarefa que
        # morre deixaria a partida travada em "disputa aberta" para sempre.
        self.repo.fechar_janela_bingo(
            sessao_id,
            self.JANELA_DISPUTA_SEGUNDOS,
        )
        estado = self.repo.obter_estado_bingo(
            sessao_id,
            str(cpf),
            self._eh_observador(usuario),
        )
        if not estado:
            raise ArenaServiceError("Bingo não encontrado para esta sala.", 404)
        for sorteio in estado.get("sorteios") or []:
            sorteio["sorteado_em"] = self._serializar_data(sorteio.get("sorteado_em"))
        for casa in estado.get("cartela") or []:
            casa["livre"] = bool(casa.get("livre"))
            casa["marcada"] = bool(casa.get("marcada"))
            casa["marcada_em"] = self._serializar_data(casa.get("marcada_em"))
        # Observador ve o jogo inteiro, mas com papel proprio: a tela precisa
        # saber que ele nao e o dono para nao oferecer os controles.
        papel = "OBSERVADOR" if acesso.get("observador") else estado.get("papel")
        finalizada = estado.get("status_sessao") == "FINALIZADA"
        progresso = estado.get("progresso") or []
        if papel not in ("SUPERVISOR", "OBSERVADOR") and not finalizada:
            progresso = []

        # Janela de disputa: enquanto ela corre, outros bingos ainda entram.
        janela_aberta_em = estado.get("janela_aberta_em")
        aguardando_decisao = bool(estado.get("aguardando_decisao"))
        disputa_encerra_em = None
        disputa_aberta = False
        if janela_aberta_em and not aguardando_decisao:
            disputa_encerra_em = janela_aberta_em + timedelta(
                seconds=self.JANELA_DISPUTA_SEGUNDOS
            )
            agora = estado.get("servidor_agora") or datetime.now()
            disputa_aberta = agora < disputa_encerra_em

        # Empate pendente: alguém venceu mas ninguém tem colocação ainda.
        aguardando_desempate = bool(
            aguardando_decisao
            and not estado.get("desempate_em")
            and sum(
                1 for vitoria in estado.get("vitorias") or []
                if vitoria.get("posicao") is None
            ) >= 2
        )

        return {
            **estado,
            "servidor_agora": self._serializar_data(estado.get("servidor_agora")),
            "iniciada_em": self._serializar_data(estado.get("iniciada_em")),
            "finalizada_em": self._serializar_data(estado.get("finalizada_em")),
            "pausada_em": self._serializar_data(estado.get("pausada_em")),
            "casa_livre": bool(estado.get("casa_livre")),
            "pausada": bool(estado.get("pausada")),
            "papel": papel,
            "aguardando_decisao": bool(estado.get("aguardando_decisao")),
            "disputa_aberta": disputa_aberta,
            "disputa_encerra_em": self._serializar_data(disputa_encerra_em),
            "aguardando_desempate": aguardando_desempate,
            "pontuacao": int(estado.get("pontuacao") or 0),
            "xp_concedido": int(estado.get("xp_concedido") or 0),
            "total_sorteios": int(estado.get("total_sorteios") or 0),
            "participantes_online": int(estado.get("participantes_online") or 0),
            "vitorias": [
                {
                    **vitoria,
                    "id_participante": int(vitoria["id_participante"]),
                    "posicao": (
                        None if vitoria.get("posicao") is None
                        else int(vitoria["posicao"])
                    ),
                }
                for vitoria in estado.get("vitorias") or []
            ],
            "progresso": [
                {
                    **item,
                    "marcadas": int(item.get("marcadas") or 0),
                    "xp": int(item.get("xp") or 0),
                    "faltam_para_vencer": int(
                        item.get("faltam_para_vencer") or 0
                    ),
                    "quase_bingo": bool(item.get("quase_bingo")),
                    "numeros_necessarios": [
                        int(numero)
                        for numero in item.get("numeros_necessarios") or []
                    ],
                }
                for item in progresso
            ],
        }

    def solicitar_bingo(self, cpf, id_sessao):
        self._usuario(cpf)
        try:
            sessao_id = int(id_sessao)
            self.repo.solicitar_bingo(
                sessao_id,
                str(cpf),
                self.JANELA_DISPUTA_SEGUNDOS,
            )
        except (TypeError, ValueError) as erro:
            mensagens = {
                "PARTICIPANTE_INVALIDO": ("Você não participa desta cartela.", 403),
                "SESSAO_NAO_ATIVA": ("Esta partida não está em andamento.", 409),
                "BINGO_PAUSADO": ("A partida está pausada pelo supervisor.", 409),
                "BINGO_AGUARDANDO_DECISAO": (
                    "Uma vitória foi confirmada. Aguarde a decisão do supervisor.",
                    409,
                ),
                "BINGO_JA_CONFIRMADO": (
                    "Sua vitória neste padrão já foi registrada.", 409
                ),
                "BINGO_INVALIDO": (
                    "Sua cartela ainda não completou o padrão de vitória.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_bingo(cpf, sessao_id)


class ArenaSupervisorService(ArenaService):
    TIPOS_STATUS = {
        "RASCUNHO",
        "PUBLICADA",
        "SALA_ABERTA",
        "EM_ANDAMENTO",
        "FINALIZADA",
        "CANCELADA",
    }

    def __init__(self, quiz_ai_service=None, permissoes=None):
        super().__init__(permissoes=permissoes)
        self.quiz_ai_service = quiz_ai_service

    def obter_dashboard(self, cpf, incluir_arquivadas=False):
        usuario = self._supervisor(cpf)
        resumo = self.repo.obter_dashboard_supervisor(str(cpf))
        return {
            "supervisor": {
                "cpf": usuario["cpf"],
                "nome": usuario["nome"],
                "centro_custo": usuario.get("centro_custo"),
            },
            "resumo": {
                "campanhas_ativas": int(resumo.get("campanhas_ativas") or 0),
                "salas_agendadas": int(resumo.get("salas_agendadas") or 0),
                "participantes": int(resumo.get("participantes") or 0),
                "xp_distribuido": int(resumo.get("xp_distribuido") or 0),
            },
            "campanhas": self.listar_campanhas(cpf, incluir_arquivadas),
        }

    def listar_campanhas(self, cpf, incluir_arquivadas=False):
        self._supervisor(cpf)
        return [
            {
                **row,
                "participantes": int(row.get("participantes") or 0),
                "confirmados": int(row.get("confirmados") or 0),
                "data_agendada": self._serializar_data(row.get("data_agendada")),
                "criada_em": self._serializar_data(row.get("criada_em")),
                "atualizada_em": self._serializar_data(row.get("atualizada_em")),
                "limite_entrada_em": self._serializar_data(
                    row.get("limite_entrada_em")
                ),
            }
            for row in self.repo.listar_campanhas_supervisor(
                str(cpf),
                bool(incluir_arquivadas),
            )
        ]

    def arquivar_campanha(self, cpf, id_campanha):
        """Some das listas dos dois lados, sem apagar histórico nem XP."""
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        try:
            anterior = self.repo.arquivar_campanha(campanha_id, str(cpf))
        except ValueError as erro:
            mensagens = {
                "CAMPANHA_NAO_ENCONTRADA": ("Campanha não encontrada.", 404),
                "CAMPANHA_JA_ARQUIVADA": ("A campanha já está arquivada.", 409),
                "CAMPANHA_EM_JOGO": (
                    "A campanha está em jogo agora; encerre antes de arquivar.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return {
            "id_campanha": campanha_id,
            "arquivada": True,
            "status_anterior": anterior,
        }

    def desarquivar_campanha(self, cpf, id_campanha):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        try:
            destino = self.repo.desarquivar_campanha(campanha_id, str(cpf))
        except ValueError as erro:
            mensagens = {
                "CAMPANHA_NAO_ENCONTRADA": ("Campanha não encontrada.", 404),
                "CAMPANHA_NAO_ARQUIVADA": (
                    "Esta campanha não está arquivada.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return {
            "id_campanha": campanha_id,
            "arquivada": False,
            "status": destino,
        }

    def criar_campanha(self, cpf, dados):
        usuario = self._supervisor(cpf)
        titulo = " ".join(str(dados.get("titulo") or "").strip().split())
        if len(titulo) < 3 or len(titulo) > 160:
            raise ArenaServiceError(
                "O título deve ter entre 3 e 160 caracteres.",
                400,
            )

        codigo_tipo = self._normalizar(dados.get("tipo_jogo"))
        tipo = self.repo.obter_tipo_jogo(codigo_tipo)
        if not tipo:
            raise ArenaServiceError("Tipo de jogo não encontrado.", 404)

        configuracao = dados.get("configuracao") or {}
        if not isinstance(configuracao, dict):
            raise ArenaServiceError("Configuração da campanha inválida.", 400)
        try:
            json.dumps(configuracao, ensure_ascii=False)
        except (TypeError, ValueError):
            raise ArenaServiceError("Configuração da campanha inválida.", 400)

        data_agendada = None
        if dados.get("data_agendada"):
            try:
                data_agendada = datetime.fromisoformat(
                    str(dados["data_agendada"]).replace("Z", "+00:00")
                )
            except ValueError:
                raise ArenaServiceError("Data de agendamento inválida.", 400)

        temporada = self.repo.obter_temporada_atual()
        centro_custo = " ".join(
            str(dados.get("centro_custo") or "").strip().split()
        ) or None
        campanha = self.repo.criar_campanha(
            id_temporada=temporada.get("id") if temporada else None,
            id_tipo_jogo=tipo["id"],
            titulo=titulo,
            descricao=str(dados.get("descricao") or "").strip() or None,
            centro_custo=centro_custo,
            cpf_criador=str(cpf),
            nome_criador=usuario["nome"],
            data_agendada=data_agendada,
            configuracao=configuracao,
        )
        return {
            **campanha,
            "tipo_jogo": tipo["codigo"],
            "titulo": titulo,
            "janela_entrada_segundos": 300,
            "criada_em": self._serializar_data(campanha.get("criada_em")),
        }

    def listar_centros_custo(self, cpf):
        self._supervisor(cpf)
        return [
            row["centro_custo"]
            for row in self.repo.listar_centros_custo()
        ]

    def listar_operadores(self, cpf, centro_custo, busca="", limite=100):
        self._supervisor(cpf)
        centro = " ".join(str(centro_custo or "").strip().split())
        busca_normalizada = " ".join(str(busca or "").strip().split())
        if not centro and len(busca_normalizada) < 2:
            return []
        return self.repo.listar_operadores(
            centro,
            busca_normalizada,
            self._limite(limite, 100, 500),
        )

    def listar_equipes(self, cpf):
        self._supervisor(cpf)
        equipes = []
        for row in self.repo.listar_equipes_supervisor(str(cpf)):
            try:
                integrantes = json.loads(row.get("integrantes_json") or "[]")
            except (TypeError, ValueError):
                integrantes = []
            equipes.append({
                "id": int(row["id"]),
                "nome_supervisor": row.get("nome_supervisor"),
                "cpf_supervisor": str(row.get("cpf_supervisor") or ""),
                "carteira_nome": row.get("carteira_nome"),
                "integrantes": integrantes if isinstance(integrantes, list) else [],
            })
        return equipes

    @staticmethod
    def _resultado_numerico(resultado):
        inteiros = {
            "quantidade_operadores", "acordos_dia", "acordos_mes",
            "pagamentos_dia", "pagamentos_mes", "cpc_dia", "ce_dia",
            "acionamentos_dia",
        }
        return {
            chave: int(valor or 0) if chave in inteiros else float(valor or 0)
            for chave, valor in resultado.items()
        }

    @staticmethod
    def _calcular_variacao(base, atual, campo_base):
        variacao = {"base_coleta": campo_base}
        for chave, valor_atual in atual.items():
            if chave == "quantidade_operadores" or not isinstance(
                valor_atual, (int, float)
            ):
                continue
            valor_base = base.get(chave, 0)
            diferenca = valor_atual - valor_base
            percentual = None if not valor_base else round(
                (diferenca / valor_base) * 100, 2
            )
            variacao[chave] = {
                "base": valor_base,
                "atual": valor_atual,
                "diferenca": round(diferenca, 4),
                "percentual": percentual,
            }
        return variacao

    def obter_acompanhamento_resultado(self, cpf, id_campanha):
        usuario = self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        contexto = self.repo.obter_contexto_resultado_campanha(
            campanha_id, str(cpf)
        )
        if not contexto or not contexto.get("id_sessao"):
            raise ArenaServiceError("A campanha ainda não possui uma sessão.", 409)

        snapshots = self.repo.listar_snapshots_resultado(campanha_id, str(cpf))
        agora = datetime.now()
        status = contexto.get("status_campanha")
        tipo = "FINAL" if status == "FINALIZADA" else (
            "INICIAL" if not snapshots else "PERIODICO"
        )
        ultima_data = snapshots[-1].get("coletado_em") if snapshots else None
        deve_coletar = not snapshots or tipo == "FINAL" or (
            status in {"SALA_ABERTA", "EM_ANDAMENTO"}
            and (not ultima_data or ultima_data.replace(minute=0, second=0, microsecond=0)
                 < agora.replace(minute=0, second=0, microsecond=0))
        )
        if snapshots and snapshots[-1].get("tipo_snapshot") == "FINAL":
            deve_coletar = False

        if deve_coletar:
            inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            inicio_dia = agora.replace(hour=0, minute=0, second=0, microsecond=0)
            resultado = self._resultado_numerico(
                self.repo.consultar_resultado_producao(
                    campanha_id, inicio_mes, inicio_dia, agora
                )
            )
            resultado["carteira"] = (
                contexto.get("carteira_nome")
                or usuario.get("centro_custo")
                or "NAO IDENTIFICADA"
            )
            inicial = resultado
            anterior = resultado
            if snapshots:
                inicial = json.loads(snapshots[0]["resultado_json"])
                anterior = json.loads(snapshots[-1]["resultado_json"])
            numero = int(snapshots[-1]["numero_coleta"] + 1) if snapshots else 0
            self.repo.inserir_snapshot_resultado(
                contexto, tipo, numero, inicio_mes, agora, resultado,
                self._calcular_variacao(inicial, resultado, 0),
                self._calcular_variacao(anterior, resultado,
                                         numero - 1 if numero else 0),
            )
            snapshots = self.repo.listar_snapshots_resultado(
                campanha_id, str(cpf)
            )

        return {
            "id_campanha": campanha_id,
            "id_sessao": contexto.get("id_sessao"),
            "status": status,
            "snapshots": [
                {
                    "id": int(row["id"]),
                    "tipo": row["tipo_snapshot"],
                    "numero": int(row["numero_coleta"]),
                    "coletado_em": self._serializar_data(row["coletado_em"]),
                    "resultado": json.loads(row["resultado_json"]),
                    "variacao_inicial": json.loads(
                        row.get("variacao_inicial_json") or "{}"
                    ),
                    "variacao_anterior": json.loads(
                        row.get("variacao_anterior_json") or "{}"
                    ),
                }
                for row in snapshots
            ],
        }

    @staticmethod
    def _id_campanha(valor):
        try:
            return int(valor)
        except (TypeError, ValueError):
            raise ArenaServiceError("Campanha inválida.", 400)

    def obter_campanha(self, cpf, id_campanha):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        campanha = self.repo.obter_campanha_supervisor(campanha_id, str(cpf))
        if not campanha:
            raise ArenaServiceError("Campanha não encontrada.", 404)
        participantes = self.repo.listar_participantes_campanha(
            campanha_id,
            str(cpf),
        )
        return {
            **campanha,
            "participantes": [
                {
                    **participante,
                    "convite_enviado_em": self._serializar_data(
                        participante.get("convite_enviado_em")
                    ),
                    "convite_respondido_em": self._serializar_data(
                        participante.get("convite_respondido_em")
                    ),
                }
                for participante in participantes
            ],
        }

    def _normalizar_centros_publico(self, dados):
        centros = []
        for valor in dados.get("centros_custo") or []:
            centro = " ".join(str(valor or "").strip().split())
            if centro and self._normalizar(centro) not in {
                self._normalizar(item) for item in centros
            }:
                centros.append(centro)
        return centros

    def _resolver_participantes(self, dados):
        """Transforma centros, inclusões e exclusões na lista final ativa.

        Compartilhado entre montar o publico no wizard e incluir gente com a
        sala ja aberta — as duas telas oferecem a mesma escolha (centro de
        custo inteiro ou operador por nome), e a regra de quem existe e quem
        esta ativo precisa ser uma so.
        """
        centros = self._normalizar_centros_publico(dados)

        cpfs = []
        for valor in dados.get("cpfs") or []:
            cpf_operador = str(valor or "").strip()
            if cpf_operador and cpf_operador not in cpfs:
                cpfs.append(cpf_operador)

        cpfs_excluidos = {
            str(valor or "").strip()
            for valor in dados.get("cpfs_excluidos") or []
            if str(valor or "").strip()
        }

        operadores_lote = self.repo.listar_operadores_por_centros(centros)
        operadores_individuais = self.repo.listar_operadores_por_cpfs(cpfs)
        encontrados_individuais = {
            str(operador["cpf"]) for operador in operadores_individuais
        }
        cpfs_inexistentes = [
            cpf_item for cpf_item in cpfs
            if cpf_item not in encontrados_individuais
        ]
        if cpfs_inexistentes:
            raise ArenaServiceError(
                "Um ou mais operadores selecionados não estão ativos.",
                400,
            )

        participantes = {}
        for operador in operadores_lote:
            participantes[str(operador["cpf"])] = {
                **operador,
                "cpf": str(operador["cpf"]),
                "origem_selecao": "LOTE_CENTRO_CUSTO",
            }
        for operador in operadores_individuais:
            participantes[str(operador["cpf"])] = {
                **operador,
                "cpf": str(operador["cpf"]),
                "origem_selecao": "INDIVIDUAL",
            }
        for cpf_excluido in cpfs_excluidos:
            participantes.pop(cpf_excluido, None)
        if not participantes:
            raise ArenaServiceError(
                "Selecione ao menos um Centro de Custo ou operador.",
                400,
            )
        return list(participantes.values())

    def salvar_publico(self, cpf, id_campanha, dados):
        usuario = self._supervisor(cpf)
        carteira_nome = " ".join(
            str(usuario.get("centro_custo") or "").strip().split()
        )
        if not carteira_nome:
            raise ArenaServiceError(
                "O supervisor não possui uma carteira identificada.", 400
            )
        campanha_id = self._id_campanha(id_campanha)
        campanha = self.repo.obter_campanha_supervisor(campanha_id, str(cpf))
        if not campanha:
            raise ArenaServiceError("Campanha não encontrada.", 404)
        if campanha.get("status") != "RASCUNHO":
            raise ArenaServiceError(
                "O público só pode ser alterado enquanto a campanha é rascunho.",
                409,
            )

        centros = self._normalizar_centros_publico(dados)
        participantes = self._resolver_participantes(dados)

        try:
            quantidade = self.repo.salvar_publico(
                campanha_id,
                str(cpf),
                participantes,
            )
        except ValueError as erro:
            if str(erro) == "CAMPANHA_NAO_EDITAVEL":
                raise ArenaServiceError("A campanha não pode mais ser editada.", 409)
            raise
        id_equipe = self.repo.salvar_equipe_supervisor(
            str(cpf),
            usuario["nome"],
            carteira_nome,
            [
                {
                    "cpf": item["cpf"],
                    "nome": item["nome"],
                    "centro_custo": item.get("centro_custo"),
                }
                for item in participantes
            ],
        )
        return {
            "id_campanha": campanha_id,
            "participantes": quantidade,
            "centros_custo": centros,
            "id_equipe": id_equipe,
        }

    def publicar_campanha(self, cpf, id_campanha):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        try:
            quantidade = self.repo.publicar_campanha(
                campanha_id,
                str(cpf),
            )
        except ValueError as erro:
            mensagens = {
                "CAMPANHA_NAO_ENCONTRADA": ("Campanha não encontrada.", 404),
                "CAMPANHA_JA_PUBLICADA": (
                    "Esta campanha já foi publicada.",
                    409,
                ),
                "PUBLICO_VAZIO": (
                    "Adicione participantes antes de publicar.",
                    400,
                ),
                "JOGO_NAO_IMPLEMENTADO": (
                    "Este jogo ainda não está disponível para publicação.",
                    409,
                ),
                "QUIZ_INCOMPLETO": (
                    "Configure ao menos duas perguntas válidas antes de publicar.",
                    400,
                ),
                "BINGO_INCOMPLETO": (
                    "Configure as regras do Bingo antes de publicar.",
                    400,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return {
            "id_campanha": campanha_id,
            "status": "PUBLICADA",
            "convites_enviados": quantidade,
        }

    def obter_quiz(self, cpf, id_campanha):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        campanha = self.repo.obter_campanha_supervisor(campanha_id, str(cpf))
        if not campanha:
            raise ArenaServiceError("Campanha não encontrada.", 404)
        if campanha.get("tipo_jogo") != "QUIZ_AO_VIVO":
            raise ArenaServiceError("A campanha selecionada não é um Quiz.", 409)
        quiz = self.repo.obter_quiz_supervisor(campanha_id, str(cpf))
        return quiz or {
            "id": None,
            "id_campanha": campanha_id,
            "tempo_pergunta_segundos": 20,
            "pontos_acerto": 100,
            "bonus_velocidade_max": 50,
            "embaralhar_perguntas": False,
            "embaralhar_alternativas": True,
            "status": "RASCUNHO",
            "perguntas": [],
        }

    def obter_bingo(self, cpf, id_campanha):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        campanha = self.repo.obter_campanha_supervisor(campanha_id, str(cpf))
        if not campanha:
            raise ArenaServiceError("Campanha não encontrada.", 404)
        if campanha.get("tipo_jogo") != "BINGO":
            raise ArenaServiceError("A campanha selecionada não é um Bingo.", 409)
        config = self.repo.obter_bingo_supervisor(campanha_id, str(cpf))
        return config or {
            "id": None,
            "id_campanha": campanha_id,
            "padrao_vitoria": "LINHA",
            "casa_livre": True,
            "xp_participacao": 25,
            "xp_vitoria": 100,
            "status": "RASCUNHO",
        }

    def salvar_bingo(self, cpf, id_campanha, dados):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        campanha = self.repo.obter_campanha_supervisor(campanha_id, str(cpf))
        if not campanha:
            raise ArenaServiceError("Campanha não encontrada.", 404)
        if campanha.get("status") != "RASCUNHO":
            raise ArenaServiceError("O Bingo não pode mais ser alterado.", 409)
        if campanha.get("tipo_jogo") != "BINGO":
            raise ArenaServiceError("A campanha selecionada não é um Bingo.", 409)
        padrao = self._normalizar(dados.get("padrao_vitoria") or "LINHA")
        if padrao not in {"LINHA", "DUAS_LINHAS", "QUATRO_CANTOS", "CARTELA_CHEIA"}:
            raise ArenaServiceError("Padrão de vitória inválido.", 400)
        config = {
            "padrao_vitoria": padrao,
            "casa_livre": bool(dados.get("casa_livre", True)),
            "xp_participacao": self._inteiro_config(
                dados.get("xp_participacao", 25), "XP de participação", 0, 10000
            ),
            "xp_vitoria": self._inteiro_config(
                dados.get("xp_vitoria", 100), "XP de vitória", 0, 10000
            ),
        }
        try:
            self.repo.salvar_bingo_supervisor(
                campanha_id, str(cpf), config
            )
        except ValueError as erro:
            mensagens = {
                "CAMPANHA_NAO_ENCONTRADA": ("Campanha não encontrada.", 404),
                "CAMPANHA_NAO_EDITAVEL": ("O Bingo não pode mais ser alterado.", 409),
                "TIPO_JOGO_INVALIDO": ("A campanha não é um Bingo.", 409),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_bingo(cpf, campanha_id)

    def sortear_bingo(self, cpf, id_sessao):
        self._supervisor(cpf)
        try:
            sessao_id = int(id_sessao)
            self.repo.sortear_bingo(sessao_id, str(cpf))
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala de Bingo não encontrada.", 404),
                "SESSAO_NAO_ATIVA": ("O Bingo não está em andamento.", 409),
                "BINGO_PAUSADO": ("Retome o Bingo antes de sortear.", 409),
                "TODOS_NUMEROS_SORTEADOS": ("Todos os números já foram sorteados.", 409),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_bingo(cpf, sessao_id)

    def fechar_janela_bingo(self, id_sessao):
        """Encerra a coleta de bingos. Chamada pela tarefa de fundo."""
        return self.repo.fechar_janela_bingo(
            int(id_sessao),
            self.JANELA_DISPUTA_SEGUNDOS,
        )

    def listar_observatorio(self, cpf):
        """Tudo que está acontecendo agora, em qualquer equipe."""
        usuario = self._observador(cpf)
        centro = self._normalizar(usuario.get("centro_custo"))
        return {
            "pode_assumir": centro in self.ARENA_CENTROS_CONTROLE,
            "sessoes": [
                {
                    **row,
                    "aberta_em": self._serializar_data(row.get("aberta_em")),
                    "limite_entrada_em": self._serializar_data(
                        row.get("limite_entrada_em")
                    ),
                    "iniciada_em": self._serializar_data(
                        row.get("iniciada_em")
                    ),
                    "servidor_agora": self._serializar_data(
                        row.get("servidor_agora")
                    ),
                    "na_sala": int(row.get("na_sala") or 0),
                    "convidados": int(row.get("convidados") or 0),
                    "total_sorteios": int(row.get("total_sorteios") or 0),
                }
                for row in self.repo.listar_sessoes_ativas()
            ],
        }

    def listar_cartelas_observatorio(self, cpf, id_sessao):
        """As cartelas de todos — o estado do jogo só devolve a de quem pede."""
        self._observador(cpf)
        try:
            sessao_id = int(id_sessao)
        except (TypeError, ValueError):
            raise ArenaServiceError("Sala inválida.", 400)
        return {
            "id_sessao": sessao_id,
            "cartelas": self.repo.listar_cartelas_sessao(sessao_id),
        }

    def assumir_controle(self, cpf, id_sessao):
        """Passa a campanha para quem pediu.

        Trocar o dono, em vez de abrir exceção nas consultas escopadas por
        criador, deixa o controle explícito: o supervisor original vê que
        perdeu o comando, e fica registrado quem assumiu.
        """
        usuario = self._pode_assumir(cpf)
        try:
            sessao_id = int(id_sessao)
            resultado = self.repo.assumir_controle(
                sessao_id,
                str(cpf),
                usuario.get("nome"),
            )
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala não encontrada.", 404),
                "SESSAO_NAO_ATIVA": (
                    "Só dá para assumir uma partida em andamento.",
                    409,
                ),
                "JA_E_O_DONO": ("Você já conduz esta partida.", 409),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return {"id_sessao": sessao_id, **resultado, "assumido": True}

    def sortear_desempate_bingo(self, cpf, id_sessao):
        """Tira uma pedra para cada empatado; a maior leva a vitória."""
        self._supervisor(cpf)
        try:
            sessao_id = int(id_sessao)
            resultado = self.repo.sortear_desempate(sessao_id, str(cpf))
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala não encontrada.", 404),
                "SEM_EMPATE": (
                    "Não há empate para desempatar nesta rodada.",
                    409,
                ),
                "DESEMPATE_JA_SORTEADO": (
                    "As pedras desta rodada já foram sorteadas.",
                    409,
                ),
                "PEDRAS_INSUFICIENTES": (
                    "Não restam pedras suficientes para o desempate.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return {"id_sessao": sessao_id, "desempate": resultado}

    def controlar_bingo(self, cpf, id_sessao, dados):
        self._supervisor(cpf)
        try:
            sessao_id = int(id_sessao)
        except (TypeError, ValueError):
            raise ArenaServiceError("Sala inválida.", 400)
        acao = self._normalizar(dados.get("acao"))
        if acao not in {"PAUSAR", "RETOMAR", "CONTINUAR", "ENCERRAR"}:
            raise ArenaServiceError("Ação de controle inválida.", 400)
        try:
            if acao == "ENCERRAR":
                self.repo.encerrar_bingo(sessao_id, str(cpf))
            elif acao == "CONTINUAR":
                padrao = self._normalizar(dados.get("padrao_vitoria"))
                if padrao not in {
                    "LINHA", "DUAS_LINHAS", "QUATRO_CANTOS", "CARTELA_CHEIA"
                }:
                    raise ArenaServiceError(
                        "Selecione um padrão de vitória válido.", 400
                    )
                self.repo.continuar_bingo(sessao_id, str(cpf), padrao)
            else:
                self.repo.alterar_pausa_bingo(
                    sessao_id, str(cpf), acao == "PAUSAR"
                )
        except ValueError as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala de Bingo não encontrada.", 404),
                "SESSAO_NAO_ATIVA": ("O Bingo não está em andamento.", 409),
                "DECISAO_PENDENTE": (
                    "Escolha se deseja continuar ou encerrar a partida.", 409
                ),
                "DECISAO_NAO_PENDENTE": (
                    "Não existe uma vitória aguardando decisão.", 409
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_bingo(cpf, sessao_id)

    def listar_supervisores(self, cpf, busca, limite=20):
        self._supervisor(cpf)
        termo = " ".join(str(busca or "").strip().split())
        if len(termo) < 2:
            return []
        try:
            limite_normalizado = max(1, min(int(limite), 50))
        except (TypeError, ValueError):
            limite_normalizado = 20
        return self.repo.listar_supervisores(termo, limite_normalizado)

    def transferir_bingo(self, cpf, id_sessao, dados):
        self._supervisor(cpf)
        cpf_destino = "".join(
            caractere for caractere in str(dados.get("cpf_destino") or "")
            if caractere.isdigit()
        )
        if not cpf_destino:
            raise ArenaServiceError("Selecione o supervisor de destino.", 400)
        try:
            destino = self.repo.transferir_bingo(
                int(id_sessao), str(cpf), cpf_destino
            )
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala de Bingo não encontrada.", 404),
                "SESSAO_NAO_ATIVA": ("O Bingo não está em andamento.", 409),
                "SUPERVISOR_DESTINO_INVALIDO": (
                    "O responsável escolhido não é um supervisor ativo.", 400
                ),
                "MESMO_SUPERVISOR": (
                    "Escolha outro supervisor para receber o controle.", 400
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return {
            "transferida": True,
            "supervisor": destino,
            "id_sessao": int(id_sessao),
        }

    def gerar_sugestoes_quiz(self, cpf, id_campanha, dados):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        campanha = self.repo.obter_campanha_supervisor(campanha_id, str(cpf))
        if not campanha:
            raise ArenaServiceError("Campanha não encontrada.", 404)
        if campanha.get("status") != "RASCUNHO":
            raise ArenaServiceError(
                "Sugestões só podem ser geradas enquanto a campanha é rascunho.",
                409,
            )
        if campanha.get("tipo_jogo") != "QUIZ_AO_VIVO":
            raise ArenaServiceError("A campanha selecionada não é um Quiz.", 409)

        tema = " ".join(
            str(dados.get("tema") or "gatilhos de negociação em cobrança")
            .strip()
            .split()
        )
        contexto = " ".join(str(dados.get("contexto") or "").strip().split())
        dificuldade = self._normalizar(dados.get("dificuldade") or "INTERMEDIARIO")
        quantidade = self._inteiro_config(
            dados.get("quantidade", 10),
            "Quantidade de perguntas",
            1,
            10,
        )
        if len(tema) < 5 or len(tema) > 300:
            raise ArenaServiceError("O tema deve ter entre 5 e 300 caracteres.", 400)
        if len(contexto) > 2000:
            raise ArenaServiceError("O contexto deve ter no máximo 2000 caracteres.", 400)
        if dificuldade not in {"BASICO", "INTERMEDIARIO", "AVANCADO"}:
            raise ArenaServiceError("Dificuldade inválida.", 400)

        try:
            if self.quiz_ai_service is None:
                from src.application.services.arena_quiz_ai_service import (
                    ArenaQuizAIService,
                )
                self.quiz_ai_service = ArenaQuizAIService()
            perguntas = self.quiz_ai_service.gerar(
                tema,
                contexto,
                dificuldade,
                quantidade,
            )
        except ArenaServiceError:
            raise
        except Exception as erro:
            from src.application.services.arena_quiz_ai_service import ArenaQuizAIError
            if isinstance(erro, ArenaQuizAIError):
                raise ArenaServiceError(str(erro), erro.status) from erro
            raise

        return {
            "id_campanha": campanha_id,
            "tema": tema,
            "dificuldade": dificuldade,
            "aviso": "Sugestões geradas pela IA. Revise antes de adicionar ao Quiz.",
            "perguntas": perguntas,
        }

    @staticmethod
    def _inteiro_config(valor, nome, minimo, maximo):
        try:
            numero = int(valor)
        except (TypeError, ValueError):
            raise ArenaServiceError(f"{nome} inválido.", 400)
        if numero < minimo or numero > maximo:
            raise ArenaServiceError(
                f"{nome} deve estar entre {minimo} e {maximo}.",
                400,
            )
        return numero

    def salvar_quiz(self, cpf, id_campanha, dados):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        campanha = self.repo.obter_campanha_supervisor(campanha_id, str(cpf))
        if not campanha:
            raise ArenaServiceError("Campanha não encontrada.", 404)
        if campanha.get("status") != "RASCUNHO":
            raise ArenaServiceError(
                "O Quiz não pode ser alterado depois da publicação.",
                409,
            )
        if campanha.get("tipo_jogo") != "QUIZ_AO_VIVO":
            raise ArenaServiceError("A campanha selecionada não é um Quiz.", 409)

        perguntas_recebidas = dados.get("perguntas")
        if not isinstance(perguntas_recebidas, list):
            raise ArenaServiceError("A lista de perguntas é obrigatória.", 400)
        if len(perguntas_recebidas) < 2 or len(perguntas_recebidas) > 50:
            raise ArenaServiceError(
                "O Quiz deve possuir entre 2 e 50 perguntas.",
                400,
            )

        perguntas = []
        for indice, item in enumerate(perguntas_recebidas, start=1):
            enunciado = " ".join(str(item.get("enunciado") or "").strip().split())
            if len(enunciado) < 5 or len(enunciado) > 1000:
                raise ArenaServiceError(
                    f"A pergunta {indice} deve ter entre 5 e 1000 caracteres.",
                    400,
                )
            alternativas_recebidas = item.get("alternativas")
            if not isinstance(alternativas_recebidas, list) or not 2 <= len(alternativas_recebidas) <= 6:
                raise ArenaServiceError(
                    f"A pergunta {indice} deve ter entre 2 e 6 alternativas.",
                    400,
                )
            alternativas = []
            for alternativa in alternativas_recebidas:
                texto = " ".join(str(alternativa.get("texto") or "").strip().split())
                if not texto or len(texto) > 600:
                    raise ArenaServiceError(
                        f"A pergunta {indice} possui uma alternativa inválida.",
                        400,
                    )
                alternativas.append({
                    "texto": texto,
                    "correta": bool(alternativa.get("correta")),
                })
            if sum(1 for alternativa in alternativas if alternativa["correta"]) != 1:
                raise ArenaServiceError(
                    f"A pergunta {indice} deve possuir exatamente uma resposta correta.",
                    400,
                )
            tempo = item.get("tempo_segundos")
            explicacao = str(item.get("explicacao") or "").strip()
            if len(explicacao) > 1000:
                raise ArenaServiceError(
                    f"A explicação da pergunta {indice} deve ter até 1000 caracteres.",
                    400,
                )
            perguntas.append({
                "enunciado": enunciado,
                "explicacao": explicacao or None,
                "tempo_segundos": None if tempo in (None, "") else self._inteiro_config(
                    tempo,
                    f"Tempo da pergunta {indice}",
                    5,
                    120,
                ),
                "alternativas": alternativas,
            })

        config = {
            "tempo_pergunta_segundos": self._inteiro_config(
                dados.get("tempo_pergunta_segundos", 20),
                "Tempo padrão",
                5,
                120,
            ),
            "pontos_acerto": self._inteiro_config(
                dados.get("pontos_acerto", 100),
                "Pontuação por acerto",
                1,
                10000,
            ),
            "bonus_velocidade_max": self._inteiro_config(
                dados.get("bonus_velocidade_max", 50),
                "Bônus de velocidade",
                0,
                10000,
            ),
            "embaralhar_perguntas": bool(dados.get("embaralhar_perguntas")),
            "embaralhar_alternativas": bool(
                dados.get("embaralhar_alternativas", True)
            ),
        }
        try:
            self.repo.salvar_quiz_supervisor(
                campanha_id,
                str(cpf),
                config,
                perguntas,
            )
        except ValueError as erro:
            mensagens = {
                "CAMPANHA_NAO_ENCONTRADA": ("Campanha não encontrada.", 404),
                "CAMPANHA_NAO_EDITAVEL": (
                    "O Quiz não pode mais ser alterado.",
                    409,
                ),
                "TIPO_JOGO_INVALIDO": ("A campanha não é um Quiz.", 409),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_quiz(cpf, campanha_id)

    def abrir_sala(self, cpf, id_campanha):
        self._supervisor(cpf)
        campanha_id = self._id_campanha(id_campanha)
        try:
            id_sessao = self.repo.abrir_sala(campanha_id, str(cpf))
        except ValueError as erro:
            mensagens = {
                "CAMPANHA_NAO_ENCONTRADA": ("Campanha não encontrada.", 404),
                "CAMPANHA_NAO_PUBLICADA": (
                    "Publique a campanha antes de abrir a sala.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_sessao(cpf, id_sessao)

    def iniciar_sessao(self, cpf, id_sessao):
        self._supervisor(cpf)
        try:
            sessao_id = int(id_sessao)
            self.repo.iniciar_sessao(sessao_id, str(cpf))
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala não encontrada.", 404),
                "SESSAO_JA_INICIADA": ("A sessão já foi iniciada.", 409),
                "SALA_VAZIA": (
                    "Ninguém entrou na sala ainda. Espere pelo menos um "
                    "operador para começar.",
                    409,
                ),
                "QUIZ_SEM_PERGUNTAS": (
                    "O Quiz não possui perguntas prontas para iniciar.",
                    409,
                ),
                "BINGO_NAO_CONFIGURADO": (
                    "Configure o Bingo antes de iniciar.",
                    409,
                ),
                "TIPO_JOGO_INVALIDO": ("Modalidade de jogo inválida.", 409),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_sessao(cpf, sessao_id)

    def adicionar_participantes(self, cpf, id_sessao, dados):
        """Inclui operadores numa sala que ainda está em espera."""
        self._supervisor(cpf)
        participantes = self._resolver_participantes(dados or {})
        try:
            sessao_id = int(id_sessao)
            self.repo.adicionar_participantes(
                sessao_id,
                str(cpf),
                participantes,
            )
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala não encontrada.", 404),
                "SESSAO_JA_INICIADA": (
                    "A partida já começou; não dá mais para incluir gente.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return self.obter_estado_sessao(cpf, sessao_id)

    def fechar_sala(self, cpf, id_sessao):
        """Desiste da partida e devolve a campanha para PUBLICADA."""
        self._supervisor(cpf)
        try:
            sessao_id = int(id_sessao)
            id_campanha = self.repo.fechar_sala(sessao_id, str(cpf))
        except (TypeError, ValueError) as erro:
            mensagens = {
                "SESSAO_NAO_ENCONTRADA": ("Sala não encontrada.", 404),
                "SESSAO_JA_INICIADA": (
                    "A partida já começou; encerre pelo próprio jogo.",
                    409,
                ),
            }
            if str(erro) in mensagens:
                mensagem, status = mensagens[str(erro)]
                raise ArenaServiceError(mensagem, status)
            raise
        return {
            "id_sessao": sessao_id,
            "id_campanha": id_campanha,
            "fechada": True,
        }
