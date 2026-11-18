from datetime import date, datetime, timedelta
import json
import re

from src.infrastructure.repositories.sql_album_repository import AlbumRepository
from src.shared.utils.monitoria_permissoes import (
    cargo_base_e,
    normalizar_texto,
    possui_cargo,
)


RARIDADE_ALIAS = {
    "comum": "comum",
    "incomum": "incomum",
    "raro": "raro",
    "ultra raro": "ultra-raro",
    "ultra-raro": "ultra-raro",
    "epico": "epico",
    "épico": "epico",
    "lendario": "lendario",
    "lendário": "lendario",
    "boss": "boss",
}

CONQUISTAS_DEFINICOES = [
    {
        "id": "meta_1",
        "titulo": "Primeiro apito",
        "descricao": "Bata 1 meta no álbum.",
        "chave": "metas_batidas",
        "alvo": 1,
        "medalha": "bronze",
        "icone": "target",
    },
    {
        "id": "meta_5",
        "titulo": "Embalado",
        "descricao": "Bata 5 metas no histórico.",
        "chave": "metas_batidas",
        "alvo": 5,
        "medalha": "prata",
        "icone": "target",
    },
    {
        "id": "meta_10",
        "titulo": "Lenda das metas",
        "descricao": "Bata 10 metas no histórico.",
        "chave": "metas_batidas",
        "alvo": 10,
        "medalha": "ouro",
        "icone": "target",
    },
    {
        "id": "pacote_5",
        "titulo": "Abridor de pacotes",
        "descricao": "Abra 5 pacotes do álbum.",
        "chave": "pacotes_abertos",
        "alvo": 5,
        "medalha": "bronze",
        "icone": "package",
    },
    {
        "id": "pacote_20",
        "titulo": "Caçador de envelopes",
        "descricao": "Abra 20 pacotes do álbum.",
        "chave": "pacotes_abertos",
        "alvo": 20,
        "medalha": "ouro",
        "icone": "package",
    },
    {
        "id": "troca_1",
        "titulo": "Primeira troca",
        "descricao": "Conclua 1 troca de figurinhas.",
        "chave": "trocas_aceitas",
        "alvo": 1,
        "medalha": "bronze",
        "icone": "repeat",
    },
    {
        "id": "troca_5",
        "titulo": "Diplomata do álbum",
        "descricao": "Conclua 5 trocas de figurinhas.",
        "chave": "trocas_aceitas",
        "alvo": 5,
        "medalha": "prata",
        "icone": "repeat",
    },
    {
        "id": "lendaria_1",
        "titulo": "Luz dourada",
        "descricao": "Desbloqueie 1 carta lendária.",
        "chave": "lendarias",
        "alvo": 1,
        "medalha": "ouro",
        "icone": "gem",
    },
    {
        "id": "boss_1",
        "titulo": "Olho no boss",
        "descricao": "Desbloqueie 1 carta Boss.",
        "chave": "boss",
        "alvo": 1,
        "medalha": "diamante",
        "icone": "crown",
    },
    {
        "id": "elite_10",
        "titulo": "Coleção de elite",
        "descricao": "Desbloqueie 10 cartas raras ou superiores.",
        "chave": "raras_ou_superiores",
        "alvo": 10,
        "medalha": "prata",
        "icone": "sparkles",
    },
    {
        "id": "equipe_1",
        "titulo": "Time fechado",
        "descricao": "Complete 1 equipe inteira.",
        "chave": "equipes_completas",
        "alvo": 1,
        "medalha": "prata",
        "icone": "users",
    },
    {
        "id": "equipe_3",
        "titulo": "Colecionador de seleções",
        "descricao": "Complete 3 equipes inteiras.",
        "chave": "equipes_completas",
        "alvo": 3,
        "medalha": "ouro",
        "icone": "users",
    },
    {
        "id": "album_25",
        "titulo": "Álbum aquecido",
        "descricao": "Chegue a 25% do álbum completo.",
        "chave": "percentual_album",
        "alvo": 25,
        "medalha": "bronze",
        "icone": "album",
    },
    {
        "id": "album_50",
        "titulo": "Meio caminho",
        "descricao": "Chegue a 50% do álbum completo.",
        "chave": "percentual_album",
        "alvo": 50,
        "medalha": "prata",
        "icone": "album",
    },
    {
        "id": "album_100",
        "titulo": "Álbum lendário",
        "descricao": "Complete 100% do álbum.",
        "chave": "percentual_album",
        "alvo": 100,
        "medalha": "obsidiana",
        "icone": "trophy",
    },
]

AURORA_COINS_CONQUISTAS = {
    "meta_1": 10,
    "meta_5": 20,
    "meta_10": 35,
    "pacote_5": 10,
    "pacote_20": 35,
    "troca_1": 10,
    "troca_5": 20,
    "lendaria_1": 20,
    "boss_1": 35,
    "elite_10": 20,
    "equipe_1": 20,
    "equipe_3": 35,
    "album_25": 10,
    "album_50": 20,
    "album_100": 60,
}

AURORA_COINS_POR_EQUIPE_COMPLETA = 45
DUEL_META_MINIMA = 3
DUEL_META_MAXIMA = 10
DUEL_GROUP_META_MINIMA = 5
DUEL_GROUP_META_MAXIMA = 20
DUEL_TIME_MINIMO = 2
DUEL_TIME_MAXIMO = 5
DUEL_PREMIO_PACOTES = 2
DUEL_PREMIO_FIGURINHAS = 5
ALBUM_CHECKIN_NOME_PACOTE = "Presen\u00c3\u00a7a Di\u00c3\u00a1ria"
ALBUM_CHECKIN_PACOTES_DIARIOS = 5
ALBUM_CHECKIN_FIGURINHAS_POR_PACOTE = 3
ALBUM_MYSTERY_FIGURINHA_ID = 999
ALBUM_MYSTERY_REPETIDAS_CUSTO = 20
ALBUM_MYSTERY_RESGATES_LIMITE = 20
ALBUM_MYSTERY_NOME_PACOTE = "Pacote Misterioso Copa Acme 2026"
ALBUM_MYSTERY_CARGO_LIBERADO = "analista de desenvolvimento pl"
ALBUM_LEILAO_DURACAO_SEGUNDOS = 10 * 60
ALBUM_LEILAO_INCREMENTO_MINIMO = 1
ALBUM_VENDA_RAPIDA_LIMITE_DIARIO = 100
ALBUM_VENDA_RAPIDA_VALORES = {
    "comum": 1,
    "incomum": 2,
    "raro": 4,
    "ultra-raro": 8,
    "epico": 15,
    "lendario": 30,
    "boss": 60,
}
ALBUM_OLHEIRO_ATUALIZAR_CUSTO = 50
ALBUM_OLHEIRO_QTD_OFERTAS = 5
ALBUM_OLHEIRO_QTD_RETORNO = 11

ALBUM_OLHEIRO_TEMPOS = {
    "rapida": {"label": "30 min", "minutos": 30, "descricao": "Busca rapida"},
    "equilibrada": {"label": "1 hora", "minutos": 60, "descricao": "Busca equilibrada"},
    "profunda": {"label": "3 horas", "minutos": 180, "descricao": "Busca profunda"},
}

ALBUM_OLHEIRO_DESTINOS = {
    "estados_unidos": {"label": "Estados Unidos", "bonus": "Maior variedade"},
    "canada": {"label": "Canada", "bonus": "Chance equilibrada"},
    "mexico": {"label": "Mexico", "bonus": "Maior chance de epicas"},
}

ALBUM_EVENTOS_LEMBRETES_MEMORIA: set[tuple[str, str]] = set()
ALBUM_JANELAS_DISPONIVEIS = (
    (11, 0, 12, 0),
    (16, 0, 17, 0),
)

ALBUM_ADMIN_CARGOS = [
    "aprendiz - rh",
    "analista de ti jr",
    "assist de superv. control desk",
    "aprendiz ti",
    "zelador (a)",
    "analista seg informacao",
    "supervisor(a) de operacoes",
    "assistente de coordenacao",
    "supervisor(a) de qualidade",
    "coordenador(a) qualidade",
    "monitor de teleatendimento",
    "coordenador(a) de operacoes jr",
    "coordenador(a) de operacoes pl",
    "assistente de supervisao",
    "auxiliar administrativo",
    "auxiliar administrativo 1",
    "assistente administrativo",
    "instrutor de treinamento jr",
    "assistente de desenvolvimento",
    "gerente de operacoes jr",
    "gerente de operacoes jr i",
    "gerente de operacoes sr",
    "auxiliar financeiro",
    "analista seg info pl",
    "coordenador de dados",
    "analista de rh pl",
    "diretor(a)",
    "analista de sistemas pl",
    "back office 1 - 6 hrs",
    "back office 2",
    "gerente de ti",
    "superviosr control desk",
    "gerente juridico e compliance",
    "assistente de rh",
    "tecnico de manutencao predial1",
    "analista de mis pl",
    "gerente de qualidade",
    "psicologo",
    "analista de desenvolvimento pl",
    "supervisor(a) de suporte tec.",
    "tecnico de manutencao predial",
    "assistente de control desk",
    "analista de planejamento i",
    "autonomo",
    "porteiro",
    "analista financeiro jr",
    "analista de infraestrutura jr",
    "supervisor(a) de marketing",
    "analista de rec e selecao",
    "assistente de planejamento",
    "analista de sistemas jr",
    "assistente de marketing",
    "analista de rh sr",
    "motorista",
    "analista de mis jr",
    "assistente de ti",
    "analista contabil sr",
    "analista de control desk jr",
    "analista de marketing jr",
    "especialista em planejamento",
    "analista de planejamento jr",
    "analista de marketing pl",
    "analista de rh jr",
    "assistente de planejamento i",
    "assistente juridico",
    "analista de planejamento pl",
    "ANALISTA DE PLANEJAMENTO SR",
    "gerente de operacoes",
    "controlador de acesso",
    "especialista de recuperacao de",
    "estagiario",
    "analista de compliance",
    "socio gerente",
    "lider de servicos de limpeza",
    "copeiro(a)",
    "recepcionista",
    "gerente de rh",
    "supervisor(a) de operacoes i",
    "analista adm e financeiro",
    "advogado(a)",
    "auxiliar de limpeza",
    "analista de desenvolvimento jr",
    "analista de control desk pl",
    "analista seg informacao jr",
    "aprendiz omnichannel",
]

ALBUM_OPERADOR_CARGOS = [
    "aprendiz operador(a) cobrador",
    "operador(a) cobrador(a)",
    "negociador",
    "negociador |",
    "omnichannel",
    "estagiario",
]

AURORA_SHOP_OFFERS = [
    {
        "id": "pacote_unitario",
        "nome": "Pacote Unitário",
        "descricao": "1 pacote com 1 figurinha.",
        "custo_coins": 45,
        "qtd_pacotes": 1,
        "qtd_figurinhas_por_pacote": 1,
        "nivel": "Iniciante",
        "garantia": "1 figurinha incomum ou superior",
        "perfis_raridade": [
            {"min_raridade": "incomum", "qtd_garantidas": 1},
        ],
    },
    {
        "id": "pacote_basico",
        "nome": "Pacote Básico",
        "descricao": "1 pacote com 2 figurinhas.",
        "custo_coins": 80,
        "qtd_pacotes": 1,
        "qtd_figurinhas_por_pacote": 2,
        "nivel": "Operador",
        "garantia": "1 figurinha rara ou superior",
        "perfis_raridade": [
            {"min_raridade": "raro", "qtd_garantidas": 1},
        ],
    },
    {
        "id": "pacote_padrao",
        "nome": "Pacote Padrão",
        "descricao": "1 pacote com 3 figurinhas.",
        "custo_coins": 120,
        "qtd_pacotes": 1,
        "qtd_figurinhas_por_pacote": 3,
        "nivel": "Avançado",
        "garantia": "2 figurinhas raras ou superiores",
        "perfis_raridade": [
            {"min_raridade": "raro", "qtd_garantidas": 2},
        ],
    },
    {
        "id": "pacote_premium",
        "nome": "Pacote Premium",
        "descricao": "2 pacotes com 4 figurinhas cada.",
        "custo_coins": 280,
        "qtd_pacotes": 2,
        "qtd_figurinhas_por_pacote": 4,
        "nivel": "Elite",
        "garantia": "1 pacote raro+ e 1 ultra-rara+ no segundo pacote",
        "perfis_raridade": [
            {"min_raridade": "raro", "qtd_garantidas": 4},
            {"min_raridade": "ultra-raro", "qtd_garantidas": 1},
        ],
    },
    {
        "id": "pacote_lendario",
        "nome": "Pacote Lendário",
        "descricao": "3 pacotes com 5 figurinhas cada.",
        "custo_coins": 460,
        "qtd_pacotes": 3,
        "qtd_figurinhas_por_pacote": 5,
        "nivel": "Máximo",
        "garantia": "1 pacote com 5 ultra-raras ou superiores",
        "perfis_raridade": [
            {"min_raridade": "ultra-raro", "qtd_garantidas": 5},
            {"min_raridade": "raro", "qtd_garantidas": 5},
            {"min_raridade": "raro", "qtd_garantidas": 5},
        ],
    },
]


class AlbumService:
    def __init__(self):
        self.repo = AlbumRepository()

    def _usuario_modo_admin_album(self, usuario: dict | None) -> bool:
        funcao = normalizar_texto((usuario or {}).get("FUNCAO_COLABORADOR"))
        centro_custo = normalizar_texto((usuario or {}).get("CENTRO_CUSTO"))
        if possui_cargo(funcao, ALBUM_OPERADOR_CARGOS):
            return False
        return possui_cargo(funcao, ALBUM_ADMIN_CARGOS) or "qualidade" in centro_custo

    def _usuario_eh_operador_album(self, usuario: dict | None) -> bool:
        funcao = normalizar_texto((usuario or {}).get("FUNCAO_COLABORADOR"))
        return possui_cargo(funcao, ALBUM_OPERADOR_CARGOS)

    def _usuario_pode_resgatar_pacote_misterioso(self, usuario: dict | None) -> bool:
        funcao = (usuario or {}).get("FUNCAO_COLABORADOR")
        # Prefixo, nao igualdade: FUNCAO_COLABORADOR carrega o nivel junto do
        # cargo em varios registros ("... PL I"), e o `!=` liberava justamente
        # quem esta na lista de excecao.
        return (
            not self._usuario_modo_admin_album(usuario)
            and not cargo_base_e(funcao, ALBUM_MYSTERY_CARGO_LIBERADO)
        )

    def obter_disponibilidade_album(self, agora: datetime | None = None):
        referencia = agora or datetime.now()
        hoje = referencia.date()
        janelas = []
        disponivel = False
        fechamento_atual = None
        proxima_abertura = None

        for inicio_hora, inicio_minuto, fim_hora, fim_minuto in ALBUM_JANELAS_DISPONIVEIS:
            inicio = datetime.combine(hoje, datetime.min.time()).replace(
                hour=inicio_hora,
                minute=inicio_minuto,
            )
            fim = datetime.combine(hoje, datetime.min.time()).replace(
                hour=fim_hora,
                minute=fim_minuto,
            )
            janelas.append({"inicio": inicio.strftime("%H:%M"), "fim": fim.strftime("%H:%M")})

            if inicio <= referencia < fim:
                disponivel = True
                fechamento_atual = fim
            elif referencia < inicio and proxima_abertura is None:
                proxima_abertura = inicio

        if proxima_abertura is None and not disponivel:
            primeira = ALBUM_JANELAS_DISPONIVEIS[0]
            proxima_abertura = datetime.combine(hoje + timedelta(days=1), datetime.min.time()).replace(
                hour=primeira[0],
                minute=primeira[1],
            )

        return {
            "disponivel": disponivel,
            "agora": referencia.isoformat(),
            "janelas": janelas,
            "fechamento_atual": fechamento_atual.isoformat() if fechamento_atual else None,
            "proxima_abertura": proxima_abertura.isoformat() if proxima_abertura else None,
            "mensagem": (
                "Album disponivel agora."
                if disponivel
                else "O album fica disponivel das 11:00 as 12:00 e das 16:00 as 17:00."
            ),
        }

    def album_disponivel_agora(self) -> bool:
        return bool(self.obter_disponibilidade_album()["disponivel"])

    def _usuario_pode_criar_evento_album(self, usuario: dict | None) -> bool:
        centro_custo = normalizar_texto((usuario or {}).get("CENTRO_CUSTO"))
        return "desenvolvimento" in centro_custo

    def _garantir_estrutura_meta_copa(self):
        faltantes = self.repo.listar_objetos_meta_copa_faltantes()
        if faltantes:
            raise RuntimeError(
                "Estrutura de metas da Copa não encontrada no banco: "
                + ", ".join(faltantes)
                + ". Execute o script backend/sql/album_meta_copa.sql."
            )

    def _normalizar_raridade(self, valor: str | None) -> str:
        chave = str(valor or "").strip().lower()
        return RARIDADE_ALIAS.get(chave, "comum")

    def _normalizar_frequencia(self, valor: str | None) -> str:
        mapa = {
            "DIARIA": "Diária",
            "DIÁRIA": "Diária",
            "SEMANAL": "Semanal",
            "MENSAL": "Mensal",
        }
        return mapa.get(str(valor or "").strip().upper(), str(valor or "").title())

    def _normalizar_frequencia_config(self, valor: str | None) -> str:
        normalizado = str(valor or "DIARIA").strip().upper()
        if normalizado in {"DIARIA", "DIÁRIA", "SEMANAL", "MENSAL"}:
            return "DIARIA" if normalizado == "DIÁRIA" else normalizado
        return "DIARIA"

    def _to_bool(self, valor) -> bool:
        if isinstance(valor, bool):
            return valor
        if isinstance(valor, (int, float)):
            return valor != 0
        return str(valor or "").strip().lower() in {"1", "true", "sim", "yes", "on"}

    def _to_int(self, valor, padrao: int = 0) -> int:
        try:
            return int(valor)
        except (TypeError, ValueError):
            return padrao

    def _to_float(self, valor, padrao: float = 0.0) -> float:
        try:
            return float(valor)
        except (TypeError, ValueError):
            return padrao

    def _to_iso(self, valor):
        if hasattr(valor, "isoformat"):
            return valor.isoformat()
        return None

    def _status_evento_album(self, evento: dict, agora: datetime | None = None) -> str:
        referencia = agora or datetime.now()
        if referencia < evento["inicio"]:
            return "upcoming"
        if referencia > evento["fim"]:
            return "finished"
        return "live"

    def _eventos_album_db_ou_config(self):
        if self.repo.eventos_album_habilitados():
            rows = self.repo.listar_eventos_album()
            eventos = []
            for row in rows:
                try:
                    detalhes = json.loads(row.get("DETALHES_JSON") or "[]")
                except (TypeError, ValueError):
                    detalhes = []
                try:
                    premio_config = json.loads(row.get("PREMIO_CONFIG_JSON") or "{}")
                except (TypeError, ValueError):
                    premio_config = {}

                eventos.append(
                    {
                        "id": str(row.get("ID_EVENTO")),
                        "type": row.get("TP_EVENTO") or "penalty",
                        "titulo": row.get("TITULO") or "Evento do album",
                        "destaque": row.get("DESTAQUE") or row.get("TITULO") or "Evento",
                        "descricao": row.get("DESCRICAO") or "",
                        "detalhes": detalhes if isinstance(detalhes, list) else [],
                        "inicio": row.get("DT_INICIO"),
                        "fim": row.get("DT_FIM"),
                        "premio": row.get("PREMIO") or "Premio especial",
                        "premio_config": premio_config if isinstance(premio_config, dict) else {},
                        "participantes_premiados": self._to_int(row.get("PARTICIPANTES_PREMIADOS"), 50),
                        "cor": row.get("COR") or "gold",
                        "url_imagem_hero": row.get("URL_IMAGEM_HERO"),
                        "url_imagem_card": row.get("URL_IMAGEM_CARD"),
                    }
                )
            return eventos

        return []

    def _mapear_evento_album(self, evento: dict, lembretes: set[str], agora: datetime | None = None):
        return {
            "id": evento["id"],
            "type": evento["type"],
            "titulo": evento["titulo"],
            "destaque": evento["destaque"],
            "descricao": evento["descricao"],
            "detalhes": evento["detalhes"],
            "inicio": evento["inicio"].isoformat(),
            "fim": evento["fim"].isoformat(),
            "premio": evento["premio"],
            "premio_config": evento.get("premio_config"),
            "participantes_premiados": evento["participantes_premiados"],
            "cor": evento["cor"],
            "url_imagem_hero": evento.get("url_imagem_hero"),
            "url_imagem_card": evento.get("url_imagem_card"),
            "status": self._status_evento_album(evento, agora),
            "lembrete_ativo": evento["id"] in lembretes,
        }

    def _normalizar_premio_evento(self, data: dict):
        config = data.get("premio_config") if isinstance(data.get("premio_config"), dict) else {}
        coins = self._to_int(config.get("coins", data.get("coins")), 0)
        qtd_pacotes = self._to_int(config.get("qtd_pacotes", data.get("qtd_pacotes")), 0)
        qtd_figurinhas = self._to_int(
            config.get("qtd_figurinhas_por_pacote", data.get("qtd_figurinhas_por_pacote")),
            5,
        )
        if coins < 0 or coins > 300:
            raise ValueError("A premiacao em coins deve ser entre 0 e 300")
        if qtd_pacotes < 0 or qtd_pacotes > 3:
            raise ValueError("A premiacao em pacotes deve ser entre 0 e 3")
        if qtd_figurinhas < 1 or qtd_figurinhas > 5:
            raise ValueError("Cada pacote pode ter entre 1 e 5 figurinhas")
        id_figurinha = config.get("id_figurinha", data.get("id_figurinha"))
        id_figurinha = str(id_figurinha).strip() if id_figurinha not in {None, ""} else None

        if coins <= 0 and qtd_pacotes <= 0 and not id_figurinha:
            raise ValueError("Escolha pelo menos um premio para o evento")
        if id_figurinha and not self.repo.figurinha_album_existe(id_figurinha):
            raise ValueError("Figurinha de premio nao encontrada")

        partes = []
        if coins > 0:
            partes.append(f"{coins} Aurora Coins")
        if qtd_pacotes > 0:
            partes.append(f"{qtd_pacotes} pacote{'s' if qtd_pacotes != 1 else ''} com {qtd_figurinhas} figurinha{'s' if qtd_figurinhas != 1 else ''}")
        if id_figurinha:
            partes.append("figurinha especifica")

        return {
            "texto": " + ".join(partes),
            "config": {
                "coins": coins,
                "qtd_pacotes": qtd_pacotes,
                "qtd_figurinhas_por_pacote": qtd_figurinhas,
                "id_figurinha": id_figurinha,
            },
        }

    def _tempo_relativo_evento(self, valor) -> str:
        if not hasattr(valor, "replace"):
            return "Agora"
        diff = max(0, int((datetime.now() - valor).total_seconds()))
        if diff < 60:
            return "Agora"
        minutos = diff // 60
        if minutos < 60:
            return f"Ha {minutos} min"
        horas = minutos // 60
        if horas < 24:
            return f"Ha {horas} h"
        return f"Ha {horas // 24} d"

    def _eventos_album_ultimos_ganhadores(self):
        if self.repo.eventos_album_habilitados():
            rows = self.repo.listar_ultimos_ganhadores_eventos_album(5)
            return [
                {
                    "posicao": self._to_int(row.get("POSICAO"), index + 1),
                    "nome": row.get("NM_USUARIO") or "Operador",
                    "area": row.get("AREA") or "Operacao",
                    "premio": row.get("PREMIO") or "Premio especial",
                    "tone": row.get("COR") or "gold",
                }
                for index, row in enumerate(rows)
            ]

        return []

    def _eventos_album_movimentos_recentes(self):
        if self.repo.eventos_album_habilitados():
            rows = self.repo.listar_movimentos_recentes_eventos_album(4)
            return [
                {
                    "nome": row.get("NM_USUARIO") or "Operador",
                    "texto": f"fez {self._to_int(row.get('PONTOS'), 0)} pontos e ganhou {row.get('PREMIO') or 'premio especial'}",
                    "evento": row.get("TITULO") or "Evento do album",
                    "tempo": self._tempo_relativo_evento(row.get("DT_FIM")),
                    "tone": row.get("COR") or "gold",
                }
                for row in rows
            ]

        return []

    def _apurar_eventos_album_encerrados(self):
        if not self.repo.eventos_album_habilitados():
            return

        for row in self.repo.listar_eventos_encerrados_pendentes_apuracao():
            id_evento = row.get("ID_EVENTO")
            if id_evento:
                try:
                    self.repo.apurar_premios_evento_album(str(id_evento))
                except Exception:
                    # A falha de entrega nao deve impedir a tela de eventos ou o registro do resultado.
                    # A apuracao e idempotente e sera tentada novamente no proximo carregamento.
                    continue

    def _formatar_numero_feed(self, valor) -> str:
        numero = self._to_float(valor, 0)
        if float(numero).is_integer():
            return str(int(numero))
        return f"{numero:.2f}".rstrip("0").rstrip(".").replace(".", ",")

    def _label_raridade(self, valor: str | None) -> str:
        raridade = self._normalizar_raridade(valor)
        labels = {
            "comum": "Comum",
            "incomum": "Incomum",
            "raro": "Rara",
            "ultra-raro": "Ultra rara",
            "epico": "Épica",
            "lendario": "Lendária",
            "boss": "Boss",
        }
        return labels.get(raridade, "Especial")

    def _inicio_semana(self, referencia: date) -> date:
        return referencia - timedelta(days=referencia.weekday())

    def _fim_semana(self, referencia: date) -> date:
        return self._inicio_semana(referencia) + timedelta(days=6)

    def _intervalo_meta(self, frequencia: str | None, referencia: date | None = None):
        data_referencia = referencia or date.today()
        frequencia_normalizada = self._normalizar_frequencia_config(frequencia)

        if frequencia_normalizada == "MENSAL":
            inicio = data_referencia.replace(day=1)
            if inicio.month == 12:
                proximo_mes = inicio.replace(year=inicio.year + 1, month=1, day=1)
            else:
                proximo_mes = inicio.replace(month=inicio.month + 1, day=1)
            fim = proximo_mes - timedelta(days=1)
            return inicio, fim

        if frequencia_normalizada == "SEMANAL":
            inicio = self._inicio_semana(data_referencia)
            fim = self._fim_semana(data_referencia)
            return inicio, fim

        return data_referencia, data_referencia

    def _codigo_meta_normalizado(self, row: dict) -> str:
        return str(
            row.get("TP_META")
            or row.get("CD_META_TIPO")
            or row.get("codigo")
            or ""
        ).strip().upper()

    def _centro_custo_normalizado(self, valor: str | None) -> str:
        return str(valor or "").strip().upper()

    def _operador_no_mesmo_centro_custo(
        self,
        supervisor: dict | None,
        operador: dict | None,
    ) -> bool:
        return self._centro_custo_normalizado((supervisor or {}).get("CENTRO_CUSTO")) == self._centro_custo_normalizado(
            (operador or {}).get("CENTRO_CUSTO")
        )

    def _operador_usa_resultado_vega(self, usuario: dict | None) -> bool:
        return "VEGA" in self._centro_custo_normalizado((usuario or {}).get("CENTRO_CUSTO"))

    def _duelo_configuracao_operador(self, usuario: dict | None):
        if self._operador_usa_resultado_vega(usuario):
            return {
                "codigo": "PP",
                "label": "PP",
                "descricao": "promessas de pagamento",
            }
        return {
            "codigo": "ACORDOS",
            "label": "Acordos",
            "descricao": "acordos",
        }

    def _meta_equivalente_vega(self, codigo: str) -> str:
        if codigo in {"ACORDOS", "NUMERO_ACORDOS", "NÚMERO_ACORDOS", "PP", "PROMESSAS_PAGAMENTO"}:
            return "PP"
        if codigo in {"VALOR_RECEBIDO", "VALOR_ACORDOS", "VALOR_ACORDO", "VALOR_RECUPERADO", "VL_ARRECADADO"}:
            return "VALOR_RECUPERADO"
        if codigo in {"TEMPO_LOGADO", "LOGADO_SEC", "LOGADO_NR", "TEMPO_LOGADO_HORAS"}:
            return "TEMPO_LOGADO"
        return codigo

    def _meta_nativa_vega(self, row: dict) -> bool:
        codigo = self._codigo_meta_normalizado(row)
        return codigo in {
            "PP",
            "PROMESSAS_PAGAMENTO",
            "VALOR_RECUPERADO",
            "VL_ARRECADADO",
            "TEMPO_LOGADO",
            "LOGADO_SEC",
            "LOGADO_NR",
            "TEMPO_LOGADO_HORAS",
        }

    def _meta_usa_producao_copilot(self, row: dict) -> bool:
        codigo = self._codigo_meta_normalizado(row)
        return codigo in {
            "ACORDOS",
            "NUMERO_ACORDOS",
            "NÚMERO_ACORDOS",
            "VALOR_RECEBIDO",
            "VALOR_ACORDOS",
            "VALOR_ACORDO",
        }

    def _meta_usa_resultado_vega(self, row: dict) -> bool:
        codigo = self._meta_equivalente_vega(self._codigo_meta_normalizado(row))
        return codigo in {"PP", "VALOR_RECUPERADO", "TEMPO_LOGADO"}

    def _apurar_meta_por_producao(
        self,
        row: dict,
        producao_rows: list[dict],
        referencia: date | None = None,
    ):
        inicio, fim = self._intervalo_meta(row.get("FREQUENCIA"), referencia)
        registros_periodo = []

        for registro in producao_rows:
            data_acordo = registro.get("DATA_ACORDO")
            if isinstance(data_acordo, datetime):
                data_base = data_acordo.date()
            else:
                data_base = data_acordo

            if isinstance(data_base, date) and inicio <= data_base <= fim:
                registros_periodo.append(registro)

        codigo = self._codigo_meta_normalizado(row)
        atual = self._to_float(row.get("VL_APURADO"), 0)

        if codigo in {"ACORDOS", "NUMERO_ACORDOS", "NÚMERO_ACORDOS"}:
            atual = float(
                len(
                    {
                        str(registro.get("ID_ACORDO"))
                        for registro in registros_periodo
                        if registro.get("ID_ACORDO") is not None
                    }
                )
            )
        elif codigo in {"VALOR_RECEBIDO", "VALOR_ACORDOS", "VALOR_ACORDO"}:
            atual = round(
                sum(self._to_float(registro.get("VL_ACORDO"), 0) for registro in registros_periodo),
                2,
            )

        alvo = self._to_float(row.get("VL_ALVO"), 0)
        regra = str(row.get("REGRA_COMPARACAO") or ">=").strip()

        if regra == "<=":
            bateu = alvo > 0 and atual <= alvo
        else:
            bateu = atual >= alvo if alvo > 0 else False

        return {
            **row,
            "VL_APURADO": atual,
            "FL_BATEU_META": 1 if bateu else 0,
            "DT_REFERENCIA_INICIO": inicio,
            "DT_REFERENCIA_FIM": fim,
            "DT_APURACAO": datetime.now(),
        }

    def _apurar_meta_por_resultado_vega(
        self,
        row: dict,
        resultados_rows: list[dict],
        referencia: date | None = None,
    ):
        inicio, fim = self._intervalo_meta(row.get("FREQUENCIA"), referencia)
        registros_periodo = [
            registro
            for registro in resultados_rows
            if isinstance(registro.get("DATA_REFERENCIA"), date)
            and inicio <= registro.get("DATA_REFERENCIA") <= fim
        ]
        codigo = self._meta_equivalente_vega(self._codigo_meta_normalizado(row))
        atual = self._to_float(row.get("VL_APURADO"), 0)

        if codigo == "PP":
            atual = float(sum(int(registro.get("QTD_PP") or 0) for registro in registros_periodo))
        elif codigo == "VALOR_RECUPERADO":
            atual = round(
                sum(self._to_float(registro.get("VL_RECUPERADO"), 0) for registro in registros_periodo),
                2,
            )
        elif codigo == "TEMPO_LOGADO":
            unidade = str(row.get("UNIDADE") or "").strip().lower()
            total_segundos = sum(int(registro.get("LOGADO_SEGUNDOS") or 0) for registro in registros_periodo)
            atual = float(total_segundos) if "seg" in unidade else round(total_segundos / 3600, 2)

        alvo = self._to_float(row.get("VL_ALVO"), 0)
        regra = str(row.get("REGRA_COMPARACAO") or ">=").strip()
        bateu = alvo > 0 and (atual <= alvo if regra == "<=" else atual >= alvo)

        return {
            **row,
            "VL_APURADO": atual,
            "FL_BATEU_META": 1 if bateu else 0,
            "DT_REFERENCIA_INICIO": inicio,
            "DT_REFERENCIA_FIM": fim,
            "DT_APURACAO": datetime.now(),
        }

    def _apurar_metas_usuario(self, usuario: dict, metas_rows: list[dict]):
        cpf_colaborador = str(usuario.get("CPF_COLABORADOR") or usuario.get("ID_USUARIO") or "")
        metas_que_usam_producao = [
            row
            for row in metas_rows
            if (
                self._meta_usa_resultado_vega(row)
                if self._operador_usa_resultado_vega(usuario)
                else self._meta_usa_producao_copilot(row)
            )
        ]

        if not metas_que_usam_producao:
            return metas_rows

        hoje = date.today()
        datas_inicio = [self._intervalo_meta(row.get("FREQUENCIA"), hoje)[0] for row in metas_que_usam_producao]
        data_inicio = min(datas_inicio) if datas_inicio else hoje
        data_fim = hoje

        if self._operador_usa_resultado_vega(usuario):
            producao_rows = self.repo.listar_resultados_vega_periodo(
                cpf_colaborador,
                data_inicio,
                data_fim,
                usuario.get("NM_COLABORADOR"),
            )
        else:
            producao_rows = self.repo.listar_producao_usuario_periodo(
                cpf_colaborador,
                data_inicio,
                data_fim,
                usuario.get("NM_COLABORADOR"),
            )

        metas_apuradas = []
        for row in metas_rows:
            if self._operador_usa_resultado_vega(usuario) and self._meta_usa_resultado_vega(row):
                metas_apuradas.append(self._apurar_meta_por_resultado_vega(row, producao_rows, hoje))
            elif self._meta_usa_producao_copilot(row):
                metas_apuradas.append(self._apurar_meta_por_producao(row, producao_rows, hoje))
            else:
                metas_apuradas.append(row)

        return metas_apuradas

    def _mapear_tipo_meta(self, row: dict):
        return {
            "id": str(row["ID_META_TIPO"]),
            "codigo": row.get("CD_META_TIPO") or "",
            "nome": row.get("NM_META") or "",
            "descricao": row.get("DS_META") or "",
            "unidade": row.get("UNIDADE") or "",
            "regra_comparacao": row.get("REGRA_COMPARACAO") or ">=",
            "frequencia_padrao": self._normalizar_frequencia_config(row.get("FREQUENCIA_PADRAO")),
            "valor_alvo_padrao": float(row.get("VL_ALVO_PADRAO") or 0),
            "qtd_pacotes_padrao": int(row.get("QTD_PACOTES_PADRAO") or 0),
            "qtd_figurinhas_por_pacote_padrao": int(
                row.get("QTD_FIGURINHAS_POR_PACOTE_PADRAO") or 0
            ),
            "ordem_exibicao": int(row.get("ORDEM_EXIBICAO") or 0),
            "ativa": bool(row.get("FL_ATIVA")),
        }

    def _mapear_config_meta(self, row: dict):
        return {
            "id_meta_tipo": str(row["ID_META_TIPO"]),
            "codigo": row.get("CD_META_TIPO") or "",
            "nome": row.get("NM_META") or "",
            "descricao": row.get("DS_META") or "",
            "unidade": row.get("UNIDADE") or "",
            "regra_comparacao": row.get("REGRA_COMPARACAO") or ">=",
            "ativa": bool(row.get("FL_ATIVA")),
            "valor_alvo": float(row.get("VL_ALVO") or 0),
            "frequencia": self._normalizar_frequencia_config(row.get("FREQUENCIA")),
            "qtd_pacotes": int(row.get("QTD_PACOTES") or 0),
            "qtd_figurinhas_por_pacote": int(row.get("QTD_FIGURINHAS_POR_PACOTE") or 0),
            "ordem_exibicao": int(row.get("ORDEM_EXIBICAO") or 0),
            "cpf_supervisor_alteracao": row.get("CPF_SUPERVISOR_ALTERACAO"),
            "dt_atualizacao": row.get("DT_ATUALIZACAO").isoformat()
            if row.get("DT_ATUALIZACAO")
            else None,
        }

    def _meta_disponivel_para_operador(self, row: dict, operador: dict | None) -> bool:
        if self._operador_usa_resultado_vega(operador):
            return self._meta_nativa_vega(row)

        codigo = self._codigo_meta_normalizado(row)

        return codigo not in {
            "PP",
            "PROMESSAS_PAGAMENTO",
            "VALOR_RECUPERADO",
            "VL_ARRECADADO",
            "TEMPO_LOGADO",
            "LOGADO_SEC",
            "LOGADO_NR",
            "TEMPO_LOGADO_HORAS",
        }

    def _ajustar_meta_contexto_supervisor(self, operador: dict | None, meta: dict):
        if not self._operador_usa_resultado_vega(operador):
            return meta

        ajustada = dict(meta)
        codigo = self._meta_equivalente_vega(self._codigo_meta_normalizado(meta))
        nome = str(ajustada.get("nome") or ajustada.get("NM_META") or "").strip()

        if codigo == "PP":
            ajustada["codigo"] = "PP"
            ajustada["nome"] = "Meta de PP" if not nome or "acordo" in nome.lower() else nome
            ajustada["unidade"] = "PP"
        elif codigo == "VALOR_RECUPERADO":
            ajustada["codigo"] = "VALOR_RECUPERADO"
            ajustada["nome"] = (
                "Valor recuperado"
                if not nome or "acordo" in nome.lower() or "recebido" in nome.lower()
                else nome
            )
            ajustada["unidade"] = ajustada.get("unidade") or "R$"
        elif codigo == "TEMPO_LOGADO":
            ajustada["codigo"] = "TEMPO_LOGADO"
            ajustada["nome"] = "Tempo logado" if not nome else nome
            ajustada["unidade"] = "h"

        return ajustada

    def _montar_contexto_meta_operador(self, operador: dict | None):
        if self._operador_usa_resultado_vega(operador):
            return {
                "tipo": "VEGA",
                "titulo": "Metas do operador Vega",
                "descricao": "Use PP, valor recuperado e tempo logado para operadores do centro de custo Vega.",
            }

        return {
            "tipo": "PADRAO",
            "titulo": "Metas do operador",
            "descricao": "Use metas baseadas em acordos e valor recebido para os demais operadores.",
        }

    def _deduplicar_metas_configuracao(self, metas: list[dict], operador: dict | None = None):
        unicas: dict[tuple[str, str], dict] = {}

        for meta in sorted(
            metas,
            key=lambda item: (
                int(item.get("ordem_exibicao") or 0),
                str(item.get("id") or item.get("id_meta_tipo") or ""),
            ),
        ):
            codigo = self._codigo_meta_normalizado(meta)
            frequencia = self._normalizar_frequencia_config(
                meta.get("frequencia") or meta.get("frequencia_padrao"),
            )
            chave = (codigo, frequencia)
            if chave in unicas:
                continue

            ajustada = (
                self._ajustar_meta_contexto_supervisor(operador, meta)
                if operador is not None
                else dict(meta)
            )
            unicas[chave] = ajustada

        return list(unicas.values())

    def _mapear_campanha(self, row: dict):
        return {
            "id": str(row["ID_CAMPANHA_PREMIO"]),
            "nome": row.get("NM_CAMPANHA") or "",
            "supervisor": {
                "cpf": row.get("CPF_SUPERVISOR"),
            },
            "operador": {
                "cpf": row.get("CPF_COLABORADOR"),
                "nome": row.get("NM_COLABORADOR") or "",
                "carteira": row.get("CENTRO_CUSTO") or "",
            },
            "qtd_pacotes": int(row.get("QTD_PACOTES") or 0),
            "qtd_figurinhas_por_pacote": int(row.get("QTD_FIGURINHAS_POR_PACOTE") or 0),
            "dt_cadastro": row.get("DT_CADASTRO").isoformat()
            if row.get("DT_CADASTRO")
            else None,
        }

    def _validar_payload_meta(
        self,
        metas: list[dict],
        tipos_meta: list[dict],
        permitir_lista_vazia: bool = False,
    ):
        if not isinstance(metas, list):
            raise ValueError("Payload de metas inválido")

        if not metas and not permitir_lista_vazia:
            raise ValueError("Nenhuma meta enviada")

        tipos_por_id = {
            str(tipo["ID_META_TIPO"]): self._mapear_tipo_meta(tipo)
            for tipo in tipos_meta
        }
        normalizadas = []
        for meta in metas:
            id_meta_tipo = str(meta.get("id_meta_tipo") or "").strip()
            if not id_meta_tipo:
                raise ValueError("Cada meta precisa informar id_meta_tipo")

            tipo = tipos_por_id.get(id_meta_tipo)
            if not tipo:
                raise ValueError("Meta informada não existe em album.TB_ALBUM_META")

            ativa = self._to_bool(meta.get("ativa"))
            valor_alvo = self._to_float(meta.get("valor_alvo"), 0)
            qtd_pacotes = self._to_int(tipo.get("qtd_pacotes_padrao"), 0)
            qtd_figurinhas = self._to_int(
                tipo.get("qtd_figurinhas_por_pacote_padrao"),
                0,
            )
            ordem = self._to_int(meta.get("ordem_exibicao"), 0)
            frequencia = self._normalizar_frequencia_config(meta.get("frequencia"))

            if ativa and valor_alvo <= 0:
                raise ValueError("Metas ativas precisam ter valor alvo maior que zero")

            if ativa and qtd_pacotes <= 0:
                raise ValueError("Metas ativas precisam ter ao menos um pacote")

            if ativa and qtd_figurinhas <= 0:
                raise ValueError("Metas ativas precisam ter ao menos uma figurinha por pacote")

            normalizadas.append(
                {
                    "id_meta_tipo": id_meta_tipo,
                    "ativa": ativa,
                    "valor_alvo": valor_alvo,
                    "frequencia": frequencia,
                    "qtd_pacotes": qtd_pacotes,
                    "qtd_figurinhas_por_pacote": qtd_figurinhas,
                    "ordem_exibicao": ordem,
                }
            )

        return normalizadas

    def _validar_payload_campanha(self, data: dict):
        nome_campanha = str(data.get("nome_campanha") or "").strip()
        cpf_operador = str(data.get("cpf_operador") or "").strip()
        qtd_pacotes = self._to_int(data.get("qtd_pacotes"), 0)
        qtd_figurinhas = self._to_int(data.get("qtd_figurinhas_por_pacote"), 0)

        if not nome_campanha:
            raise ValueError("Informe o nome da campanha")

        if not cpf_operador:
            raise ValueError("Informe o operador vencedor da campanha")

        if qtd_pacotes <= 0 or qtd_pacotes > 3:
            raise ValueError("A campanha permite de 1 a 3 pacotes")

        if qtd_figurinhas <= 0 or qtd_figurinhas > 5:
            raise ValueError("A campanha permite de 1 a 5 figurinhas por pacote")

        return {
            "nome_campanha": nome_campanha,
            "cpf_operador": cpf_operador,
            "qtd_pacotes": qtd_pacotes,
            "qtd_figurinhas_por_pacote": qtd_figurinhas,
        }

    def obter_configuracao_supervisor(self, cpf_supervisor: str):
        self._garantir_estrutura_meta_copa()
        supervisor = self.repo.buscar_usuario_album(cpf_supervisor)
        if not supervisor:
            raise ValueError("Supervisor não encontrado em login.TB_USUARIOS")

        tipos = [self._mapear_tipo_meta(row) for row in self.repo.listar_tipos_meta_copa()]
        config_global = [
            self._mapear_config_meta(row) for row in self.repo.listar_config_global_meta_copa()
        ]
        campanhas_recentes = [
            self._mapear_campanha(row)
            for row in self.repo.listar_campanhas_recentes_supervisor(cpf_supervisor)
        ]
        operadores = []
        for row in self.repo.listar_operadores_supervisor(
            nome_supervisor=supervisor.get("NM_COLABORADOR"),
            centro_custo=supervisor.get("CENTRO_CUSTO"),
        ):
            operadores.append(
                {
                    "cpf": row.get("CPF_COLABORADOR"),
                    "nome": row.get("NM_COLABORADOR") or "",
                    "supervisor": row.get("SUPERVISOR") or "",
                    "centro_custo": row.get("CENTRO_CUSTO") or "",
                    "funcao": row.get("FUNCAO_COLABORADOR") or "",
                }
            )

        return {
            "supervisor": {
                "cpf": supervisor.get("CPF_COLABORADOR"),
                "nome": supervisor.get("NM_COLABORADOR"),
            },
            "tipos_meta": tipos,
            "config_global": config_global,
            "operadores": operadores,
            "campanhas_recentes": campanhas_recentes,
        }

    def obter_configuracao_operador(self, cpf_supervisor: str, cpf_operador: str):
        self._garantir_estrutura_meta_copa()
        supervisor = self.repo.buscar_usuario_album(cpf_supervisor)
        if not supervisor:
            raise ValueError("Supervisor não encontrado em login.TB_USUARIOS")

        operador = self.repo.buscar_operador_supervisor(
            nome_supervisor=supervisor.get("NM_COLABORADOR"),
            cpf_operador=cpf_operador,
            centro_custo=supervisor.get("CENTRO_CUSTO"),
        )
        if not operador:
            raise ValueError("Operador não encontrado no mesmo centro de custo do supervisor")

        tipos_meta_rows = self.repo.listar_tipos_meta_copa()
        tipos_meta = [
            self._ajustar_meta_contexto_supervisor(operador, self._mapear_tipo_meta(row))
            for row in tipos_meta_rows
            if self._meta_disponivel_para_operador(row, operador)
        ]
        tipos_meta = self._deduplicar_metas_configuracao(tipos_meta, operador)
        overrides = [
            self._ajustar_meta_contexto_supervisor(operador, self._mapear_config_meta(row))
            for row in self.repo.listar_overrides_meta_operador(cpf_operador)
            if self._meta_disponivel_para_operador(row, operador)
        ]
        overrides = self._deduplicar_metas_configuracao(overrides, operador)
        efetivas = []
        for row in self.repo.listar_metas_usuario(cpf_operador):
            if not self._meta_disponivel_para_operador(row, operador):
                continue
            efetiva = {
                "id_meta_tipo": str(row["ID_META"]),
                "codigo": row.get("TP_META") or "",
                "nome": row.get("NM_META") or "",
                "unidade": row.get("UNIDADE") or "",
                "regra_comparacao": row.get("REGRA_COMPARACAO") or "",
                "ativa": True,
                "valor_alvo": float(row.get("VL_ALVO") or 0),
                "frequencia": self._normalizar_frequencia_config(row.get("FREQUENCIA")),
                "qtd_pacotes": int(row.get("QTD_PACOTES") or 0),
                "qtd_figurinhas_por_pacote": int(row.get("QTD_FIGURINHAS_POR_PACOTE") or 0),
                "ordem_exibicao": int(row.get("ORDEM_EXIBICAO") or 0),
            }
            efetivas.append(self._ajustar_meta_contexto_supervisor(operador, efetiva))
        efetivas = self._deduplicar_metas_configuracao(efetivas, operador)

        return {
            "operador": {
                "cpf": operador.get("CPF_COLABORADOR"),
                "nome": operador.get("NM_COLABORADOR") or "",
                "supervisor": operador.get("SUPERVISOR") or "",
                "centro_custo": operador.get("CENTRO_CUSTO") or "",
                "funcao": operador.get("FUNCAO_COLABORADOR") or "",
            },
            "contexto_meta": self._montar_contexto_meta_operador(operador),
            "tipos_meta": tipos_meta,
            "overrides": overrides,
            "efetivas": efetivas,
        }

    def salvar_configuracao_global(self, cpf_supervisor: str, data: dict):
        self._garantir_estrutura_meta_copa()
        supervisor = self.repo.buscar_usuario_album(cpf_supervisor)
        if not supervisor:
            raise ValueError("Supervisor não encontrado em login.TB_USUARIOS")

        tipos_meta = self.repo.listar_tipos_meta_copa()
        metas = self._validar_payload_meta(data.get("metas") or [], tipos_meta)
        self.repo.salvar_config_global_meta_copa(metas, cpf_supervisor)
        return self.obter_configuracao_supervisor(cpf_supervisor)

    def salvar_configuracao_operador(self, cpf_supervisor: str, cpf_operador: str, data: dict):
        self._garantir_estrutura_meta_copa()
        supervisor = self.repo.buscar_usuario_album(cpf_supervisor)
        if not supervisor:
            raise ValueError("Supervisor não encontrado em login.TB_USUARIOS")

        operador = self.repo.buscar_operador_supervisor(
            nome_supervisor=supervisor.get("NM_COLABORADOR"),
            cpf_operador=cpf_operador,
            centro_custo=supervisor.get("CENTRO_CUSTO"),
        )
        if not operador:
            raise ValueError("Operador não encontrado no mesmo centro de custo do supervisor")

        tipos_meta = [
            row
            for row in self.repo.listar_tipos_meta_copa()
            if self._meta_disponivel_para_operador(row, operador)
        ]
        overrides = self._validar_payload_meta(
            data.get("metas") or [],
            tipos_meta,
            permitir_lista_vazia=True,
        )
        self.repo.salvar_overrides_meta_operador(cpf_operador, overrides, cpf_supervisor)
        return self.obter_configuracao_operador(cpf_supervisor, cpf_operador)

    def criar_campanha_supervisor(self, cpf_supervisor: str, data: dict):
        self._garantir_estrutura_meta_copa()
        supervisor = self.repo.buscar_usuario_album(cpf_supervisor)
        if not supervisor:
            raise ValueError("Supervisor não encontrado em login.TB_USUARIOS")

        payload = self._validar_payload_campanha(data)
        operador = self.repo.buscar_operador_supervisor(
            nome_supervisor=supervisor.get("NM_COLABORADOR"),
            cpf_operador=payload["cpf_operador"],
            centro_custo=supervisor.get("CENTRO_CUSTO"),
        )
        if not operador:
            raise ValueError("Operador vencedor não encontrado no mesmo centro de custo do supervisor")

        campanha = self.repo.criar_campanha_premio(
            cpf_supervisor=cpf_supervisor,
            cpf_colaborador=payload["cpf_operador"],
            nome_campanha=payload["nome_campanha"],
            qtd_pacotes=payload["qtd_pacotes"],
            qtd_figurinhas_por_pacote=payload["qtd_figurinhas_por_pacote"],
        )

        campanha_dict = self._mapear_campanha(
            {
                **(campanha or {}),
                "NM_COLABORADOR": operador.get("NM_COLABORADOR"),
                "CENTRO_CUSTO": operador.get("CENTRO_CUSTO"),
            }
        )

        return {
            "campanha": campanha_dict,
            "configuracao": self.obter_configuracao_supervisor(cpf_supervisor),
        }

    def _mapear_figurinha(self, row: dict):
        raridade = self._normalizar_raridade(row.get("NM_RARIDADE"))

        return {
            "id": str(row["ID_FIGURINHA"]),
            "id_equipe": str(row["ID_EQUIPE"]),
            "nome": row.get("NM_FIGURINHA") or row.get("NM_COLABORADOR") or "",
            "setor": row.get("NM_EQUIPE") or "",
            "raridade": raridade,
            "desbloqueada": int(row.get("QTD_COLADAS") or 0) > 0,
            "imagem": row.get("URL_IMAGEM"),
            "numero": str(row.get("NR_SLOT_EQUIPE") or "").zfill(2),
            "estatistica": row.get("NM_EQUIPE") or "",
            "slot_equipe": int(row.get("NR_SLOT_EQUIPE") or 0),
            "ordem_geral": int(row.get("ORDEM_EXIBICAO_GERAL") or 0),
            "boss": bool(row.get("FL_BOSS")),
            "qtd_total": int(row.get("QTD_TOTAL") or 0),
            "qtd_coladas": int(row.get("QTD_COLADAS") or 0),
        }

    def _mapear_pacote(self, row: dict):
        itens = [self._mapear_figurinha(item) for item in row.get("ITENS", [])]

        raridade_dominante = "comum"
        if itens:
            ordem_raridade = {
                "comum": 1,
                "incomum": 2,
                "raro": 3,
                "ultra-raro": 4,
                "epico": 5,
                "lendario": 6,
                "boss": 7,
            }
            raridade_dominante = max(
                itens,
                key=lambda fig: ordem_raridade.get(fig["raridade"], 0),
            )["raridade"]

        return {
            "id": str(row["ID_PACOTE"]),
            "nome": row.get("NM_PACOTE") or "Pacote Copa",
            "cor": row.get("COR_PACOTE_HEX"),
            "origem": row.get("NM_META") or "Meta do álbum",
            "figurinhas": itens,
            "aberto": str(row.get("STATUS_PACOTE") or "").upper() == "ABERTO",
            "raridade": raridade_dominante,
            "origem_api": True,
            "dt_ganho": row.get("DT_GANHO").isoformat() if row.get("DT_GANHO") else None,
            "dt_abertura": row.get("DT_ABERTURA").isoformat() if row.get("DT_ABERTURA") else None,
        }

    def _mapear_repetida(self, row: dict):
        return {
            "id": str(row["ID_FIGURINHA"]),
            "nome": row.get("NM_FIGURINHA") or "",
            "setor": row.get("NM_EQUIPE") or "",
            "raridade": self._normalizar_raridade(row.get("NM_RARIDADE")),
            "imagem": row.get("URL_IMAGEM"),
            "slot_equipe": int(row.get("NR_SLOT_EQUIPE") or 0),
            "ordem_geral": int(row.get("ORDEM_EXIBICAO_GERAL") or 0),
            "boss": bool(row.get("FL_BOSS")),
            "qtd_total": int(row.get("QTD_TOTAL") or 0),
            "qtd_coladas": int(row.get("QTD_COLADAS") or 0),
            "qtd_repetidas": int(row.get("QTD_REPETIDAS") or 0),
        }

    def _mapear_solicitacao_troca(self, row: dict):
        return {
            "id": str(row["ID_TROCA_FIGURINHA"]),
            "status": str(row.get("STATUS_TROCA") or "").upper(),
            "dt_solicitacao": row.get("DT_SOLICITACAO").isoformat()
            if row.get("DT_SOLICITACAO")
            else None,
            "dt_resposta": row.get("DT_RESPOSTA").isoformat()
            if row.get("DT_RESPOSTA")
            else None,
            "solicitante": {
                "cpf": row.get("ID_USUARIO_SOLICITANTE"),
                "nome": row.get("NM_SOLICITANTE") or "",
            },
            "destinatario": {
                "cpf": row.get("ID_USUARIO_DESTINATARIO"),
                "nome": row.get("NM_DESTINATARIO") or "",
            },
            "figurinha_oferecida": {
                "id": str(row["ID_FIGURINHA_OFERECIDA"]),
                "nome": row.get("NM_FIGURINHA_OFERECIDA") or "",
                "imagem": row.get("URL_IMAGEM_OFERECIDA"),
                "setor": row.get("NM_EQUIPE_OFERECIDA") or "",
                "raridade": self._normalizar_raridade(row.get("NM_RARIDADE_OFERECIDA")),
            },
            "figurinha_desejada": {
                "id": str(row["ID_FIGURINHA_DESEJADA"]),
                "nome": row.get("NM_FIGURINHA_DESEJADA") or "",
                "imagem": row.get("URL_IMAGEM_DESEJADA"),
                "setor": row.get("NM_EQUIPE_DESEJADA") or "",
                "raridade": self._normalizar_raridade(row.get("NM_RARIDADE_DESEJADA")),
            },
        }

    def _mapear_lance_leilao(self, row: dict):
        return {
            "id": str(row.get("ID_LANCE") or ""),
            "id_leilao": str(row.get("ID_LEILAO") or ""),
            "usuario": {
                "cpf": row.get("ID_USUARIO") or "",
                "nome": row.get("NM_COLABORADOR") or "Operador",
            },
            "valor": int(row.get("VL_LANCE") or 0),
            "dt_lance": self._to_iso(row.get("DT_LANCE")),
        }

    def _mapear_leilao(self, row: dict, incluir_lances: bool = False):
        id_leilao = str(row.get("ID_LEILAO") or "")
        lances = (
            [self._mapear_lance_leilao(lance) for lance in self.repo.listar_lances_leilao(id_leilao, 8)]
            if incluir_lances and id_leilao
            else []
        )
        return {
            "id": id_leilao,
            "status": str(row.get("STATUS_LEILAO") or "").upper(),
            "figurinha": {
                "id": str(row.get("ID_FIGURINHA") or ""),
                "nome": row.get("NM_FIGURINHA") or "",
                "imagem": row.get("URL_IMAGEM"),
                "setor": row.get("NM_EQUIPE") or "",
                "raridade": self._normalizar_raridade(row.get("NM_RARIDADE")),
                "slot_equipe": int(row.get("NR_SLOT_EQUIPE") or 0),
                "ordem_geral": int(row.get("ORDEM_EXIBICAO_GERAL") or 0),
                "boss": bool(row.get("FL_BOSS")),
            },
            "vendedor": {
                "cpf": row.get("ID_USUARIO_VENDEDOR") or "",
                "nome": row.get("NM_VENDEDOR") or "Operador",
            },
            "comprador": {
                "cpf": row.get("ID_USUARIO_COMPRADOR") or "",
                "nome": row.get("NM_COMPRADOR") or "",
            } if row.get("ID_USUARIO_COMPRADOR") else None,
            "maior_lance": {
                "cpf": row.get("ID_MAIOR_LANCE_USUARIO") or "",
                "nome": row.get("NM_MAIOR_LANCE") or "",
            } if row.get("ID_MAIOR_LANCE_USUARIO") else None,
            "valor_inicial": int(row.get("VL_INICIAL") or 0),
            "valor_compre_ja": int(row.get("VL_COMPRE_JA") or 0) if row.get("VL_COMPRE_JA") is not None else None,
            "valor_atual": int(row.get("VL_ATUAL") or 0),
            "qtd_lances": int(row.get("QTD_LANCES") or 0),
            "dt_inicio": self._to_iso(row.get("DT_INICIO")),
            "dt_fim": self._to_iso(row.get("DT_FIM")),
            "dt_finalizacao": self._to_iso(row.get("DT_FINALIZACAO")),
            "meu_anuncio": bool(row.get("MEU_ANUNCIO")),
            "meu_lance": bool(row.get("MEU_LANCE")),
            "eu_lidero": bool(row.get("EU_LIDERO")),
            "lances": lances,
        }

    def _montar_leiloes_album(self, id_usuario: str):
        habilitado = self.repo.leiloes_habilitados()
        if not habilitado:
            return {
                "habilitado": False,
                "duracao_segundos": ALBUM_LEILAO_DURACAO_SEGUNDOS,
                "incremento_minimo": ALBUM_LEILAO_INCREMENTO_MINIMO,
                "leiloes": [],
                "meus_anuncios": [],
                "meus_lances": [],
            }

        leiloes = [
            self._mapear_leilao(row, incluir_lances=True)
            for row in self.repo.listar_leiloes_album(id_usuario)
        ]
        return {
            "habilitado": True,
            "duracao_segundos": ALBUM_LEILAO_DURACAO_SEGUNDOS,
            "incremento_minimo": ALBUM_LEILAO_INCREMENTO_MINIMO,
            "leiloes": [item for item in leiloes if item["status"] == "ATIVO"],
            "meus_anuncios": [item for item in leiloes if item["meu_anuncio"]],
            "meus_lances": [item for item in leiloes if item["meu_lance"]],
        }

    def _mapear_olheiro_base(self, row: dict, prefixo_custo: str = "VL_CUSTO"):
        return {
            "id": str(row.get("ID_OLHEIRO") or ""),
            "nome": row.get("NM_OLHEIRO") or "",
            "cargo": row.get("DS_CARGO") or "",
            "raridade": self._normalizar_raridade(row.get("NM_RARIDADE")),
            "imagem": row.get("URL_IMAGEM"),
            "custo": int(row.get(prefixo_custo) or row.get("VL_CUSTO") or 0),
            "estrelas": int(row.get("NR_ESTRELAS") or 1),
            "radar": int(row.get("NR_RADAR") or 0),
            "persistencia": int(row.get("NR_PERSISTENCIA") or 0),
            "alcance": int(row.get("NR_ALCANCE") or 0),
        }

    def _mapear_oferta_olheiro(self, row: dict):
        return {
            "id": str(row.get("ID_OFERTA") or ""),
            "data_referencia": self._to_iso(row.get("DT_REFERENCIA")),
            "ordem": int(row.get("NR_ORDEM") or 0),
            "contratado": bool(row.get("FL_CONTRATADO")),
            "olheiro": self._mapear_olheiro_base(row),
        }

    def _mapear_missao_olheiro(self, row: dict):
        return {
            "id": str(row.get("ID_MISSAO") or ""),
            "id_oferta": str(row.get("ID_OFERTA") or ""),
            "tempo": row.get("DS_TEMPO") or "equilibrada",
            "destino": row.get("DS_DESTINO") or "mexico",
            "custo": int(row.get("VL_CUSTO") or 0),
            "status": str(row.get("STATUS_MISSAO") or "").upper(),
            "dt_inicio": self._to_iso(row.get("DT_INICIO")),
            "dt_fim": self._to_iso(row.get("DT_FIM")),
            "dt_finalizacao": self._to_iso(row.get("DT_FINALIZACAO")),
            "id_pacote": str(row.get("ID_PACOTE") or "") or None,
            "olheiro": self._mapear_olheiro_base(row, "VL_CUSTO_OLHEIRO"),
        }

    def _montar_olheiros_album(self, id_usuario: str):
        if not self.repo.olheiros_habilitados():
            return {
                "habilitado": False,
                "qtd_ofertas": ALBUM_OLHEIRO_QTD_OFERTAS,
                "qtd_retorno": ALBUM_OLHEIRO_QTD_RETORNO,
                "custo_atualizar": ALBUM_OLHEIRO_ATUALIZAR_CUSTO,
                "proxima_atualizacao": None,
                "tempos": ALBUM_OLHEIRO_TEMPOS,
                "destinos": ALBUM_OLHEIRO_DESTINOS,
                "ofertas": [],
                "missoes": [],
            }

        estado = self.repo.listar_estado_olheiros(id_usuario)
        amanha = datetime.combine(date.today() + timedelta(days=1), datetime.min.time())
        return {
            "habilitado": True,
            "qtd_ofertas": ALBUM_OLHEIRO_QTD_OFERTAS,
            "qtd_retorno": ALBUM_OLHEIRO_QTD_RETORNO,
            "custo_atualizar": ALBUM_OLHEIRO_ATUALIZAR_CUSTO,
            "proxima_atualizacao": self._to_iso(amanha),
            "tempos": ALBUM_OLHEIRO_TEMPOS,
            "destinos": ALBUM_OLHEIRO_DESTINOS,
            "ofertas": [self._mapear_oferta_olheiro(row) for row in estado.get("ofertas", [])],
            "missoes": [self._mapear_missao_olheiro(row) for row in estado.get("missoes", [])],
        }

    def _perfil_retorno_olheiro(self, raridade: str, tempo: str, destino: str):
        raridade = self._normalizar_raridade(raridade)
        perfil = {
            "comum": {"min_raridade": "incomum", "qtd_garantidas": 2},
            "raro": {"min_raridade": "raro", "qtd_garantidas": 2},
            "epico": {"min_raridade": "raro", "qtd_garantidas": 5},
            "lendario": {"min_raridade": "ultra-raro", "qtd_garantidas": 4},
            "boss": {"min_raridade": "epico", "qtd_garantidas": 3},
        }.get(raridade, {"min_raridade": "incomum", "qtd_garantidas": 2})

        ajuste = dict(perfil)
        if tempo == "profunda":
            ajuste["qtd_garantidas"] = int(ajuste["qtd_garantidas"]) + 2
        elif tempo == "equilibrada":
            ajuste["qtd_garantidas"] = int(ajuste["qtd_garantidas"]) + 1

        if destino == "mexico" and raridade in {"epico", "lendario", "boss"}:
            ajuste["min_raridade"] = "epico"
            ajuste["qtd_garantidas"] = max(int(ajuste["qtd_garantidas"]), 2)
        ajuste["qtd_garantidas"] = min(int(ajuste["qtd_garantidas"]), ALBUM_OLHEIRO_QTD_RETORNO)
        return ajuste

    def _ajustar_meta_visual_contexto(self, usuario: dict, row: dict):
        if not self._operador_usa_resultado_vega(usuario):
            return row

        codigo = self._meta_equivalente_vega(self._codigo_meta_normalizado(row))
        meta = dict(row)
        nome_atual = str(meta.get("NM_META") or "")

        if codigo == "PP":
            meta["TP_META"] = "PP"
            meta["UNIDADE"] = "PP"
            if not nome_atual or "acordo" in nome_atual.lower():
                meta["NM_META"] = "Meta de PP"
        elif codigo == "VALOR_RECUPERADO":
            meta["TP_META"] = "VALOR_RECUPERADO"
            meta["UNIDADE"] = meta.get("UNIDADE") or "R$"
            if not nome_atual or "acordo" in nome_atual.lower() or "recebido" in nome_atual.lower():
                meta["NM_META"] = "Valor recuperado"
        elif codigo == "TEMPO_LOGADO":
            meta["TP_META"] = "TEMPO_LOGADO"
            meta["UNIDADE"] = "h"
            if not nome_atual:
                meta["NM_META"] = "Tempo logado"

        return meta

    def _apelido_ranking(self, posicao: int) -> str:
        return f"Operador {posicao}"

    def _calcular_metricas_conquistas(self, id_usuario: str, figurinhas_rows: list[dict]):
        equipes: dict[str, dict] = {}
        desbloqueadas = 0
        lendarias = 0
        boss = 0
        raras_ou_superiores = 0

        for row in figurinhas_rows:
            id_equipe = str(row.get("ID_EQUIPE") or "")
            equipe = equipes.setdefault(
                id_equipe,
                {
                    "nome": row.get("NM_EQUIPE") or "",
                    "total": 0,
                    "desbloqueadas": 0,
                },
            )
            equipe["total"] += 1

            qtd_total = int(row.get("QTD_TOTAL") or 0)
            raridade = self._normalizar_raridade(row.get("NM_RARIDADE"))

            if qtd_total > 0:
                desbloqueadas += 1
                equipe["desbloqueadas"] += 1

                if raridade == "lendario":
                    lendarias += 1

                if raridade == "boss" or bool(row.get("FL_BOSS")):
                    boss += 1

                if raridade in {"raro", "ultra-raro", "epico", "lendario", "boss"}:
                    raras_ou_superiores += 1

        total_album = len(figurinhas_rows)
        percentual_album = round((desbloqueadas / total_album) * 100) if total_album else 0
        equipes_completas = sum(
            1
            for equipe in equipes.values()
            if equipe["total"] > 0 and equipe["desbloqueadas"] >= equipe["total"]
        )

        historico = self.repo.obter_metricas_conquistas_usuario(id_usuario)

        return {
            "metas_batidas": int(historico.get("TOTAL_METAS_BATIDAS") or 0),
            "pacotes_abertos": int(historico.get("TOTAL_PACOTES_ABERTOS") or 0),
            "trocas_aceitas": int(historico.get("TOTAL_TROCAS_ACEITAS") or 0),
            "lendarias": lendarias,
            "boss": boss,
            "raras_ou_superiores": raras_ou_superiores,
            "equipes_completas": equipes_completas,
            "percentual_album": percentual_album,
            "figurinhas_desbloqueadas": desbloqueadas,
            "figurinhas_total": total_album,
        }

    def _montar_conquistas_usuario(self, id_usuario: str, figurinhas_rows: list[dict] | None = None):
        figurinhas = figurinhas_rows or self.repo.listar_figurinhas_usuario(id_usuario)
        metricas = self._calcular_metricas_conquistas(id_usuario, figurinhas)

        lista = []
        desbloqueadas = 0
        for definicao in CONQUISTAS_DEFINICOES:
            atual = int(metricas.get(definicao["chave"], 0))
            alvo = int(definicao["alvo"])
            concluida = atual >= alvo
            if concluida:
                desbloqueadas += 1

            lista.append(
                {
                    "id": definicao["id"],
                    "titulo": definicao["titulo"],
                    "descricao": definicao["descricao"],
                    "medalha": definicao["medalha"],
                    "icone": definicao["icone"],
                    "atual": atual,
                    "alvo": alvo,
                    "desbloqueada": concluida,
                    "progresso_percentual": min(100, round((atual / alvo) * 100)) if alvo > 0 else 0,
                }
            )

        return {
            "resumo": {
                "desbloqueadas": desbloqueadas,
                "total": len(CONQUISTAS_DEFINICOES),
                "metas_batidas": metricas["metas_batidas"],
                "pacotes_abertos": metricas["pacotes_abertos"],
                "trocas_aceitas": metricas["trocas_aceitas"],
                "percentual_album": metricas["percentual_album"],
                "figurinhas_desbloqueadas": metricas["figurinhas_desbloqueadas"],
                "figurinhas_total": metricas["figurinhas_total"],
                "equipes_completas": metricas["equipes_completas"],
            },
            "lista": lista,
        }

    def _listar_equipes_completas(self, figurinhas_rows: list[dict]):
        equipes: dict[str, dict] = {}
        for row in figurinhas_rows:
            id_equipe = str(row.get("ID_EQUIPE") or "")
            equipe = equipes.setdefault(
                id_equipe,
                {
                    "id_equipe": id_equipe,
                    "nome": row.get("NM_EQUIPE") or "",
                    "total": 0,
                    "desbloqueadas": 0,
                },
            )
            equipe["total"] += 1
            if int(row.get("QTD_TOTAL") or 0) > 0:
                equipe["desbloqueadas"] += 1

        return [
            {
                "id_equipe": equipe["id_equipe"],
                "nome": equipe["nome"],
            }
            for equipe in equipes.values()
            if equipe["total"] > 0 and equipe["desbloqueadas"] >= equipe["total"]
        ]

    def _sincronizar_recompensas_aurora(self, id_usuario: str, conquistas: dict, figurinhas_rows: list[dict]):
        if not self.repo.moedas_habilitadas():
            return

        conquistas_desbloqueadas = [
            item for item in (conquistas.get("lista") or []) if item.get("desbloqueada")
        ]
        equipes_completas = self._listar_equipes_completas(figurinhas_rows)

        self.repo.sincronizar_recompensas_aurora(
            id_usuario=id_usuario,
            conquistas_desbloqueadas=conquistas_desbloqueadas,
            equipes_completas=equipes_completas,
            moedas_por_conquista=AURORA_COINS_CONQUISTAS,
            moedas_por_equipe=AURORA_COINS_POR_EQUIPE_COMPLETA,
        )

    def _montar_carteira_aurora(self, id_usuario: str):
        habilitada = self.repo.moedas_habilitadas()
        saldo = self.repo.obter_saldo_aurora_coins(id_usuario)
        extrato_rows = self.repo.listar_extrato_aurora_coins(id_usuario, 20) if habilitada else []

        extrato = [
            {
                "id": str(row["ID_MOVIMENTACAO_AURORA"]),
                "tipo_movimentacao": row.get("TP_MOVIMENTACAO") or "",
                "tipo_origem": row.get("TP_ORIGEM") or "",
                "id_origem": row.get("ID_ORIGEM") or "",
                "quantidade": int(row.get("QTD_COINS") or 0),
                "descricao": row.get("DS_MOVIMENTACAO") or "",
                "dt_movimentacao": self._to_iso(row.get("DT_MOVIMENTACAO")),
            }
            for row in extrato_rows
        ]

        return {
            "habilitada": habilitada,
            "saldo_atual": int(saldo.get("saldo_atual") or 0),
            "total_ganho": int(saldo.get("total_ganho") or 0),
            "total_gasto": int(saldo.get("total_gasto") or 0),
            "extrato": extrato,
        }

    def _montar_loja_aurora(self, saldo_atual: int, id_usuario: str | None = None):
        venda_rapida_ganho_hoje = (
            self.repo.obter_total_venda_rapida_hoje(id_usuario)
            if id_usuario
            else 0
        )
        return {
            "nome_moeda": "Aurora Coins",
            "ofertas": [
                {
                    **oferta,
                    "disponivel": saldo_atual >= int(oferta["custo_coins"]),
                }
                for oferta in AURORA_SHOP_OFFERS
            ],
            "venda_rapida": {
                "habilitada": True,
                "valores": ALBUM_VENDA_RAPIDA_VALORES,
                "limite_diario": ALBUM_VENDA_RAPIDA_LIMITE_DIARIO,
                "ganho_hoje": venda_rapida_ganho_hoje,
                "limite_restante": max(
                    ALBUM_VENDA_RAPIDA_LIMITE_DIARIO - venda_rapida_ganho_hoje,
                    0,
                ),
            },
        }

    def _montar_pacote_misterioso(self, id_usuario: str, usuario: dict | None = None):
        acesso_liberado = self._usuario_pode_resgatar_pacote_misterioso(usuario)
        repetidas_disponiveis = self.repo.contar_repetidas_disponiveis_usuario(
            id_usuario,
            excluir_id_figurinha=ALBUM_MYSTERY_FIGURINHA_ID,
        )
        resgates_realizados = self.repo.contar_resgates_pacote_misterioso(
            id_figurinha_misteriosa=ALBUM_MYSTERY_FIGURINHA_ID,
            nome_pacote=ALBUM_MYSTERY_NOME_PACOTE,
        )
        resgates_disponiveis = max(
            ALBUM_MYSTERY_RESGATES_LIMITE - resgates_realizados,
            0,
        )
        ja_resgatou = self.repo.usuario_resgatou_pacote_misterioso(
            id_usuario=id_usuario,
            id_figurinha=ALBUM_MYSTERY_FIGURINHA_ID,
            nome_pacote=ALBUM_MYSTERY_NOME_PACOTE,
        )
        return {
            "habilitado": acesso_liberado,
            "titulo": "????????",
            "subtitulo": "Uma lenda escondida nos arquivos do album.",
            "id_figurinha": str(ALBUM_MYSTERY_FIGURINHA_ID),
            "custo_repetidas": ALBUM_MYSTERY_REPETIDAS_CUSTO,
            "repetidas_disponiveis": repetidas_disponiveis,
            "limite_resgates": ALBUM_MYSTERY_RESGATES_LIMITE,
            "resgates_realizados": resgates_realizados,
            "resgates_disponiveis": resgates_disponiveis,
            "pode_resgatar": (
                acesso_liberado
                and not ja_resgatou
                and resgates_disponiveis > 0
                and repetidas_disponiveis >= ALBUM_MYSTERY_REPETIDAS_CUSTO
            ),
            "ja_resgatou": ja_resgatou,
            "nome_pacote": ALBUM_MYSTERY_NOME_PACOTE,
        }

    def _mapear_duelo(self, row: dict, id_usuario: str, participantes: list[dict] | None = None):
        id_desafiante = str(row.get("ID_USUARIO_DESAFIANTE") or "")
        id_desafiado = str(row.get("ID_USUARIO_DESAFIADO") or "")
        participantes = participantes or []
        time_desafiante = [
            {
                "cpf": str(item.get("ID_USUARIO") or ""),
                "nome": item.get("NM_COLABORADOR") or "Operador",
            }
            for item in participantes
            if str(item.get("TP_TIME") or "").upper() == "DESAFIANTE"
        ]
        time_desafiado = [
            {
                "cpf": str(item.get("ID_USUARIO") or ""),
                "nome": item.get("NM_COLABORADOR") or "Operador",
            }
            for item in participantes
            if str(item.get("TP_TIME") or "").upper() == "DESAFIADO"
        ]
        if not time_desafiante:
            time_desafiante = [{"cpf": id_desafiante, "nome": row.get("NM_DESAFIANTE") or "Operador"}]
        if not time_desafiado:
            time_desafiado = [{"cpf": id_desafiado, "nome": row.get("NM_DESAFIADO") or "Operador"}]

        sou_desafiante = any(item["cpf"] == str(id_usuario) for item in time_desafiante)
        meu_time = time_desafiante if sou_desafiante else time_desafiado
        time_oponente = time_desafiado if sou_desafiante else time_desafiante
        meu_nome = next(
            (item["nome"] for item in meu_time if item["cpf"] == str(id_usuario)),
            row.get("NM_DESAFIANTE") if sou_desafiante else row.get("NM_DESAFIADO"),
        )
        oponente_nome = time_oponente[0]["nome"] if time_oponente else (
            row.get("NM_DESAFIADO") if sou_desafiante else row.get("NM_DESAFIANTE")
        )
        tp_metrica = str(row.get("TP_METRICA_DUELO") or "ACORDOS").strip().upper()
        metrica_label = "PP" if tp_metrica == "PP" else "Acordos"
        metrica_descricao = "promessas de pagamento" if tp_metrica == "PP" else "acordos"
        meus_acordos = int(
            (
                row.get("QTD_ACORDOS_DESAFIANTE")
                if sou_desafiante
                else row.get("QTD_ACORDOS_DESAFIADO")
            )
            or 0,
        )
        acordos_oponente = int(
            (
                row.get("QTD_ACORDOS_DESAFIADO")
                if sou_desafiante
                else row.get("QTD_ACORDOS_DESAFIANTE")
            )
            or 0,
        )
        vencedor_id = str(row.get("ID_USUARIO_VENCEDOR") or "")
        status = str(row.get("STATUS_DUELO") or "").upper()
        time_vencedor = []
        if vencedor_id:
            if vencedor_id == id_desafiante:
                time_vencedor = time_desafiante
            elif vencedor_id == id_desafiado:
                time_vencedor = time_desafiado
        venci = any(item["cpf"] == str(id_usuario) for item in time_vencedor)

        return {
            "id": str(row.get("ID_DUELO_DIARIO")),
            "status": status,
            "modo": "grupo" if max(len(time_desafiante), len(time_desafiado)) > 1 else "individual",
            "tamanho_time": max(len(time_desafiante), len(time_desafiado)),
            "metrica_codigo": tp_metrica,
            "metrica_label": metrica_label,
            "metrica_descricao": metrica_descricao,
            "meta_acordos": int(row.get("QTD_META_ACORDOS") or 0),
            "dt_duelo": row.get("DT_DUELO").isoformat() if row.get("DT_DUELO") else None,
            "dt_criacao": self._to_iso(row.get("DT_CRIACAO")),
            "dt_resposta": self._to_iso(row.get("DT_RESPOSTA")),
            "dt_inicio_contagem": self._to_iso(row.get("DT_INICIO_CONTAGEM")),
            "dt_fim_duelo": self._to_iso(row.get("DT_FIM_DUELO")),
            "dt_conclusao": self._to_iso(row.get("DT_CONCLUSAO")),
            "centro_custo": row.get("NM_CENTRO_CUSTO") or "",
            "meus_acordos": meus_acordos,
            "acordos_oponente": acordos_oponente,
            "minha_meta_restante": max(0, int(row.get("QTD_META_ACORDOS") or 0) - meus_acordos),
            "oponente_meta_restante": max(0, int(row.get("QTD_META_ACORDOS") or 0) - acordos_oponente),
            "sou_desafiante": sou_desafiante,
            "meu_nome": meu_nome or "Operador",
            "meu_time": meu_time,
            "time_oponente": time_oponente,
            "nome_time": f"Time de {meu_time[0]['nome']}" if meu_time else "Meu time",
            "nome_time_oponente": f"Time de {time_oponente[0]['nome']}" if time_oponente else "Time rival",
            "oponente": {
                "cpf": time_oponente[0]["cpf"] if time_oponente else (id_desafiado if sou_desafiante else id_desafiante),
                "nome": oponente_nome or "Operador",
            },
            "desafiante": {
                "cpf": id_desafiante,
                "nome": row.get("NM_DESAFIANTE") or "Operador",
            },
            "desafiado": {
                "cpf": id_desafiado,
                "nome": row.get("NM_DESAFIADO") or "Operador",
            },
            "vencedor_cpf": vencedor_id or None,
            "venci": venci,
            "derrota": bool(vencedor_id and not venci and status == "VENCIDO"),
            "streak_vitorias_vencedor": int(row.get("NR_STREAK_VITORIAS_VENCEDOR") or 0),
        }

    def _montar_duelos_usuario(self, usuario: dict):
        habilitado = self.repo.duelos_habilitados()
        if not habilitado:
            return {
                "habilitado": False,
                "metrica_codigo": self._duelo_configuracao_operador(usuario).get("codigo"),
                "metrica_label": self._duelo_configuracao_operador(usuario).get("label"),
                "metrica_descricao": self._duelo_configuracao_operador(usuario).get("descricao"),
                "meta_minima": DUEL_META_MINIMA,
                "meta_maxima": DUEL_META_MAXIMA,
                "meta_minima_grupo": DUEL_GROUP_META_MINIMA,
                "meta_maxima_grupo": DUEL_GROUP_META_MAXIMA,
                "tamanho_time_minimo": DUEL_TIME_MINIMO,
                "tamanho_time_maximo": DUEL_TIME_MAXIMO,
                "premio": {
                    "qtd_pacotes": DUEL_PREMIO_PACOTES,
                    "qtd_figurinhas_por_pacote": DUEL_PREMIO_FIGURINHAS,
                },
                "sequencia_vitorias": 0,
                "operadores": [],
                "pendentes_recebidos": [],
                "pendentes_enviados": [],
                "duelo_ativo": None,
                "historico": [],
            }

        id_usuario = str(usuario["ID_USUARIO"])
        centro_custo = str(usuario.get("CENTRO_CUSTO") or "")
        duelo_config = self._duelo_configuracao_operador(usuario)
        operadores = [
            {
                "cpf": row.get("CPF_COLABORADOR"),
                "nome": row.get("NM_COLABORADOR") or "",
                "centro_custo": row.get("CENTRO_CUSTO") or "",
                "supervisor": row.get("SUPERVISOR") or "",
            }
            for row in self.repo.listar_operadores_mesmo_centro_custo(id_usuario, centro_custo)
        ]
        duelos_rows = self.repo.listar_duelos_usuario(id_usuario, 10)
        self.repo.sincronizar_duelos_diarios(duelos_rows)
        duelos_rows = self.repo.listar_duelos_usuario(id_usuario, 10)
        participantes_por_duelo = {}
        if duelos_rows:
            ids_duelo = [str(row.get("ID_DUELO_DIARIO")) for row in duelos_rows if row.get("ID_DUELO_DIARIO")]
            for participante in self.repo.listar_participantes_duelos(ids_duelo):
                participantes_por_duelo.setdefault(str(participante.get("ID_DUELO_DIARIO")), []).append(participante)
        duelos = [
            self._mapear_duelo(
                row,
                id_usuario,
                participantes_por_duelo.get(str(row.get("ID_DUELO_DIARIO")), []),
            )
            for row in duelos_rows
        ]

        pendentes_recebidos = [
            duelo
            for duelo in duelos
            if duelo["status"] == "PENDENTE" and not duelo["sou_desafiante"]
        ]
        pendentes_enviados = [
            duelo
            for duelo in duelos
            if duelo["status"] == "PENDENTE" and duelo["sou_desafiante"]
        ]
        duelo_ativo = next(
            (duelo for duelo in duelos if duelo["status"] == "ATIVO"),
            None,
        )
        historico = [
            duelo
            for duelo in duelos
            if duelo["status"] in {"VENCIDO", "EXPIRADO", "RECUSADO"}
        ]
        sequencia_vitorias = 0
        for duelo in historico:
            if duelo["status"] != "VENCIDO":
                break
            if not duelo["venci"]:
                break
            sequencia_vitorias += 1

        return {
            "habilitado": True,
            "metrica_codigo": duelo_config["codigo"],
            "metrica_label": duelo_config["label"],
            "metrica_descricao": duelo_config["descricao"],
            "meta_minima": DUEL_META_MINIMA,
            "meta_maxima": DUEL_META_MAXIMA,
            "meta_minima_grupo": DUEL_GROUP_META_MINIMA,
            "meta_maxima_grupo": DUEL_GROUP_META_MAXIMA,
            "tamanho_time_minimo": DUEL_TIME_MINIMO,
            "tamanho_time_maximo": DUEL_TIME_MAXIMO,
            "premio": {
                "qtd_pacotes": DUEL_PREMIO_PACOTES,
                "qtd_figurinhas_por_pacote": DUEL_PREMIO_FIGURINHAS,
            },
            "sequencia_vitorias": sequencia_vitorias,
            "operadores": operadores,
            "pendentes_recebidos": pendentes_recebidos,
            "pendentes_enviados": pendentes_enviados,
            "duelo_ativo": duelo_ativo,
            "historico": historico,
        }

    def _montar_feed_album(self, id_usuario: str):
        eventos = []

        for row in self.repo.listar_feed_metas(20):
            dt_evento = row.get("DT_EVENTO")
            eventos.append(
                {
                    "id_evento": f"meta:{row.get('ID_META_USUARIO')}",
                    "tipo": "meta_batida",
                    "badge": "Meta",
                    "titulo": f"{row.get('NM_COLABORADOR') or 'Operador'} bateu uma meta",
                    "descricao": (
                        f"{row.get('NM_META') or 'Meta'} • "
                        f"{self._formatar_numero_feed(row.get('VL_APURADO'))}/"
                        f"{self._formatar_numero_feed(row.get('VL_ALVO'))} "
                        f"{row.get('UNIDADE') or ''}"
                    ).strip(),
                    "dt_evento": self._to_iso(dt_evento),
                    "_dt_sort": dt_evento or datetime.min,
                }
            )

        for row in self.repo.listar_feed_unlocks_raros(20):
            dt_evento = row.get("DT_EVENTO")
            raridade_label = self._label_raridade(row.get("NM_RARIDADE"))
            eventos.append(
                {
                    "id_evento": f"unlock:{row.get('ID_USUARIO')}:{row.get('ID_FIGURINHA')}",
                    "tipo": "figurinha_rara",
                    "badge": raridade_label,
                    "titulo": f"{row.get('NM_COLABORADOR') or 'Operador'} desbloqueou uma carta {raridade_label.lower()}",
                    "descricao": f"{row.get('NM_FIGURINHA') or 'Figurinha'} • {row.get('NM_EQUIPE') or 'Equipe'}",
                    "dt_evento": self._to_iso(dt_evento),
                    "raridade": self._normalizar_raridade(row.get('NM_RARIDADE')),
                    "_dt_sort": dt_evento or datetime.min,
                }
            )

        for row in self.repo.listar_feed_trocas_aceitas(20):
            dt_evento = row.get("DT_EVENTO")
            eventos.append(
                {
                    "id_evento": f"troca:{row.get('ID_TROCA_FIGURINHA')}",
                    "tipo": "troca_aceita",
                    "badge": "Troca",
                    "titulo": (
                        f"{row.get('NM_SOLICITANTE') or 'Operador'} trocou com "
                        f"{row.get('NM_DESTINATARIO') or 'operador'}"
                    ),
                    "descricao": (
                        f"{row.get('NM_FIGURINHA_OFERECIDA') or 'Figurinha'} por "
                        f"{row.get('NM_FIGURINHA_DESEJADA') or 'figurinha'}"
                    ),
                    "dt_evento": self._to_iso(dt_evento),
                    "_dt_sort": dt_evento or datetime.min,
                }
            )

        for row in self.repo.listar_feed_campanhas(12):
            dt_evento = row.get("DT_EVENTO")
            eventos.append(
                {
                    "id_evento": f"campanha:{row.get('ID_CAMPANHA_PREMIO')}",
                    "tipo": "campanha",
                    "badge": "Campanha",
                    "titulo": f"{row.get('NM_COLABORADOR') or 'Operador'} venceu uma campanha",
                    "descricao": (
                        f"{row.get('NM_CAMPANHA') or 'Campanha'} • "
                        f"{int(row.get('QTD_PACOTES') or 0)} pacote(s) com "
                        f"{int(row.get('QTD_FIGURINHAS_POR_PACOTE') or 0)} figurinha(s)"
                    ),
                    "dt_evento": self._to_iso(dt_evento),
                    "_dt_sort": dt_evento or datetime.min,
                }
            )

        for row in self.repo.listar_feed_duelos_ativos(12):
            dt_evento = row.get("DT_EVENTO")
            tp_metrica = str(row.get("TP_METRICA_DUELO") or "ACORDOS").strip().upper()
            label_metrica = "PP" if tp_metrica == "PP" else "acordos"
            eventos.append(
                {
                    "id_evento": f"duelo_ativo:{row.get('ID_DUELO_DIARIO')}",
                    "tipo": "duelo_ativo",
                    "badge": "Duelo",
                    "titulo": (
                        f"{row.get('NM_DESAFIANTE') or 'Operador'} e "
                        f"{row.get('NM_DESAFIADO') or 'operador'} estão em um duelo de {label_metrica}"
                    ),
                    "descricao": f"Meta combinada de {int(row.get('QTD_META_ACORDOS') or 0)} {label_metrica} no dia",
                    "dt_evento": self._to_iso(dt_evento),
                    "_dt_sort": dt_evento or datetime.min,
                }
            )

        for row in self.repo.listar_feed_duelos_vencidos(12):
            dt_evento = row.get("DT_EVENTO")
            eventos.append(
                {
                    "id_evento": f"duelo_vencido:{row.get('ID_DUELO_DIARIO')}",
                    "tipo": "duelo_vencido",
                    "badge": "Vitória",
                    "titulo": (
                        f"{row.get('NM_VENCEDOR') or 'Operador'} venceu o duelo contra "
                        f"{row.get('NM_PERDEDOR') or 'operador'}"
                    ),
                    "descricao": "Ganhou 2 pacotes com 5 figurinhas.",
                    "dt_evento": self._to_iso(dt_evento),
                    "_dt_sort": dt_evento or datetime.min,
                }
            )

        for row in self.repo.listar_feed_streak_duelos(8):
            dt_evento = row.get("DT_EVENTO")
            streak = int(row.get("NR_STREAK_VITORIAS_VENCEDOR") or 0)
            eventos.append(
                {
                    "id_evento": f"duelo_streak:{row.get('ID_DUELO_DIARIO')}",
                    "tipo": "duelo_streak",
                    "badge": "Foguinho",
                    "titulo": (
                        f"{row.get('NM_VENCEDOR') or 'Operador'} está há "
                        f"{streak} duelos sem perder"
                    ),
                    "descricao": "Sequência acesa nos duelos diários de acordos.",
                    "dt_evento": self._to_iso(dt_evento),
                    "_dt_sort": dt_evento or datetime.min,
                }
            )

        eventos.sort(key=lambda item: item.get("_dt_sort") or datetime.min, reverse=True)
        eventos = eventos[:40]

        reacoes_habilitadas = self.repo.feed_reacoes_habilitadas()
        reacoes_por_evento = (
            self.repo.listar_reacoes_feed(
                [str(item["id_evento"]) for item in eventos],
                id_usuario,
            )
            if eventos and reacoes_habilitadas
            else {}
        )

        for item in eventos:
            reacoes = reacoes_por_evento.get(
                str(item["id_evento"]),
                {"like": 0, "love": 0, "clap": 0, "minha_reacao": None},
            )
            item["reacoes"] = {
                "like": int(reacoes.get("like") or 0),
                "love": int(reacoes.get("love") or 0),
                "clap": int(reacoes.get("clap") or 0),
            }
            item["minha_reacao"] = reacoes.get("minha_reacao")
            item["pode_reagir"] = reacoes_habilitadas
            item.pop("_dt_sort", None)

        return {
            "reacoes_habilitadas": reacoes_habilitadas,
            "eventos": eventos,
        }

    def obter_estado(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        id_usuario = usuario["ID_USUARIO"]
        modo_admin_album = self._usuario_modo_admin_album(usuario)
        usuario_operador_album = self._usuario_eh_operador_album(usuario)
        metas_habilitadas = not modo_admin_album

        if metas_habilitadas:
            metas_rows = [
                row
                for row in self.repo.listar_metas_usuario(id_usuario)
                if self._meta_disponivel_para_operador(row, usuario)
            ]
            metas_rows = self._apurar_metas_usuario(usuario, metas_rows)
            metas_rows = [self._ajustar_meta_visual_contexto(usuario, row) for row in metas_rows]
            self.repo.sincronizar_metas_usuario_e_pacotes(id_usuario, metas_rows)
        else:
            metas_rows = []

        equipes_rows = self.repo.listar_equipes()
        figurinhas_rows = self.repo.listar_figurinhas_usuario(id_usuario)
        if metas_habilitadas:
            metas_rows = [
                row
                for row in self.repo.listar_metas_usuario(id_usuario)
                if self._meta_disponivel_para_operador(row, usuario)
            ]
            metas_rows = self._apurar_metas_usuario(usuario, metas_rows)
            metas_rows = [self._ajustar_meta_visual_contexto(usuario, row) for row in metas_rows]
        pacotes_rows = self.repo.listar_pacotes_usuario(id_usuario)

        equipes = [
            {
                "id": str(row["ID_EQUIPE"]),
                "nome": row.get("NM_EQUIPE") or "",
                "sigla": row.get("SG_EQUIPE") or "",
                "ordem_exibicao": int(row.get("ORDEM_EXIBICAO") or 0),
                "raridade": self._normalizar_raridade(row.get("NM_RARIDADE")),
                "cor_hex": row.get("COR_HEX"),
                "url_fundo_pagina": row.get("URL_FUNDO_PAGINA"),
                "slot_total": int(row.get("TOTAL_SLOTS") or 0),
            }
            for row in equipes_rows
        ]

        figurinhas = [self._mapear_figurinha(row) for row in figurinhas_rows]
        conquistas = self._montar_conquistas_usuario(id_usuario, figurinhas_rows)
        self._sincronizar_recompensas_aurora(id_usuario, conquistas, figurinhas_rows)
        carteira = self._montar_carteira_aurora(id_usuario)
        loja = self._montar_loja_aurora(carteira["saldo_atual"], id_usuario)
        pacote_misterioso = self._montar_pacote_misterioso(id_usuario, usuario)
        duelos = self._montar_duelos_usuario(usuario)
        leiloes = self._montar_leiloes_album(id_usuario)
        olheiros = self._montar_olheiros_album(id_usuario)
        feed = self._montar_feed_album(id_usuario)
        checkin_diario = (
            self.repo.obter_checkin_diario_album(
                id_usuario,
                nome_pacote_diario=ALBUM_CHECKIN_NOME_PACOTE,
                qtd_pacotes_diarios=ALBUM_CHECKIN_PACOTES_DIARIOS,
            )
            if modo_admin_album
            else {
                "habilitado": False,
                "resgatado_hoje": False,
                "streak_atual": 0,
                "proxima_sequencia": 1,
                "pacotes_diarios": 0,
                "figurinhas_por_pacote": 0,
                "bonus_proximo": [],
            }
        )

        pacotes = [self._mapear_pacote(row) for row in pacotes_rows]

        trocas_habilitadas = self.repo.trocas_habilitadas()
        repetidas = []
        operadores_troca = []
        solicitacoes_recebidas = []
        solicitacoes_enviadas = []

        if trocas_habilitadas:
            repetidas = [
                self._mapear_repetida(row)
                for row in self.repo.listar_repetidas_usuario(id_usuario)
            ]
            operadores_troca = [
                {
                    "cpf": row.get("CPF_COLABORADOR"),
                    "nome": row.get("NM_COLABORADOR") or "",
                    "supervisor": row.get("SUPERVISOR") or "",
                    "total_figurinhas_repetidas": int(row.get("TOTAL_FIGURINHAS_REPETIDAS") or 0),
                    "total_unidades_repetidas": int(row.get("TOTAL_UNIDADES_REPETIDAS") or 0),
                }
                for row in self.repo.listar_operadores_com_repetidas(id_usuario)
            ]
            solicitacoes_rows = self.repo.listar_solicitacoes_troca_usuario(id_usuario)
            solicitacoes = [self._mapear_solicitacao_troca(row) for row in solicitacoes_rows]
            solicitacoes_recebidas = [
                item for item in solicitacoes if item["destinatario"]["cpf"] == id_usuario
            ]
            solicitacoes_enviadas = [
                item for item in solicitacoes if item["solicitante"]["cpf"] == id_usuario
            ]

        metas = [
            {
                "id": str(row["ID_META"]),
                "titulo": row.get("NM_META") or "",
                "tipo": row.get("TP_META") or "",
                "frequencia": self._normalizar_frequencia(row.get("FREQUENCIA")),
                "atual": float(row.get("VL_APURADO") or 0),
                "alvo": float(row.get("VL_ALVO") or 0),
                "unidade": row.get("UNIDADE") or "",
                "pacoteQtd": int(row.get("QTD_PACOTES") or 0),
                "figurinhasPorPacote": int(row.get("QTD_FIGURINHAS_POR_PACOTE") or 0),
                "concluida": bool(row.get("FL_BATEU_META")),
                "premioGerado": bool(row.get("FL_PREMIO_GERADO")),
                "referenciaInicio": row.get("DT_REFERENCIA_INICIO").isoformat() if row.get("DT_REFERENCIA_INICIO") else None,
                "referenciaFim": row.get("DT_REFERENCIA_FIM").isoformat() if row.get("DT_REFERENCIA_FIM") else None,
            }
            for row in metas_rows
        ]

        total_figurinhas = len(figurinhas)
        desbloqueadas = len([f for f in figurinhas if f["desbloqueada"]])

        return {
            "modo": "admin" if modo_admin_album else "operador",
            "metas_habilitadas": metas_habilitadas,
            "checkin_diario": checkin_diario,
            "usuario": {
                "id_usuario": id_usuario,
                "cpf": usuario.get("CPF_COLABORADOR"),
                "nome": usuario.get("NM_COLABORADOR"),
                "funcao": usuario.get("FUNCAO_COLABORADOR") or "",
                "operador_album": usuario_operador_album,
            },
            "album": {
                "equipes": equipes,
                "figurinhas": figurinhas,
                "total_figurinhas": total_figurinhas,
                "desbloqueadas": desbloqueadas,
            },
            "metas": metas,
            "pacotes": pacotes,
            "carteira": carteira,
            "loja": loja,
            "pacote_misterioso": pacote_misterioso,
            "duelos": duelos,
            "leiloes": leiloes,
            "olheiros": olheiros,
            "conquistas": conquistas,
            "feed": feed,
            "trocas": {
                "habilitado": trocas_habilitadas,
                "repetidas": repetidas,
                "operadores": operadores_troca,
                "solicitacoes_recebidas": solicitacoes_recebidas,
                "solicitacoes_enviadas": solicitacoes_enviadas,
            },
        }

    def listar_repetidas_operador(self, cpf_colaborador: str, cpf_operador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        if not self.repo.trocas_habilitadas():
            raise RuntimeError(
                "Estrutura de trocas não encontrada no banco. Execute o script backend/sql/album_trocas.sql."
            )

        operador = self.repo.buscar_usuario_album(cpf_operador)
        if not operador:
            raise ValueError("Operador não encontrado em login.TB_USUARIOS")

        repetidas = [
            self._mapear_repetida(row)
            for row in self.repo.listar_repetidas_usuario(operador["ID_USUARIO"])
        ]
        faltantes = [
            self._mapear_repetida(row)
            for row in self.repo.listar_figurinhas_faltantes_usuario(operador["ID_USUARIO"])
        ]

        return {
            "operador": {
                "cpf": operador.get("CPF_COLABORADOR"),
                "nome": operador.get("NM_COLABORADOR") or "",
            },
            "repetidas": repetidas,
            "faltantes": faltantes,
        }

    def listar_leiloes_album(self, cpf_colaborador: str, termo: str | None = None):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        if not self.repo.leiloes_habilitados():
            raise RuntimeError(
                "Estrutura de leilao nao encontrada no banco. Execute o script backend/sql/album_leilao.sql."
            )

        rows = self.repo.listar_leiloes_album(usuario["ID_USUARIO"], termo=termo)
        leiloes = [self._mapear_leilao(row, incluir_lances=True) for row in rows]
        return {
            "habilitado": True,
            "duracao_segundos": ALBUM_LEILAO_DURACAO_SEGUNDOS,
            "incremento_minimo": ALBUM_LEILAO_INCREMENTO_MINIMO,
            "leiloes": [item for item in leiloes if item["status"] == "ATIVO"],
            "meus_anuncios": [item for item in leiloes if item["meu_anuncio"]],
            "meus_lances": [item for item in leiloes if item["meu_lance"]],
        }

    def criar_leilao_album(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        id_figurinha = str(data.get("id_figurinha") or "").strip()
        valor_inicial = self._to_int(data.get("valor_inicial"), 0)
        valor_compre_ja_raw = data.get("valor_compre_ja")
        valor_compre_ja = (
            self._to_int(valor_compre_ja_raw, 0)
            if valor_compre_ja_raw not in {None, ""}
            else None
        )

        if not id_figurinha:
            raise ValueError("Informe a figurinha que sera anunciada")
        if valor_inicial <= 0:
            raise ValueError("O valor inicial precisa ser maior que zero")
        if valor_compre_ja is not None and valor_compre_ja <= valor_inicial:
            raise ValueError("O valor de Compre ja precisa ser maior que o valor inicial")

        id_leilao = self.repo.criar_leilao_album(
            id_usuario=usuario["ID_USUARIO"],
            id_figurinha=id_figurinha,
            valor_inicial=valor_inicial,
            valor_compre_ja=valor_compre_ja,
        )
        return {
            "id_leilao": id_leilao,
            "leiloes": self.listar_leiloes_album(cpf_colaborador),
        }

    def avaliar_mercado_leilao_album(self, cpf_colaborador: str, id_figurinha: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        id_figurinha = str(id_figurinha or "").strip()
        if not id_figurinha:
            raise ValueError("Informe a figurinha para avaliar")

        avaliacao = self.repo.avaliar_mercado_leilao(id_figurinha)
        if not avaliacao:
            raise ValueError("Figurinha nao encontrada")
        return avaliacao

    def dar_lance_leilao_album(self, cpf_colaborador: str, id_leilao: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        valor_lance = self._to_int(data.get("valor_lance"), 0)
        if valor_lance <= 0:
            raise ValueError("Informe um valor de lance valido")

        resultado = self.repo.dar_lance_leilao_album(
            id_usuario=usuario["ID_USUARIO"],
            id_leilao=id_leilao,
            valor_lance=valor_lance,
        )
        return {
            **resultado,
            "leiloes": self.listar_leiloes_album(cpf_colaborador),
        }

    def comprar_agora_leilao_album(self, cpf_colaborador: str, id_leilao: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        resultado = self.repo.comprar_agora_leilao_album(
            id_usuario=usuario["ID_USUARIO"],
            id_leilao=id_leilao,
        )
        return {
            **resultado,
            "leiloes": self.listar_leiloes_album(cpf_colaborador),
        }

    def atualizar_olheiros_album(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        self.repo.atualizar_ofertas_olheiro(
            usuario["ID_USUARIO"],
            custo_coins=ALBUM_OLHEIRO_ATUALIZAR_CUSTO,
        )
        return {
            "olheiros": self._montar_olheiros_album(usuario["ID_USUARIO"]),
            "estado": self.obter_estado(cpf_colaborador),
        }

    def iniciar_missao_olheiro_album(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        id_oferta = str(data.get("id_oferta") or "").strip()
        tempo = str(data.get("tempo") or "equilibrada").strip()
        destino = str(data.get("destino") or "mexico").strip()

        if not id_oferta:
            raise ValueError("Informe o olheiro que sera enviado")
        if tempo not in ALBUM_OLHEIRO_TEMPOS:
            raise ValueError("Tempo de missao invalido")
        if destino not in ALBUM_OLHEIRO_DESTINOS:
            raise ValueError("Destino de missao invalido")

        id_missao = self.repo.iniciar_missao_olheiro(
            id_usuario=usuario["ID_USUARIO"],
            id_oferta=id_oferta,
            tempo=tempo,
            destino=destino,
            duracao_minutos=ALBUM_OLHEIRO_TEMPOS[tempo]["minutos"],
        )
        return {
            "id_missao": id_missao,
            "olheiros": self._montar_olheiros_album(usuario["ID_USUARIO"]),
            "estado": self.obter_estado(cpf_colaborador),
        }

    def resgatar_missao_olheiro_album(self, cpf_colaborador: str, id_missao: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        estado_olheiros = self._montar_olheiros_album(usuario["ID_USUARIO"])
        missao = next(
            (item for item in estado_olheiros.get("missoes", []) if item["id"] == str(id_missao)),
            None,
        )
        if not missao:
            raise ValueError("Missao de olheiro nao encontrada")

        perfil = self._perfil_retorno_olheiro(
            missao["olheiro"]["raridade"],
            missao["tempo"],
            missao["destino"],
        )
        id_pacote = self.repo.resgatar_missao_olheiro(
            usuario["ID_USUARIO"],
            id_missao,
            perfil,
        )
        return {
            "id_pacote": id_pacote,
            "estado": self.obter_estado(cpf_colaborador),
        }

    def obter_ranking_album(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        ranking_rows = self.repo.listar_ranking_album(50)
        ranking = [
            {
                "posicao": int(row.get("POSICAO") or (index + 1)),
                "cpf": row.get("CPF_COLABORADOR"),
                "nome": self._apelido_ranking(int(row.get("POSICAO") or (index + 1))),
                "carteira": row.get("CARTEIRA") or "",
                "total_figurinhas": int(row.get("TOTAL_FIGURINHAS") or 0),
                "total_obtidas": int(row.get("TOTAL_OBTIDAS") or 0),
            }
            for index, row in enumerate(ranking_rows)
        ]

        minha_posicao_row = self.repo.buscar_posicao_ranking_album(usuario["ID_USUARIO"])
        meu_ranking = None
        if minha_posicao_row:
            minha_posicao = int(minha_posicao_row.get("POSICAO") or 0)
            esta_no_top_50 = any(
                entry["cpf"] == usuario["ID_USUARIO"]
                for entry in ranking
            )
            if not esta_no_top_50:
                meu_ranking = {
                    "posicao": minha_posicao,
                    "cpf": minha_posicao_row.get("CPF_COLABORADOR"),
                    "nome": self._apelido_ranking(minha_posicao),
                    "carteira": minha_posicao_row.get("CARTEIRA") or "",
                    "total_figurinhas": int(minha_posicao_row.get("TOTAL_FIGURINHAS") or 0),
                    "total_obtidas": int(minha_posicao_row.get("TOTAL_OBTIDAS") or 0),
                }

        return {
            "usuario": {
                "cpf": usuario.get("CPF_COLABORADOR"),
                "nome": usuario.get("NM_COLABORADOR"),
            },
            "ranking": ranking,
            "meu_ranking": meu_ranking,
        }

    def obter_detalhe_ranking_operador(self, cpf_colaborador: str, cpf_operador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        operador = self.repo.buscar_usuario_album(cpf_operador)
        if not operador:
            raise ValueError("Operador não encontrado em login.TB_USUARIOS")

        posicao_row = self.repo.buscar_posicao_ranking_album(operador["ID_USUARIO"])
        posicao = int(posicao_row.get("POSICAO") or 0) if posicao_row else 0
        figurinhas_rows = self.repo.listar_figurinhas_operador_ranking(operador["ID_USUARIO"])
        figurinhas = [self._mapear_figurinha(row) for row in figurinhas_rows]
        conquistas = self._montar_conquistas_usuario(operador["ID_USUARIO"])

        return {
            "operador": {
                "cpf": operador.get("CPF_COLABORADOR"),
                "nome": self._apelido_ranking(posicao) if posicao > 0 else "Operador",
                "posicao": posicao,
                "carteira": operador.get("CENTRO_CUSTO") or "",
                "total_figurinhas": len(figurinhas),
                "total_obtidas": sum(int(fig.get("qtd_total") or 0) for fig in figurinhas),
            },
            "conquistas": conquistas,
            "figurinhas": figurinhas,
        }

    def reagir_evento_feed(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        id_evento = str(data.get("id_evento") or "").strip()
        tipo_reacao = str(data.get("tipo_reacao") or "").strip().lower()

        if not id_evento:
            raise ValueError("Evento do feed não informado")

        if tipo_reacao not in {"like", "love", "clap"}:
            raise ValueError("Tipo de reação inválido")

        reacoes = self.repo.alternar_reacao_feed(
            id_evento=id_evento,
            id_usuario=usuario["ID_USUARIO"],
            tipo_reacao=tipo_reacao,
        )

        return {
            "id_evento": id_evento,
            "reacoes": {
                "like": int(reacoes.get("like") or 0),
                "love": int(reacoes.get("love") or 0),
                "clap": int(reacoes.get("clap") or 0),
            },
            "minha_reacao": reacoes.get("minha_reacao"),
        }

    def criar_duelo_diario(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        if not self.repo.duelos_habilitados():
            raise RuntimeError(
                "Estrutura de duelos não encontrada no banco. Execute o script backend/sql/album_duelos.sql."
            )

        meta_acordos = int(data.get("meta_acordos") or 0)
        participantes_meu_time = [str(cpf).strip() for cpf in (data.get("participantes_meu_time") or []) if str(cpf).strip()]
        participantes_time_oponente = [
            str(cpf).strip() for cpf in (data.get("participantes_time_oponente") or []) if str(cpf).strip()
        ]
        cpf_desafiado = str(data.get("cpf_desafiado") or "").strip()

        if not participantes_meu_time:
            participantes_meu_time = [str(usuario["ID_USUARIO"])]
        if str(usuario["ID_USUARIO"]) not in participantes_meu_time:
            participantes_meu_time.insert(0, str(usuario["ID_USUARIO"]))
        participantes_meu_time = list(dict.fromkeys(participantes_meu_time))

        if not participantes_time_oponente and cpf_desafiado:
            participantes_time_oponente = [cpf_desafiado]
        participantes_time_oponente = list(dict.fromkeys(participantes_time_oponente))

        if not participantes_time_oponente:
            raise ValueError("Selecione o time adversário do duelo")

        tamanho_time = len(participantes_meu_time)
        if len(participantes_time_oponente) != tamanho_time:
            raise ValueError("Os dois times precisam ter a mesma quantidade de participantes")
        if tamanho_time > DUEL_TIME_MAXIMO:
            raise ValueError(f"Cada time pode ter no máximo {DUEL_TIME_MAXIMO} operadores")
        if tamanho_time > 1 and tamanho_time < DUEL_TIME_MINIMO:
            raise ValueError(f"O duelo em grupo precisa ter pelo menos {DUEL_TIME_MINIMO} operadores por time")
        if set(participantes_meu_time) & set(participantes_time_oponente):
            raise ValueError("Um operador não pode participar dos dois times no mesmo duelo")

        meta_minima = DUEL_GROUP_META_MINIMA if tamanho_time > 1 else DUEL_META_MINIMA
        meta_maxima = DUEL_GROUP_META_MAXIMA if tamanho_time > 1 else DUEL_META_MAXIMA
        if meta_acordos < meta_minima or meta_acordos > meta_maxima:
            raise ValueError(f"A meta do duelo precisa ficar entre {meta_minima} e {meta_maxima}")

        meu_time = []
        for cpf_operador in participantes_meu_time:
            operador = self.repo.buscar_usuario_album(cpf_operador)
            if not operador:
                raise ValueError("Um operador do seu time não foi encontrado")
            meu_time.append(operador)

        time_oponente = []
        for cpf_operador in participantes_time_oponente:
            operador = self.repo.buscar_usuario_album(cpf_operador)
            if not operador:
                raise ValueError("Um operador do time adversário não foi encontrado")
            time_oponente.append(operador)

        desafiado = time_oponente[0]

        centro_origem = str(usuario.get("CENTRO_CUSTO") or "").strip()
        for operador in [*meu_time, *time_oponente]:
            centro_destino = str(operador.get("CENTRO_CUSTO") or "").strip()
            if centro_origem != centro_destino:
                raise ValueError("O duelo só pode acontecer entre operadores do mesmo centro de custo")

        duelo_config = self._duelo_configuracao_operador(usuario)
        hoje = date.today()
        participantes_repo_desafiante = []
        participantes_repo_desafiado = []
        base_desafiante = 0
        base_desafiado = 0

        def _baseline_acordos(operador: dict):
            producao = self.repo.listar_producao_usuario_periodo(
                operador["ID_USUARIO"],
                hoje,
                hoje,
                operador.get("NM_COLABORADOR"),
            )
            return len({str(row.get("ID_ACORDO")) for row in producao if row.get("ID_ACORDO") is not None})

        if duelo_config["codigo"] == "PP":
            for operador in meu_time:
                baseline = (
                    self.repo.obter_resultado_vega_data(
                        operador["ID_USUARIO"],
                        hoje,
                        operador.get("NM_COLABORADOR"),
                    )
                    or {}
                )
                qtd = int(baseline.get("QTD_PP") or 0)
                participantes_repo_desafiante.append(
                    {"id_usuario": operador["ID_USUARIO"], "vl_base_metrica": qtd}
                )
                base_desafiante += qtd

            for operador in time_oponente:
                baseline = (
                    self.repo.obter_resultado_vega_data(
                        operador["ID_USUARIO"],
                        hoje,
                        operador.get("NM_COLABORADOR"),
                    )
                    or {}
                )
                qtd = int(baseline.get("QTD_PP") or 0)
                participantes_repo_desafiado.append(
                    {"id_usuario": operador["ID_USUARIO"], "vl_base_metrica": qtd}
                )
                base_desafiado += qtd
        else:
            for operador in meu_time:
                qtd = _baseline_acordos(operador)
                participantes_repo_desafiante.append(
                    {"id_usuario": operador["ID_USUARIO"], "vl_base_metrica": qtd}
                )
                base_desafiante += qtd

            for operador in time_oponente:
                qtd = _baseline_acordos(operador)
                participantes_repo_desafiado.append(
                    {"id_usuario": operador["ID_USUARIO"], "vl_base_metrica": qtd}
                )
                base_desafiado += qtd

        self.repo.criar_duelo_diario(
            id_usuario_desafiante=usuario["ID_USUARIO"],
            id_usuario_desafiado=desafiado["ID_USUARIO"],
            centro_custo=centro_origem,
            tp_metrica_duelo=duelo_config["codigo"],
            qtd_meta_acordos=meta_acordos,
            vl_base_desafiante=base_desafiante,
            vl_base_desafiado=base_desafiado,
            participantes_desafiante=participantes_repo_desafiante,
            participantes_desafiado=participantes_repo_desafiado,
        )
        return self.obter_estado(cpf_colaborador)

    def responder_duelo_diario(self, cpf_colaborador: str, id_duelo: str, acao: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        if not self.repo.duelos_habilitados():
            raise RuntimeError(
                "Estrutura de duelos não encontrada no banco. Execute o script backend/sql/album_duelos.sql."
            )

        self.repo.responder_duelo_diario(usuario["ID_USUARIO"], id_duelo, acao)
        return self.obter_estado(cpf_colaborador)

    def listar_eventos_album(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        self._apurar_eventos_album_encerrados()

        id_usuario = str(usuario["ID_USUARIO"])
        lembretes_habilitados = self.repo.eventos_lembretes_habilitados()
        if lembretes_habilitados:
            lembretes = {
                str(row.get("ID_EVENTO"))
                for row in self.repo.listar_lembretes_eventos_usuario(id_usuario)
                if row.get("ID_EVENTO")
            }
        else:
            lembretes = {
                id_evento
                for usuario_id, id_evento in ALBUM_EVENTOS_LEMBRETES_MEMORIA
                if usuario_id == id_usuario
            }

        agora = datetime.now()
        eventos = [
            self._mapear_evento_album(evento, lembretes, agora)
            for evento in self._eventos_album_db_ou_config()
        ]
        proximo_evento = next(
            (evento for evento in eventos if evento["status"] in {"live", "upcoming"}),
            None,
        )
        return {
            "eventos": eventos,
            "proximo_evento": proximo_evento,
            "lembretes_habilitados": lembretes_habilitados,
            "eventos_habilitados": self.repo.eventos_album_habilitados(),
            "pode_criar_evento": self._usuario_pode_criar_evento_album(usuario),
            "figurinhas_premio": self._figurinhas_premio_evento(usuario),
            "ultimos_ganhadores": self._eventos_album_ultimos_ganhadores(),
            "movimentos_recentes": self._eventos_album_movimentos_recentes(),
        }

    def _figurinhas_premio_evento(self, usuario: dict | None):
        if not self._usuario_pode_criar_evento_album(usuario):
            return []
        return [
            {
                "id_figurinha": str(row.get("ID_FIGURINHA")),
                "nome": row.get("NM_FIGURINHA") or "Figurinha",
                "equipe": row.get("NM_EQUIPE") or "",
                "raridade": row.get("NM_RARIDADE") or "",
            }
            for row in self.repo.listar_figurinhas_premio_evento()
        ]

    def criar_evento_album(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")
        if not self._usuario_pode_criar_evento_album(usuario):
            raise PermissionError("Apenas o Centro de Custo Desenvolvimento pode criar eventos")
        if not self.repo.eventos_album_habilitados():
            raise RuntimeError(
                "Estrutura de eventos nao encontrada no banco. Execute o script backend/sql/album_eventos.sql."
            )

        titulo = str(data.get("titulo") or "").strip()
        destaque = str(data.get("destaque") or titulo).strip()
        descricao = str(data.get("descricao") or "").strip()
        premio_normalizado = self._normalizar_premio_evento(data)
        premio = str(data.get("premio") or premio_normalizado["texto"]).strip()
        tp_evento = str(data.get("type") or data.get("tp_evento") or "penalty").strip().lower()
        cor = str(data.get("cor") or "gold").strip().lower()
        if tp_evento != "penalty":
            raise ValueError("Tipo de evento invalido")
        if cor not in {"gold", "green", "purple"}:
            raise ValueError("Cor do evento invalida")
        if not titulo or not destaque or not descricao or not premio:
            raise ValueError("Preencha titulo, destaque, descricao e premio")

        try:
            dt_inicio = datetime.fromisoformat(str(data.get("inicio") or ""))
            dt_fim = datetime.fromisoformat(str(data.get("fim") or ""))
        except ValueError as exc:
            raise ValueError("Datas do evento invalidas") from exc
        if dt_fim <= dt_inicio:
            raise ValueError("A data final deve ser maior que a data inicial")

        participantes_premiados = max(1, min(500, self._to_int(data.get("participantes_premiados"), 50)))
        detalhes = data.get("detalhes")
        if isinstance(detalhes, str):
            detalhes_lista = [item.strip() for item in detalhes.splitlines() if item.strip()]
        elif isinstance(detalhes, list):
            detalhes_lista = [str(item).strip() for item in detalhes if str(item).strip()]
        else:
            detalhes_lista = []

        id_evento = str(data.get("id") or data.get("id_evento") or "").strip()
        if not id_evento:
            slug = re.sub(r"[^a-z0-9]+", "-", normalizar_texto(titulo)).strip("-")
            id_evento = f"{slug or 'evento'}-{dt_inicio.strftime('%Y%m%d%H%M')}"
        id_evento = id_evento[:100]

        if self.repo.evento_album_existe(id_evento):
            raise ValueError("Ja existe um evento com esse ID")

        self.repo.criar_evento_album(
            {
                "id_evento": id_evento,
                "tp_evento": tp_evento,
                "titulo": titulo[:120],
                "destaque": destaque[:120],
                "descricao": descricao[:500],
                "detalhes_json": json.dumps(detalhes_lista, ensure_ascii=False),
                "dt_inicio": dt_inicio,
                "dt_fim": dt_fim,
                "premio": premio[:180],
                "premio_config_json": json.dumps(premio_normalizado["config"], ensure_ascii=False),
                "participantes_premiados": participantes_premiados,
                "cor": cor,
                "url_imagem_hero": str(data.get("url_imagem_hero") or "").strip()[:500] or None,
                "url_imagem_card": str(data.get("url_imagem_card") or "").strip()[:500] or None,
            }
        )
        return self.listar_eventos_album(cpf_colaborador)

    def definir_lembrete_evento_album(self, cpf_colaborador: str, id_evento: str, ativo: bool):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        eventos = self._eventos_album_db_ou_config()
        if id_evento not in {evento["id"] for evento in eventos}:
            raise ValueError("Evento não encontrado")

        id_usuario = str(usuario["ID_USUARIO"])
        if self.repo.eventos_lembretes_habilitados():
            self.repo.definir_lembrete_evento(id_usuario, id_evento, ativo)
        else:
            chave = (id_usuario, id_evento)
            if ativo:
                ALBUM_EVENTOS_LEMBRETES_MEMORIA.add(chave)
            else:
                ALBUM_EVENTOS_LEMBRETES_MEMORIA.discard(chave)

        return self.listar_eventos_album(cpf_colaborador)

    def entrar_evento_album(self, cpf_colaborador: str, id_evento: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usu?rio n?o encontrado em login.TB_USUARIOS")
        if not self.repo.eventos_album_habilitados():
            raise RuntimeError(
                "Estrutura de eventos n?o encontrada no banco. Execute o script backend/sql/album_eventos.sql."
            )

        evento = self.repo.buscar_evento_album(id_evento)
        if not evento:
            raise ValueError("Evento n?o encontrado")

        agora = datetime.now()
        if agora < evento["DT_INICIO"]:
            raise ValueError("Evento ainda n?o come?ou")
        if agora > evento["DT_FIM"]:
            raise ValueError("Evento ja foi encerrado")

        id_usuario = str(usuario["ID_USUARIO"])
        participacao = self.repo.buscar_participacao_evento_album(id_evento, id_usuario)
        if participacao and participacao.get("STATUS_PARTICIPACAO") == "CONCLUIDO":
            return {
                "ja_participou": True,
                "participacao": self._mapear_participacao_evento(participacao),
                "ranking": self._ranking_evento_album(id_evento, id_usuario),
            }

        if not participacao and agora > evento["DT_FIM"]:
            raise ValueError("Evento ja foi encerrado")
        if not participacao:
            self.repo.iniciar_participacao_evento_album(
                id_evento=id_evento,
                id_usuario=id_usuario,
                nome=usuario.get("NM_COLABORADOR") or cpf_colaborador,
                area=usuario.get("CENTRO_CUSTO") or "Operacao",
            )
            participacao = self.repo.buscar_participacao_evento_album(id_evento, id_usuario)

        return {
            "ja_participou": False,
            "participacao": self._mapear_participacao_evento(participacao),
            "ranking": self._ranking_evento_album(id_evento, id_usuario),
        }

    def finalizar_evento_album(self, cpf_colaborador: str, id_evento: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usu?rio n?o encontrado em login.TB_USUARIOS")
        if not self.repo.eventos_album_habilitados():
            raise RuntimeError(
                "Estrutura de eventos n?o encontrada no banco. Execute o script backend/sql/album_eventos.sql."
            )

        evento = self.repo.buscar_evento_album(id_evento)
        if not evento:
            raise ValueError("Evento n?o encontrado")
        agora = datetime.now()
        if agora < evento["DT_INICIO"]:
            raise ValueError("Evento ainda nao comecou")

        id_usuario = str(usuario["ID_USUARIO"])
        participacao = self.repo.buscar_participacao_evento_album(id_evento, id_usuario)
        if participacao and participacao.get("STATUS_PARTICIPACAO") == "CONCLUIDO":
            raise ValueError("Voc? j? participou deste evento")
        limite_finalizacao = evento["DT_FIM"] + timedelta(minutes=10)
        if not participacao and agora > limite_finalizacao:
            raise ValueError("Evento ja foi encerrado")
        if not participacao:
            self.repo.iniciar_participacao_evento_album(
                id_evento=id_evento,
                id_usuario=id_usuario,
                nome=usuario.get("NM_COLABORADOR") or cpf_colaborador,
                area=usuario.get("CENTRO_CUSTO") or "Operacao",
            )

        chutes = data.get("chutes") if isinstance(data.get("chutes"), list) else []
        if len(chutes) != 5:
            raise ValueError("Finalize as 5 cobran?as para registrar o resultado")

        chutes_normalizados = []
        for chute in chutes:
            if not isinstance(chute, dict):
                raise ValueError("Resultado de chute invalido")
            chutes_normalizados.append(
                {
                    "zone": str(chute.get("zone") or ""),
                    "keeper": str(chute.get("keeper") or ""),
                    "goal": bool(chute.get("goal")),
                    "points": max(0, self._to_int(chute.get("points"), 0)),
                }
            )

        pontos = sum(chute["points"] for chute in chutes_normalizados)
        gols = sum(1 for chute in chutes_normalizados if chute["goal"])
        detalhes_json = json.dumps({"chutes": chutes_normalizados}, ensure_ascii=False)
        self.repo.finalizar_participacao_evento_album(
            id_evento=id_evento,
            id_usuario=id_usuario,
            pontos=pontos,
            gols=gols,
            total_chutes=len(chutes),
            detalhes_json=detalhes_json,
            chutes=chutes_normalizados,
        )
        participacao = self.repo.buscar_participacao_evento_album(id_evento, id_usuario)
        estado_eventos = self.listar_eventos_album(cpf_colaborador)
        return {
            "mensagem": "Resultado registrado com sucesso",
            "participacao": self._mapear_participacao_evento(participacao),
            "ranking": self._ranking_evento_album(id_evento, id_usuario),
            **estado_eventos,
        }

    def _mapear_participacao_evento(self, participacao: dict | None):
        if not participacao:
            return None
        return {
            "id_participacao": str(participacao.get("ID_PARTICIPACAO")),
            "id_evento": str(participacao.get("ID_EVENTO")),
            "pontos": self._to_int(participacao.get("PONTOS"), 0),
            "gols": self._to_int(participacao.get("GOLS"), 0),
            "total_chutes": self._to_int(participacao.get("TOTAL_CHUTES"), 0),
            "status": participacao.get("STATUS_PARTICIPACAO") or "EM_ANDAMENTO",
            "inicio": self._to_iso(participacao.get("DT_INICIO")),
            "fim": self._to_iso(participacao.get("DT_FIM")),
        }

    def _ranking_evento_album(self, id_evento: str, id_usuario: str):
        rows = self.repo.listar_ranking_evento_album(id_evento, 50)
        ranking = [
            {
                "posicao": self._to_int(row.get("POSICAO"), index + 1),
                "id_usuario": str(row.get("ID_USUARIO")),
                "nome": row.get("NM_USUARIO") or "Operador",
                "area": row.get("AREA") or "Operacao",
                "pontos": self._to_int(row.get("PONTOS"), 0),
                "gols": self._to_int(row.get("GOLS"), 0),
                "meu": str(row.get("ID_USUARIO")) == str(id_usuario),
            }
            for index, row in enumerate(rows)
        ]
        return {
            "itens": ranking,
            "minha_posicao": next((item["posicao"] for item in ranking if item["meu"]), None),
            "linha_corte": ranking[49]["pontos"] if len(ranking) >= 50 else 0,
        }

    def criar_solicitacao_troca(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        if not self.repo.trocas_habilitadas():
            raise RuntimeError(
                "Estrutura de trocas não encontrada no banco. Execute o script backend/sql/album_trocas.sql."
            )

        cpf_destinatario = str(data.get("cpf_destinatario") or "").strip()
        id_figurinha_oferecida = str(data.get("id_figurinha_oferecida") or "").strip()
        id_figurinha_desejada = str(data.get("id_figurinha_desejada") or "").strip()

        if not cpf_destinatario or not id_figurinha_oferecida or not id_figurinha_desejada:
            raise ValueError("Solicitação de troca incompleta")

        destinatario = self.repo.buscar_usuario_album(cpf_destinatario)
        if not destinatario:
            raise ValueError("Destinatário da troca não encontrado")

        self.repo.criar_solicitacao_troca(
            usuario["ID_USUARIO"],
            destinatario["ID_USUARIO"],
            id_figurinha_oferecida,
            id_figurinha_desejada,
        )

        return self.obter_estado(cpf_colaborador)

    def responder_solicitacao_troca(self, cpf_colaborador: str, id_troca: str, acao: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        if not self.repo.trocas_habilitadas():
            raise RuntimeError(
                "Estrutura de trocas não encontrada no banco. Execute o script backend/sql/album_trocas.sql."
            )

        self.repo.responder_solicitacao_troca(usuario["ID_USUARIO"], id_troca, acao)
        return self.obter_estado(cpf_colaborador)

    def abrir_pacote(self, cpf_colaborador: str, id_pacote: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        self.repo.abrir_pacote(usuario["ID_USUARIO"], id_pacote)
        estado = self.obter_estado(cpf_colaborador)

        pacote_aberto = next(
            (pacote for pacote in estado["pacotes"] if pacote["id"] == id_pacote),
            None,
        )

        return {
            "mensagem": "Pacote aberto com sucesso",
            "pacote": pacote_aberto,
            "estado": estado,
        }

    def resgatar_checkin_diario(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usu?rio n?o encontrado em login.TB_USUARIOS")

        if not self._usuario_modo_admin_album(usuario):
            raise ValueError("Check-in di?rio dispon?vel apenas para perfis administrativos")

        resultado = self.repo.resgatar_checkin_diario_album(
            id_usuario=usuario["ID_USUARIO"],
            nome_pacote="Presen?a Di?ria",
            qtd_pacotes=ALBUM_CHECKIN_PACOTES_DIARIOS,
            qtd_figurinhas_por_pacote=ALBUM_CHECKIN_FIGURINHAS_POR_PACOTE,
        )
        estado = self.obter_estado(cpf_colaborador)

        return {
            "mensagem": "Check-in di?rio resgatado com sucesso",
            "checkin": resultado,
            "estado": estado,
        }

    def obter_spoiler_album(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usu?rio n?o encontrado em login.TB_USUARIOS")

        if self._usuario_modo_admin_album(usuario):
            return {
                "habilitado": False,
                "ja_abriu": True,
                "deve_exibir": False,
                "leitura_confirmada": True,
                "id_pacote": None,
            }

        return self.repo.obter_spoiler_album(usuario["ID_USUARIO"])

    def resgatar_spoiler_album(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usu?rio n?o encontrado em login.TB_USUARIOS")

        if self._usuario_modo_admin_album(usuario):
            raise ValueError("Spoiler dispon?vel apenas para operadores")

        id_usuario = usuario["ID_USUARIO"]
        id_pacote = self.repo.preparar_pacote_spoiler_album(id_usuario)
        self.repo.abrir_pacote(id_usuario, id_pacote)
        self.repo.marcar_spoiler_album_aberto(id_usuario, id_pacote)
        estado = self.obter_estado(cpf_colaborador)
        pacote_aberto = next(
            (pacote for pacote in estado["pacotes"] if str(pacote["id"]) == str(id_pacote)),
            None,
        )

        return {
            "mensagem": "Pacote spoiler aberto com sucesso",
            "pacote": pacote_aberto,
            "estado": estado,
        }

    def registrar_feedback_spoiler_album(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usu?rio n?o encontrado em login.TB_USUARIOS")

        if self._usuario_modo_admin_album(usuario):
            raise ValueError("Feedback do spoiler dispon?vel apenas para operadores")

        gostou = data.get("gostou")
        if not isinstance(gostou, bool):
            raise ValueError("Informe se gostou usando true ou false")

        feedback = str(data.get("feedback") or "").strip()
        assunto = str(data.get("assunto") or "").strip()[:50] or None
        total_paginas = data.get("total_paginas")
        try:
            total_paginas = int(total_paginas) if total_paginas is not None else None
        except (TypeError, ValueError):
            total_paginas = None

        self.repo.registrar_feedback_spoiler_album(
            id_usuario=usuario["ID_USUARIO"],
            nome_operador=usuario.get("NM_COLABORADOR"),
            carteira=usuario.get("CENTRO_CUSTO"),
            gostou=gostou,
            feedback=feedback,
            total_paginas=total_paginas,
            assunto=assunto,
        )

        return {"mensagem": "Feedback registrado com sucesso"}

    def resgatar_loja_aurora(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuário não encontrado em login.TB_USUARIOS")

        if not self.repo.moedas_habilitadas():
            raise RuntimeError(
                "Estrutura de moedas não encontrada no banco. Execute o script backend/sql/album_aurora_coins.sql."
            )

        oferta_id = str(data.get("oferta_id") or "").strip()
        oferta = next((item for item in AURORA_SHOP_OFFERS if item["id"] == oferta_id), None)
        if not oferta:
            raise ValueError("Oferta da loja não encontrada")

        compra = self.repo.resgatar_pacote_loja(
            id_usuario=usuario["ID_USUARIO"],
            oferta_id=oferta["id"],
            nome_oferta=oferta["nome"],
            custo_coins=int(oferta["custo_coins"]),
            qtd_pacotes=int(oferta["qtd_pacotes"]),
            qtd_figurinhas_por_pacote=int(oferta["qtd_figurinhas_por_pacote"]),
            perfis_raridade=oferta.get("perfis_raridade"),
        )
        estado = self.obter_estado(cpf_colaborador)

        return {
            "compra": compra,
            "estado": estado,
        }

    def vender_repetidas_rapido(self, cpf_colaborador: str, data: dict):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usuario nao encontrado em login.TB_USUARIOS")

        if not self.repo.moedas_habilitadas():
            raise RuntimeError(
                "Estrutura de moedas nao encontrada no banco. Execute o script backend/sql/album_aurora_coins.sql."
            )

        itens = data.get("itens") or []
        if not isinstance(itens, list) or not itens:
            raise ValueError("Selecione ao menos uma figurinha repetida para vender")

        venda = self.repo.vender_repetidas_rapido(
            id_usuario=usuario["ID_USUARIO"],
            itens=itens,
            valores_raridade=ALBUM_VENDA_RAPIDA_VALORES,
            limite_diario=ALBUM_VENDA_RAPIDA_LIMITE_DIARIO,
        )
        estado = self.obter_estado(cpf_colaborador)

        return {
            "venda": venda,
            "estado": estado,
        }

    def resgatar_pacote_misterioso(self, cpf_colaborador: str):
        usuario = self.repo.buscar_usuario_album(cpf_colaborador)
        if not usuario:
            raise ValueError("Usu?rio n?o encontrado em login.TB_USUARIOS")

        if not self._usuario_pode_resgatar_pacote_misterioso(usuario):
            raise ValueError("Pacote misterioso disponivel apenas para operadores")

        resgate = self.repo.resgatar_pacote_misterioso(
            id_usuario=usuario["ID_USUARIO"],
            id_figurinha_misteriosa=ALBUM_MYSTERY_FIGURINHA_ID,
            custo_repetidas=ALBUM_MYSTERY_REPETIDAS_CUSTO,
            nome_pacote=ALBUM_MYSTERY_NOME_PACOTE,
            limite_resgates=ALBUM_MYSTERY_RESGATES_LIMITE,
        )
        estado = self.obter_estado(cpf_colaborador)

        return {
            "resgate": resgate,
            "estado": estado,
        }
