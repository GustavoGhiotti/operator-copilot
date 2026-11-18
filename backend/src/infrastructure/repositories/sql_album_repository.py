from collections import defaultdict
from datetime import date, datetime, timedelta
import json
import random
import re
import unicodedata
from typing import Any

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66, DB_HOST_248


class AlbumRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")
        self.db_vega = SQLServerConnection(DB_HOST_248, "DB_PROC_ACME") if DB_HOST_248 else None

    CHECKIN_MOVIMENTACAO = "checkin_diario"
    SPOILER_MOVIMENTACAO = "spoiler_album_aberto"
    SPOILER_NOME_PACOTE = "Pacote Spoiler Copa 2026"
    LIMITE_TROCAS_ACEITAS_DIA = 10
    LEILAO_DURACAO_MINUTOS = 10
    LEILAO_ANTI_SNIPING_JANELA_SEGUNDOS = 10
    LEILAO_ANTI_SNIPING_EXTENSAO_SEGUNDOS = 15
    LEILAO_VENDEDOR_SISTEMA = "SISTEMA"
    OLHEIRO_QTD_OFERTAS_DIA = 5
    OLHEIRO_QTD_FIGURINHAS_RETORNO = 11

    @staticmethod
    def _normalizar_chave(valor: Any) -> str:
        texto = str(valor or "").strip().lower()
        texto = unicodedata.normalize("NFKD", texto)
        texto = "".join(char for char in texto if not unicodedata.combining(char))
        return texto

    OLHEIRO_SEED = [
        {
            "nome": "Diego Almeida",
            "cargo": "Observador",
            "raridade": "comum",
            "custo": 40,
            "estrelas": 1,
            "radar": 58,
            "persistencia": 62,
            "alcance": 55,
        },
        {
            "nome": "Larissa Mendes",
            "cargo": "Analista de Mercado",
            "raridade": "raro",
            "custo": 105,
            "estrelas": 3,
            "radar": 72,
            "persistencia": 70,
            "alcance": 74,
        },
        {
            "nome": "Felipe Nunes",
            "cargo": "Especialista Regional",
            "raridade": "raro",
            "custo": 105,
            "estrelas": 3,
            "radar": 76,
            "persistencia": 66,
            "alcance": 78,
        },
        {
            "nome": "Marcelo Tavares",
            "cargo": "Cacador de Talentos",
            "raridade": "epico",
            "custo": 250,
            "estrelas": 4,
            "radar": 84,
            "persistencia": 82,
            "alcance": 86,
        },
        {
            "nome": "Juliana Costa",
            "cargo": "Olheiro Elite",
            "raridade": "lendario",
            "custo": 380,
            "estrelas": 5,
            "radar": 92,
            "persistencia": 88,
            "alcance": 94,
        },
        {
            "nome": "Acme Boss",
            "cargo": "Olheiro Boss",
            "raridade": "boss",
            "custo": 580,
            "estrelas": 5,
            "radar": 98,
            "persistencia": 96,
            "alcance": 99,
        },
    ]

    OLHEIRO_CUSTO_RARIDADE = {
        "comum": 40,
        "incomum": 75,
        "raro": 105,
        "ultra-raro": 170,
        "epico": 250,
        "lendario": 380,
        "boss": 580,
    }

    def _normalizar_raridade(self, valor: str | None) -> str:
        chave = str(valor or "").strip().lower()
        mapa = {
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
        return mapa.get(chave, "comum")

    def _peso_raridade_pacote(self, raridade: str) -> float:
        pesos = {
            "comum": 68.0,
            "incomum": 18.0,
            "raro": 8.0,
            "ultra-raro": 3.2,
            "epico": 1.6,
            "lendario": 0.5,
            "boss": 0.08,
        }
        return pesos.get(raridade, 1.0)

    def _rank_raridade_pacote(self, raridade: str) -> int:
        ordem = {
            "comum": 1,
            "incomum": 2,
            "raro": 3,
            "ultra-raro": 4,
            "epico": 5,
            "lendario": 6,
            "boss": 7,
        }
        return ordem.get(self._normalizar_raridade(raridade), 1)

    def _sortear_figurinhas_pacote(
        self,
        candidatas: list[dict[str, Any]],
        qtd_figurinhas: int,
        perfil_raridade: dict[str, Any] | None = None,
    ) -> list[Any]:
        pool = [dict(item) for item in candidatas]
        quantidade_sorteio = min(qtd_figurinhas, len(pool))
        sorteadas: list[Any] = []

        def sortear_do_pool(itens: list[dict[str, Any]]):
            pesos = [item["peso"] for item in itens]
            return random.choices(itens, weights=pesos, k=1)[0]

        perfil = perfil_raridade or {}
        min_raridade = str(perfil.get("min_raridade") or "").strip()
        qtd_garantidas = min(int(perfil.get("qtd_garantidas") or 0), quantidade_sorteio)

        if min_raridade and qtd_garantidas > 0:
            rank_minimo = self._rank_raridade_pacote(min_raridade)
            while len(sorteadas) < qtd_garantidas and pool:
                elegiveis = [
                    item for item in pool if item["rank_raridade"] >= rank_minimo
                ]
                if not elegiveis:
                    break

                escolhida = sortear_do_pool(elegiveis)
                sorteadas.append(escolhida["id_figurinha"])
                pool = [
                    item
                    for item in pool
                    if str(item["id_figurinha"]) != str(escolhida["id_figurinha"])
                ]

        while len(sorteadas) < quantidade_sorteio and pool:
            escolhida = sortear_do_pool(pool)
            sorteadas.append(escolhida["id_figurinha"])
            pool = [
                item
                for item in pool
                if str(item["id_figurinha"]) != str(escolhida["id_figurinha"])
            ]

        return sorteadas

    def _calcular_streak_checkin_datas(self, datas_checkin: list[date], referencia: date | None = None) -> int:
        datas = sorted(set(datas_checkin), reverse=True)
        if not datas:
            return 0

        dia = referencia or date.today()
        streak = 0
        datas_set = set(datas)

        while dia in datas_set:
            streak += 1
            dia = dia - timedelta(days=1)

        return streak

    def buscar_usuario_album(self, cpf_colaborador: str) -> dict[str, Any] | None:
        cpf_limpo = re.sub(r"\D", "", str(cpf_colaborador or ""))
        query = """
            SELECT TOP 1
                CPF_COLABORADOR AS ID_USUARIO,
                CPF_COLABORADOR,
                NM_COLABORADOR,
                SUPERVISOR,
                CENTRO_CUSTO,
                FUNCAO_COLABORADOR
            FROM login.TB_USUARIOS WITH(NOLOCK)
            WHERE CPF_COLABORADOR = ?
               OR REPLACE(REPLACE(REPLACE(CPF_COLABORADOR, '.', ''), '-', ''), ' ', '') = ?
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(cpf_colaborador, cpf_limpo),
            one=True,
        )

    def listar_objetos_meta_copa_faltantes(self):
        query = """
            SELECT NOME_OBJETO
            FROM (
                VALUES
                    ('album.TB_ALBUM_META'),
                    ('album.TB_ALBUM_META_USUARIO'),
                    ('album.TB_ALBUM_META_CONFIG_OPERADOR'),
                    ('album.TB_ALBUM_CAMPANHA_PREMIO')
            ) AS OBJETOS (NOME_OBJETO)
            WHERE OBJECT_ID(NOME_OBJETO, 'U') IS NULL
        """

        rows = self.db.execute_fetch(query=query, parametros=(), one=False) or []
        return [row["NOME_OBJETO"] for row in rows]

    def listar_tipos_meta_copa(self):
        query = """
            SELECT
                ID_META AS ID_META_TIPO,
                TP_META AS CD_META_TIPO,
                NM_META,
                CAST(NULL AS NVARCHAR(255)) AS DS_META,
                UNIDADE,
                REGRA_COMPARACAO,
                FREQUENCIA AS FREQUENCIA_PADRAO,
                VL_ALVO AS VL_ALVO_PADRAO,
                QTD_PACOTES AS QTD_PACOTES_PADRAO,
                QTD_FIGURINHAS_POR_PACOTE AS QTD_FIGURINHAS_POR_PACOTE_PADRAO,
                ORDEM_EXIBICAO,
                FL_ATIVA
            FROM album.TB_ALBUM_META WITH(NOLOCK)
            ORDER BY ORDEM_EXIBICAO, NM_META
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_config_global_meta_copa(self):
        query = """
            SELECT
                m.ID_META AS ID_META_TIPO,
                m.FL_ATIVA,
                m.VL_ALVO,
                m.FREQUENCIA,
                m.QTD_PACOTES,
                m.QTD_FIGURINHAS_POR_PACOTE,
                m.ORDEM_EXIBICAO,
                CAST(NULL AS VARCHAR(14)) AS CPF_SUPERVISOR_ALTERACAO,
                CAST(NULL AS DATETIME2) AS DT_ATUALIZACAO,
                m.TP_META AS CD_META_TIPO,
                m.NM_META,
                CAST(NULL AS NVARCHAR(255)) AS DS_META,
                m.UNIDADE,
                m.REGRA_COMPARACAO
            FROM album.TB_ALBUM_META m WITH(NOLOCK)
            ORDER BY m.ORDEM_EXIBICAO, m.NM_META
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_operadores_supervisor(
        self,
        nome_supervisor: str | None = None,
        centro_custo: str | None = None,
    ):
        query = """
            SELECT
                CPF_COLABORADOR,
                NM_COLABORADOR,
                SUPERVISOR,
                CENTRO_CUSTO,
                FUNCAO_COLABORADOR
            FROM login.TB_USUARIOS WITH(NOLOCK)
            WHERE ISNULL(CPF_COLABORADOR, '') <> ''
              AND ISNULL(NM_COLABORADOR, '') <> ''
              AND ISNULL(USUARIO_ATIVO, 1) = 1
              AND (
                    LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%aprendiz operador(a) cobrador%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%operador(a) cobrador(a)%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%negociador%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%omnichannel%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%estagiario%'
              )
            ORDER BY NM_COLABORADOR
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False,
        ) or []

    def buscar_operador_supervisor(
        self,
        nome_supervisor: str | None = None,
        cpf_operador: str | None = None,
        centro_custo: str | None = None,
    ):
        query = """
            SELECT TOP 1
                CPF_COLABORADOR,
                NM_COLABORADOR,
                SUPERVISOR,
                CENTRO_CUSTO,
                FUNCAO_COLABORADOR
            FROM login.TB_USUARIOS WITH(NOLOCK)
            WHERE CPF_COLABORADOR = ?
              AND ISNULL(USUARIO_ATIVO, 1) = 1
              AND (
                    LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%aprendiz operador(a) cobrador%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%operador(a) cobrador(a)%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%negociador%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%omnichannel%'
                 OR LOWER(LTRIM(RTRIM(ISNULL(FUNCAO_COLABORADOR, '')))) LIKE '%estagiario%'
              )
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(cpf_operador,),
            one=True,
        )

    def listar_overrides_meta_operador(self, cpf_operador: str):
        query = """
            SELECT
                o.ID_META AS ID_META_TIPO,
                o.FL_ATIVA,
                o.VL_ALVO,
                o.FREQUENCIA,
                t.QTD_PACOTES,
                t.QTD_FIGURINHAS_POR_PACOTE,
                o.ORDEM_EXIBICAO,
                o.CPF_SUPERVISOR_ALTERACAO,
                o.DT_ATUALIZACAO,
                t.TP_META AS CD_META_TIPO,
                t.NM_META,
                CAST(NULL AS NVARCHAR(255)) AS DS_META,
                t.UNIDADE,
                t.REGRA_COMPARACAO
            FROM album.TB_ALBUM_META_CONFIG_OPERADOR o WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_META t WITH(NOLOCK)
                ON t.ID_META = o.ID_META
            WHERE o.CPF_COLABORADOR = ?
            ORDER BY o.ORDEM_EXIBICAO, t.NM_META
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(cpf_operador,),
            one=False,
        ) or []

    def listar_equipes(self):
        query = """
            SELECT
                e.ID_EQUIPE,
                e.NM_EQUIPE,
                e.SG_EQUIPE,
                e.ORDEM_EXIBICAO,
                e.URL_FUNDO_PAGINA,
                r.NM_RARIDADE,
                r.SG_RARIDADE,
                r.COR_HEX,
                ISNULL(eq_info.TOTAL_SLOTS, 0) AS TOTAL_SLOTS
            FROM album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = e.ID_RARIDADE_PADRAO
            OUTER APPLY (
                SELECT COUNT(1) AS TOTAL_SLOTS
                FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                    ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
                WHERE f.ID_EQUIPE = e.ID_EQUIPE
                  AND f.FL_ATIVA = 1
                  AND p.FL_ATIVO = 1
            ) eq_info
            WHERE e.FL_ATIVA = 1
            ORDER BY e.ORDEM_EXIBICAO, e.NM_EQUIPE
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_figurinhas_usuario(self, id_usuario: Any):
        query = """
            SELECT
                f.ID_FIGURINHA,
                f.ID_EQUIPE,
                e.NM_EQUIPE,
                e.SG_EQUIPE,
                f.ID_RARIDADE,
                r.NM_RARIDADE,
                r.SG_RARIDADE,
                r.COR_HEX,
                f.NM_FIGURINHA,
                f.URL_IMAGEM,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.FL_BOSS,
                p.NM_COLABORADOR,
                ISNULL(inv.QTD_TOTAL, 0) AS QTD_TOTAL,
                ISNULL(inv.QTD_COLADAS, 0) AS QTD_COLADAS
            FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            LEFT JOIN album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
                ON inv.ID_FIGURINHA = f.ID_FIGURINHA
               AND inv.ID_USUARIO = ?
            WHERE f.FL_ATIVA = 1
              AND p.FL_ATIVO = 1
              AND e.FL_ATIVA = 1
            ORDER BY
                e.ORDEM_EXIBICAO,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.NM_FIGURINHA
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario,), one=False) or []

    def listar_producao_usuario_periodo(
        self,
        cpf_colaborador: str,
        data_inicio: date,
        data_fim: date,
        nome_colaborador: str | None = None,
    ):
        query = """
            SELECT
                CAST(p.DATA_ACORDO AS DATE) AS DATA_ACORDO,
                p.ID_ACORDO,
                CAST(ISNULL(p.VL_ACORDO, 0) AS DECIMAL(18, 2)) AS VL_ACORDO,
                p.NM_USUARIO
            FROM dbo.TB_PRODUCAO_COPILOT p WITH(NOLOCK)
            LEFT JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON UPPER(LTRIM(RTRIM(u.NM_COLABORADOR))) = UPPER(LTRIM(RTRIM(p.NM_USUARIO)))
            WHERE (
                    u.CPF_COLABORADOR = ?
                 OR UPPER(LTRIM(RTRIM(ISNULL(p.NM_USUARIO, '')))) = UPPER(LTRIM(RTRIM(?)))
                  )
              AND CAST(p.DATA_ACORDO AS DATE) >= ?
              AND CAST(p.DATA_ACORDO AS DATE) <= ?
            ORDER BY p.DATA_ACORDO DESC, p.ID_ACORDO DESC
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(cpf_colaborador, nome_colaborador or "", data_inicio, data_fim),
            one=False,
        ) or []

    def listar_acordos_usuario_periodo_detalhado(
        self,
        cpf_colaborador: str,
        dt_inicio: datetime,
        dt_fim: datetime,
        nome_colaborador: str | None = None,
    ):
        query = """
            SELECT
                p.ID_ACORDO,
                p.DATA_ACORDO,
                CAST(ISNULL(p.VL_ACORDO, 0) AS DECIMAL(18, 2)) AS VL_ACORDO,
                p.NM_USUARIO
            FROM dbo.TB_PRODUCAO_COPILOT p WITH(NOLOCK)
            LEFT JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON UPPER(LTRIM(RTRIM(u.NM_COLABORADOR))) = UPPER(LTRIM(RTRIM(p.NM_USUARIO)))
            WHERE (
                    u.CPF_COLABORADOR = ?
                 OR UPPER(LTRIM(RTRIM(ISNULL(p.NM_USUARIO, '')))) = UPPER(LTRIM(RTRIM(?)))
                  )
              AND p.DATA_ACORDO >= ?
              AND p.DATA_ACORDO <= ?
            ORDER BY p.DATA_ACORDO ASC, p.ID_ACORDO ASC
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(cpf_colaborador, nome_colaborador or "", dt_inicio, dt_fim),
            one=False,
        ) or []

    def resultados_vega_habilitados(self):
        return self.db_vega is not None

    def listar_resultados_vega_periodo(
        self,
        cpf_colaborador: str,
        data_inicio: date,
        data_fim: date,
        nome_colaborador: str | None = None,
    ):
        if not self.resultados_vega_habilitados():
            return []

        query = """
            SELECT
                CAST(r.DATA AS DATE) AS DATA_REFERENCIA,
                MAX(CAST(ISNULL(r.PP, 0) AS INT)) AS QTD_PP,
                MAX(CAST(ISNULL(r.VL_ARRECADADO, 0) AS DECIMAL(18, 2))) AS VL_RECUPERADO,
                MAX(CAST(ISNULL(r.LOGADO_NR, 0) AS INT)) AS LOGADO_SEGUNDOS
            FROM dbo.TBL_REL_RESULTADO_OPERADORES r WITH(NOLOCK)
            WHERE (
                    LTRIM(RTRIM(CAST(r.CPF AS VARCHAR(32)))) = LTRIM(RTRIM(?))
                 OR UPPER(LTRIM(RTRIM(ISNULL(r.COLABORADOR, '')))) = UPPER(LTRIM(RTRIM(?)))
                 OR UPPER(LTRIM(RTRIM(ISNULL(r.USERNAME, '')))) = UPPER(LTRIM(RTRIM(?)))
                  )
              AND CAST(r.DATA AS DATE) >= ?
              AND CAST(r.DATA AS DATE) <= ?
            GROUP BY CAST(r.DATA AS DATE)
            ORDER BY CAST(r.DATA AS DATE) DESC
        """

        return self.db_vega.execute_fetch(
            query=query,
            parametros=(cpf_colaborador, nome_colaborador or "", nome_colaborador or "", data_inicio, data_fim),
            one=False,
        ) or []

    def listar_resultados_vega_detalhados(
        self,
        cpf_colaborador: str,
        dt_inicio: datetime,
        dt_fim: datetime,
        nome_colaborador: str | None = None,
    ):
        if not self.resultados_vega_habilitados():
            return []

        query = """
            SELECT
                CAST(r.DATA AS DATE) AS DATA_REFERENCIA,
                CAST(ISNULL(r.PP, 0) AS INT) AS QTD_PP,
                CAST(ISNULL(r.VL_ARRECADADO, 0) AS DECIMAL(18, 2)) AS VL_RECUPERADO,
                CAST(ISNULL(r.LOGADO_NR, 0) AS INT) AS LOGADO_SEGUNDOS,
                COALESCE(r.DT_ATUALIZACAO, CAST(r.DATA AS DATETIME2)) AS DT_EVENTO
            FROM dbo.TBL_REL_RESULTADO_OPERADORES r WITH(NOLOCK)
            WHERE (
                    LTRIM(RTRIM(CAST(r.CPF AS VARCHAR(32)))) = LTRIM(RTRIM(?))
                 OR UPPER(LTRIM(RTRIM(ISNULL(r.COLABORADOR, '')))) = UPPER(LTRIM(RTRIM(?)))
                 OR UPPER(LTRIM(RTRIM(ISNULL(r.USERNAME, '')))) = UPPER(LTRIM(RTRIM(?)))
                  )
              AND COALESCE(r.DT_ATUALIZACAO, CAST(r.DATA AS DATETIME2)) >= ?
              AND COALESCE(r.DT_ATUALIZACAO, CAST(r.DATA AS DATETIME2)) <= ?
            ORDER BY COALESCE(r.DT_ATUALIZACAO, CAST(r.DATA AS DATETIME2)) ASC
        """

        return self.db_vega.execute_fetch(
            query=query,
            parametros=(cpf_colaborador, nome_colaborador or "", nome_colaborador or "", dt_inicio, dt_fim),
            one=False,
        ) or []

    def obter_resultado_vega_data(
        self,
        cpf_colaborador: str,
        data_referencia: date,
        nome_colaborador: str | None = None,
    ):
        if not self.resultados_vega_habilitados():
            return None

        query = """
            SELECT TOP 1
                CAST(ISNULL(r.PP, 0) AS INT) AS QTD_PP,
                CAST(ISNULL(r.VL_ARRECADADO, 0) AS DECIMAL(18, 2)) AS VL_RECUPERADO,
                CAST(ISNULL(r.LOGADO_NR, 0) AS INT) AS LOGADO_SEGUNDOS,
                COALESCE(r.DT_ATUALIZACAO, CAST(r.DATA AS DATETIME2)) AS DT_EVENTO
            FROM dbo.TBL_REL_RESULTADO_OPERADORES r WITH(NOLOCK)
            WHERE (
                    LTRIM(RTRIM(CAST(r.CPF AS VARCHAR(32)))) = LTRIM(RTRIM(?))
                 OR UPPER(LTRIM(RTRIM(ISNULL(r.COLABORADOR, '')))) = UPPER(LTRIM(RTRIM(?)))
                 OR UPPER(LTRIM(RTRIM(ISNULL(r.USERNAME, '')))) = UPPER(LTRIM(RTRIM(?)))
                  )
              AND CAST(r.DATA AS DATE) = ?
            ORDER BY COALESCE(r.DT_ATUALIZACAO, CAST(r.DATA AS DATETIME2)) DESC
        """

        return self.db_vega.execute_fetch(
            query=query,
            parametros=(cpf_colaborador, nome_colaborador or "", nome_colaborador or "", data_referencia),
            one=True,
        )

    def _listar_metas_usuario_configuradas(self, id_usuario: Any):
        query = """
            WITH META_BASE AS (
                SELECT
                    m.ID_META,
                    m.NM_META,
                    m.TP_META,
                    m.REGRA_COMPARACAO,
                    m.FREQUENCIA,
                    m.VL_ALVO,
                    m.UNIDADE,
                    m.QTD_PACOTES,
                    m.QTD_FIGURINHAS_POR_PACOTE,
                    m.ORDEM_EXIBICAO,
                    m.FL_ATIVA AS FL_ATIVA_BASE,
                    op.FL_ATIVA AS FL_ATIVA_OVERRIDE,
                    op.VL_ALVO AS VL_ALVO_OVERRIDE,
                    op.FREQUENCIA AS FREQUENCIA_OVERRIDE,
                    op.ORDEM_EXIBICAO AS ORDEM_EXIBICAO_OVERRIDE
                FROM album.TB_ALBUM_META m WITH(NOLOCK)
                LEFT JOIN album.TB_ALBUM_META_CONFIG_OPERADOR op WITH(NOLOCK)
                    ON op.ID_META = m.ID_META
                   AND op.CPF_COLABORADOR = ?
            )
            SELECT
                b.ID_META,
                b.NM_META,
                b.TP_META,
                b.REGRA_COMPARACAO,
                COALESCE(b.FREQUENCIA_OVERRIDE, b.FREQUENCIA, 'DIARIA') AS FREQUENCIA,
                CAST(COALESCE(b.VL_ALVO_OVERRIDE, b.VL_ALVO, 0) AS DECIMAL(18, 2)) AS VL_ALVO,
                b.UNIDADE,
                b.QTD_PACOTES AS QTD_PACOTES,
                b.QTD_FIGURINHAS_POR_PACOTE AS QTD_FIGURINHAS_POR_PACOTE,
                COALESCE(b.ORDEM_EXIBICAO_OVERRIDE, b.ORDEM_EXIBICAO, 0) AS ORDEM_EXIBICAO,
                mu.ID_META_USUARIO,
                ISNULL(mu.VL_APURADO, 0) AS VL_APURADO,
                ISNULL(mu.FL_BATEU_META, 0) AS FL_BATEU_META,
                ISNULL(mu.FL_PREMIO_GERADO, 0) AS FL_PREMIO_GERADO,
                mu.DT_REFERENCIA_INICIO,
                mu.DT_REFERENCIA_FIM,
                mu.DT_APURACAO
            FROM META_BASE b
            OUTER APPLY (
                SELECT TOP 1
                    mu.ID_META_USUARIO,
                    mu.VL_APURADO,
                    mu.FL_BATEU_META,
                    mu.FL_PREMIO_GERADO,
                    mu.DT_REFERENCIA_INICIO,
                    mu.DT_REFERENCIA_FIM,
                    mu.DT_APURACAO
                FROM album.TB_ALBUM_META_USUARIO mu WITH(NOLOCK)
                WHERE mu.ID_META = b.ID_META
                  AND mu.ID_USUARIO = ?
                ORDER BY
                    mu.DT_REFERENCIA_FIM DESC,
                    mu.DT_APURACAO DESC,
                    mu.DT_REFERENCIA_INICIO DESC
            ) mu
            WHERE CASE
                    WHEN b.FL_ATIVA_OVERRIDE IS NOT NULL THEN b.FL_ATIVA_OVERRIDE
                    ELSE b.FL_ATIVA_BASE
                  END = 1
            ORDER BY COALESCE(b.ORDEM_EXIBICAO_OVERRIDE, b.ORDEM_EXIBICAO), b.NM_META
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario, id_usuario), one=False) or []

    def _listar_metas_usuario_legacy(self, id_usuario: Any):
        query = """
            SELECT
                m.ID_META,
                m.NM_META,
                m.TP_META,
                m.FREQUENCIA,
                m.REGRA_COMPARACAO,
                m.VL_ALVO,
                m.UNIDADE,
                m.QTD_PACOTES,
                m.QTD_FIGURINHAS_POR_PACOTE,
                m.ORDEM_EXIBICAO,
                mu.ID_META_USUARIO,
                ISNULL(mu.VL_APURADO, 0) AS VL_APURADO,
                ISNULL(mu.FL_BATEU_META, 0) AS FL_BATEU_META,
                ISNULL(mu.FL_PREMIO_GERADO, 0) AS FL_PREMIO_GERADO,
                mu.DT_REFERENCIA_INICIO,
                mu.DT_REFERENCIA_FIM,
                mu.DT_APURACAO
            FROM album.TB_ALBUM_META m WITH(NOLOCK)
            OUTER APPLY (
                SELECT TOP 1
                    mu.ID_META_USUARIO,
                    mu.VL_APURADO,
                    mu.FL_BATEU_META,
                    mu.FL_PREMIO_GERADO,
                    mu.DT_REFERENCIA_INICIO,
                    mu.DT_REFERENCIA_FIM,
                    mu.DT_APURACAO
                FROM album.TB_ALBUM_META_USUARIO mu WITH(NOLOCK)
                WHERE mu.ID_META = m.ID_META
                  AND mu.ID_USUARIO = ?
                ORDER BY
                    mu.DT_REFERENCIA_FIM DESC,
                    mu.DT_APURACAO DESC,
                    mu.DT_REFERENCIA_INICIO DESC
            ) mu
            WHERE m.FL_ATIVA = 1
            ORDER BY m.ORDEM_EXIBICAO, m.NM_META
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario,), one=False) or []

    def listar_metas_usuario(self, id_usuario: Any):
        metas_configuradas = self._listar_metas_usuario_configuradas(id_usuario)
        if metas_configuradas:
            return metas_configuradas

        return self._listar_metas_usuario_legacy(id_usuario)

    def listar_pacotes_usuario(self, id_usuario: Any):
        query_pacotes = """
            SELECT
                p.ID_PACOTE,
                p.ID_META_USUARIO,
                p.NM_PACOTE,
                p.COR_PACOTE_HEX,
                p.STATUS_PACOTE,
                p.QTD_FIGURINHAS,
                p.DT_GANHO,
                p.DT_ABERTURA,
                m.NM_META,
                meta.NM_RARIDADE AS NM_RARIDADE_META
            FROM album.TB_ALBUM_PACOTE p WITH(NOLOCK)
            LEFT JOIN album.TB_ALBUM_META_USUARIO mu WITH(NOLOCK)
                ON mu.ID_META_USUARIO = p.ID_META_USUARIO
            LEFT JOIN album.TB_ALBUM_META m WITH(NOLOCK)
                ON m.ID_META = mu.ID_META
            OUTER APPLY (
                SELECT TOP 1
                    r.NM_RARIDADE
                FROM album.TB_ALBUM_PACOTE_ITEM pi WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                    ON f.ID_FIGURINHA = pi.ID_FIGURINHA
                INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                    ON r.ID_RARIDADE = f.ID_RARIDADE
                WHERE pi.ID_PACOTE = p.ID_PACOTE
                ORDER BY pi.ORDEM_REVELACAO
            ) meta
            WHERE p.ID_USUARIO = ?
            ORDER BY
                CASE WHEN UPPER(ISNULL(p.STATUS_PACOTE, '')) = 'FECHADO' THEN 0 ELSE 1 END,
                p.DT_GANHO DESC
        """

        query_itens = """
            SELECT
                pi.ID_PACOTE,
                pi.ORDEM_REVELACAO,
                f.ID_FIGURINHA,
                f.ID_EQUIPE,
                e.NM_EQUIPE,
                r.NM_RARIDADE,
                r.SG_RARIDADE,
                r.COR_HEX,
                f.NM_FIGURINHA,
                f.URL_IMAGEM,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.FL_BOSS
            FROM album.TB_ALBUM_PACOTE_ITEM pi WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_PACOTE p WITH(NOLOCK)
                ON p.ID_PACOTE = pi.ID_PACOTE
            INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                ON f.ID_FIGURINHA = pi.ID_FIGURINHA
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            WHERE p.ID_USUARIO = ?
            ORDER BY p.DT_GANHO DESC, pi.ORDEM_REVELACAO
        """

        pacotes = self.db.execute_fetch(
            query=query_pacotes,
            parametros=(id_usuario,),
            one=False,
        ) or []

        itens = self.db.execute_fetch(
            query=query_itens,
            parametros=(id_usuario,),
            one=False,
        ) or []

        itens_por_pacote = defaultdict(list)
        for item in itens:
            itens_por_pacote[str(item["ID_PACOTE"])].append(item)

        for pacote in pacotes:
            pacote["ITENS"] = itens_por_pacote.get(str(pacote["ID_PACOTE"]), [])

        return pacotes

    def trocas_habilitadas(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_TROCA_FIGURINHA', 'U') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def duelos_habilitados(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_DUELO_DIARIO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE', 'U') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def feed_reacoes_habilitadas(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_FEED_REACAO', 'U') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def moedas_habilitadas(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_AURORA_COIN_SALDO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO', 'U') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def leiloes_habilitados(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_LEILAO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_LEILAO_LANCE', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_AURORA_COIN_SALDO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO', 'U') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def olheiros_habilitados(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_OLHEIRO', 'U') IS NULL THEN 0
                        WHEN COL_LENGTH('album.TB_ALBUM_OLHEIRO', 'ID_FIGURINHA') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_OLHEIRO_OFERTA', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_OLHEIRO_MISSAO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_AURORA_COIN_SALDO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO', 'U') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def eventos_lembretes_habilitados(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_EVENTO_LEMBRETE', 'U') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def eventos_album_habilitados(self):
        row = self.db.execute_fetch(
            query="""
                SELECT
                    CASE
                        WHEN OBJECT_ID('album.TB_ALBUM_EVENTO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_EVENTO_PARTICIPACAO', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_EVENTO_LEMBRETE', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_EVENTO_PREMIO_ENTREGA', 'U') IS NULL THEN 0
                        WHEN OBJECT_ID('album.TB_ALBUM_EVENTO_RESULTADO', 'U') IS NULL THEN 0
                        WHEN COL_LENGTH('album.TB_ALBUM_EVENTO', 'PREMIO_CONFIG_JSON') IS NULL THEN 0
                        WHEN COL_LENGTH('album.TB_ALBUM_EVENTO', 'URL_IMAGEM_HERO') IS NULL THEN 0
                        WHEN COL_LENGTH('album.TB_ALBUM_EVENTO', 'URL_IMAGEM_CARD') IS NULL THEN 0
                        ELSE 1
                    END AS HABILITADO
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("HABILITADO"))

    def listar_eventos_album(self):
        if not self.eventos_album_habilitados():
            return []

        return self.db.execute_fetch(
            query="""
                SELECT
                    ID_EVENTO,
                    TP_EVENTO,
                    TITULO,
                    DESTAQUE,
                    DESCRICAO,
                    DETALHES_JSON,
                    DT_INICIO,
                    DT_FIM,
                    PREMIO,
                    PREMIO_CONFIG_JSON,
                    PARTICIPANTES_PREMIADOS,
                    COR,
                    URL_IMAGEM_HERO,
                    URL_IMAGEM_CARD,
                    FL_ATIVO
                FROM album.TB_ALBUM_EVENTO WITH(NOLOCK)
                WHERE FL_ATIVO = 1
                ORDER BY DT_INICIO ASC
            """,
            parametros=(),
            one=False,
        ) or []

    def buscar_evento_album(self, id_evento: str):
        if not self.eventos_album_habilitados():
            return None

        return self.db.execute_fetch(
            query="""
                SELECT TOP 1
                    ID_EVENTO,
                    TP_EVENTO,
                    TITULO,
                    DESTAQUE,
                    DESCRICAO,
                    DETALHES_JSON,
                    DT_INICIO,
                    DT_FIM,
                    PREMIO,
                    PREMIO_CONFIG_JSON,
                    PARTICIPANTES_PREMIADOS,
                    COR,
                    URL_IMAGEM_HERO,
                    URL_IMAGEM_CARD,
                    FL_ATIVO
                FROM album.TB_ALBUM_EVENTO WITH(NOLOCK)
                WHERE ID_EVENTO = ?
                  AND FL_ATIVO = 1
            """,
            parametros=(id_evento,),
            one=True,
        )

    def evento_album_existe(self, id_evento: str):
        if not self.eventos_album_habilitados():
            return False

        row = self.db.execute_fetch(
            query="""
                SELECT TOP 1 1 AS EXISTE
                FROM album.TB_ALBUM_EVENTO WITH(NOLOCK)
                WHERE ID_EVENTO = ?
            """,
            parametros=(id_evento,),
            one=True,
        )
        return bool(row and row.get("EXISTE"))

    def figurinha_album_existe(self, id_figurinha: Any):
        row = self.db.execute_fetch(
            query="""
                SELECT TOP 1 1 AS EXISTE
                FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                    ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
                INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                    ON e.ID_EQUIPE = f.ID_EQUIPE
                WHERE f.ID_FIGURINHA = ?
                  AND f.FL_ATIVA = 1
                  AND p.FL_ATIVO = 1
                  AND e.FL_ATIVA = 1
            """,
            parametros=(id_figurinha,),
            one=True,
        )
        return bool(row and row.get("EXISTE"))

    def listar_figurinhas_premio_evento(self):
        return self.db.execute_fetch(
            query="""
                SELECT
                    f.ID_FIGURINHA,
                    f.NM_FIGURINHA,
                    e.NM_EQUIPE,
                    r.NM_RARIDADE
                FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                    ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
                INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                    ON e.ID_EQUIPE = f.ID_EQUIPE
                INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                    ON r.ID_RARIDADE = f.ID_RARIDADE
                WHERE f.FL_ATIVA = 1
                  AND p.FL_ATIVO = 1
                  AND e.FL_ATIVA = 1
                ORDER BY f.ORDEM_EXIBICAO_GERAL, f.NM_FIGURINHA
            """,
            parametros=(),
            one=False,
        ) or []

    def buscar_participacao_evento_album(self, id_evento: str, id_usuario: Any):
        if not self.eventos_album_habilitados():
            return None

        return self.db.execute_fetch(
            query="""
                SELECT TOP 1
                    ID_PARTICIPACAO,
                    ID_EVENTO,
                    ID_USUARIO,
                    NM_USUARIO,
                    AREA,
                    PONTOS,
                    GOLS,
                    TOTAL_CHUTES,
                    DETALHES_JSON,
                    STATUS_PARTICIPACAO,
                    DT_INICIO,
                    DT_FIM,
                    DT_CADASTRO,
                    DT_ATUALIZACAO
                FROM album.TB_ALBUM_EVENTO_PARTICIPACAO WITH(NOLOCK)
                WHERE ID_EVENTO = ?
                  AND ID_USUARIO = ?
            """,
            parametros=(id_evento, str(id_usuario)),
            one=True,
        )

    def iniciar_participacao_evento_album(self, id_evento: str, id_usuario: Any, nome: str, area: str):
        if not self.eventos_album_habilitados():
            return False

        self.db.execute_commit(
            query="""
                IF NOT EXISTS (
                    SELECT 1
                    FROM album.TB_ALBUM_EVENTO_PARTICIPACAO WITH(UPDLOCK, HOLDLOCK)
                    WHERE ID_EVENTO = ?
                      AND ID_USUARIO = ?
                )
                BEGIN
                    INSERT INTO album.TB_ALBUM_EVENTO_PARTICIPACAO (
                        ID_EVENTO,
                        ID_USUARIO,
                        NM_USUARIO,
                        AREA,
                        STATUS_PARTICIPACAO,
                        DT_INICIO,
                        DT_CADASTRO,
                        DT_ATUALIZACAO
                    )
                    VALUES (?, ?, ?, ?, 'EM_ANDAMENTO', SYSDATETIME(), SYSDATETIME(), SYSDATETIME());
                END
            """,
            parametros=(id_evento, str(id_usuario), id_evento, str(id_usuario), nome, area),
        )
        return True

    def criar_evento_album(self, evento: dict[str, Any]):
        if not self.eventos_album_habilitados():
            return False

        self.db.execute_commit(
            query="""
                INSERT INTO album.TB_ALBUM_EVENTO (
                    ID_EVENTO,
                    TP_EVENTO,
                    TITULO,
                    DESTAQUE,
                    DESCRICAO,
                    DETALHES_JSON,
                    DT_INICIO,
                    DT_FIM,
                    PREMIO,
                    PREMIO_CONFIG_JSON,
                    PARTICIPANTES_PREMIADOS,
                    COR,
                    URL_IMAGEM_HERO,
                    URL_IMAGEM_CARD,
                    FL_ATIVO,
                    DT_CADASTRO,
                    DT_ATUALIZACAO
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, SYSDATETIME(), SYSDATETIME())
            """,
            parametros=(
                evento["id_evento"],
                evento["tp_evento"],
                evento["titulo"],
                evento["destaque"],
                evento["descricao"],
                evento["detalhes_json"],
                evento["dt_inicio"],
                evento["dt_fim"],
                evento["premio"],
                evento.get("premio_config_json"),
                evento["participantes_premiados"],
                evento["cor"],
                evento.get("url_imagem_hero"),
                evento.get("url_imagem_card"),
            ),
        )
        return True

    def finalizar_participacao_evento_album(
        self,
        id_evento: str,
        id_usuario: Any,
        pontos: int,
        gols: int,
        total_chutes: int,
        detalhes_json: str,
        chutes: list[dict[str, Any]],
    ):
        if not self.eventos_album_habilitados():
            return False

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            usuario_id = str(id_usuario)

            cursor.execute(
                """
                SELECT TOP 1 STATUS_PARTICIPACAO
                FROM album.TB_ALBUM_EVENTO_PARTICIPACAO WITH(UPDLOCK, HOLDLOCK)
                WHERE ID_EVENTO = ?
                  AND ID_USUARIO = ?
                """,
                (id_evento, usuario_id),
            )
            participacao = cursor.fetchone()
            if not participacao:
                conexao.rollback()
                return False

            if str(participacao.STATUS_PARTICIPACAO or "").upper() == "CONCLUIDO":
                conexao.rollback()
                return False

            cursor.execute(
                """
                DELETE FROM album.TB_ALBUM_EVENTO_RESULTADO
                WHERE ID_EVENTO = ?
                  AND ID_USUARIO = ?
                """,
                (id_evento, usuario_id),
            )

            for index, chute in enumerate(chutes, start=1):
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_EVENTO_RESULTADO (
                        ID_EVENTO,
                        ID_USUARIO,
                        NR_CHUTE,
                        ZONA_CHUTE,
                        ZONA_GOLEIRO,
                        FL_GOL,
                        PONTOS,
                        DT_CADASTRO
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, SYSDATETIME())
                    """,
                    (
                        id_evento,
                        usuario_id,
                        index,
                        str(chute.get("zone") or "")[:40],
                        str(chute.get("keeper") or "")[:40],
                        1 if chute.get("goal") else 0,
                        max(0, int(chute.get("points") or 0)),
                    ),
                )

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_EVENTO_PARTICIPACAO
                   SET PONTOS = ?,
                       GOLS = ?,
                       TOTAL_CHUTES = ?,
                       DETALHES_JSON = ?,
                       STATUS_PARTICIPACAO = 'CONCLUIDO',
                       DT_FIM = SYSDATETIME(),
                       DT_ATUALIZACAO = SYSDATETIME()
                 WHERE ID_EVENTO = ?
                   AND ID_USUARIO = ?
                   AND STATUS_PARTICIPACAO <> 'CONCLUIDO'
                """,
                (pontos, gols, total_chutes, detalhes_json, id_evento, usuario_id),
            )

            conexao.commit()
            return cursor.rowcount > 0
        except Exception:
            if conexao:
                conexao.rollback()
            raise
        finally:
            if conexao:
                conexao.close()

    def listar_ranking_evento_album(self, id_evento: str, limite: int = 50):
        if not self.eventos_album_habilitados():
            return []

        return self.db.execute_fetch(
            query=f"""
                SELECT TOP {int(limite)}
                    ROW_NUMBER() OVER (ORDER BY P.PONTOS DESC, P.GOLS DESC, P.DT_FIM ASC) AS POSICAO,
                    P.ID_USUARIO,
                    P.NM_USUARIO,
                    P.AREA,
                    P.PONTOS,
                    P.GOLS,
                    P.TOTAL_CHUTES,
                    P.DT_FIM
                FROM album.TB_ALBUM_EVENTO_PARTICIPACAO P WITH(NOLOCK)
                WHERE P.ID_EVENTO = ?
                  AND P.STATUS_PARTICIPACAO = 'CONCLUIDO'
                ORDER BY P.PONTOS DESC, P.GOLS DESC, P.DT_FIM ASC
            """,
            parametros=(id_evento,),
            one=False,
        ) or []

    def listar_eventos_encerrados_pendentes_apuracao(self):
        if not self.eventos_album_habilitados():
            return []

        return self.db.execute_fetch(
            query="""
                SELECT
                    E.ID_EVENTO
                FROM album.TB_ALBUM_EVENTO E WITH(NOLOCK)
                WHERE E.FL_ATIVO = 1
                  AND E.DT_FIM <= SYSDATETIME()
                  AND EXISTS (
                      SELECT 1
                      FROM album.TB_ALBUM_EVENTO_PARTICIPACAO P WITH(NOLOCK)
                      WHERE P.ID_EVENTO = E.ID_EVENTO
                        AND P.STATUS_PARTICIPACAO = 'CONCLUIDO'
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM album.TB_ALBUM_EVENTO_PREMIO_ENTREGA PE WITH(NOLOCK)
                      WHERE PE.ID_EVENTO = E.ID_EVENTO
                  )
            """,
            parametros=(),
            one=False,
        ) or []

    def _entregar_figurinha_premio_evento(
        self,
        cursor,
        id_usuario: Any,
        id_figurinha: Any,
        detalhe_movimentacao: str,
    ):
        if not id_figurinha:
            return False

        cursor.execute(
            """
            SELECT TOP 1 1
            FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            WHERE f.ID_FIGURINHA = ?
              AND f.FL_ATIVA = 1
              AND p.FL_ATIVO = 1
              AND e.FL_ATIVA = 1
            """,
            (id_figurinha,),
        )
        if not cursor.fetchone():
            return False

        cursor.execute(
            """
            UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
               SET QTD_TOTAL = ISNULL(QTD_TOTAL, 0) + 1,
                   QTD_COLADAS = CASE
                       WHEN ISNULL(QTD_COLADAS, 0) = 0 THEN 1
                       ELSE QTD_COLADAS
                   END,
                   DT_ULTIMA_OBTENCAO = GETDATE()
             WHERE ID_USUARIO = ?
               AND ID_FIGURINHA = ?
            """,
            (id_usuario, id_figurinha),
        )

        if cursor.rowcount == 0:
            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_INVENTARIO_USUARIO
                    (ID_USUARIO, ID_FIGURINHA, QTD_TOTAL, QTD_COLADAS, DT_PRIMEIRA_OBTENCAO, DT_ULTIMA_OBTENCAO)
                VALUES (?, ?, 1, 1, GETDATE(), GETDATE())
                """,
                (id_usuario, id_figurinha),
            )

        cursor.execute(
            """
            INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                (ID_USUARIO, ID_FIGURINHA, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
            VALUES (?, ?, ?, ?, GETDATE())
            """,
            (
                id_usuario,
                id_figurinha,
                "figurinha_premio_evento",
                detalhe_movimentacao,
            ),
        )
        return True

    def apurar_premios_evento_album(
        self,
        id_evento: str,
        qtd_coins: int = 300,
        qtd_pacotes: int = 1,
        qtd_figurinhas_por_pacote: int = 5,
    ):
        if not self.eventos_album_habilitados():
            return {"entregas": 0}

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT TOP 1
                    ID_EVENTO,
                    TITULO,
                    PREMIO,
                    PARTICIPANTES_PREMIADOS,
                    PREMIO_CONFIG_JSON
                FROM album.TB_ALBUM_EVENTO WITH(UPDLOCK, HOLDLOCK)
                WHERE ID_EVENTO = ?
                  AND FL_ATIVO = 1
                  AND DT_FIM <= SYSDATETIME()
                """,
                (id_evento,),
            )
            evento = cursor.fetchone()
            if not evento:
                conexao.rollback()
                return {"entregas": 0}

            cursor.execute(
                """
                SELECT TOP 1 1
                FROM album.TB_ALBUM_EVENTO_PREMIO_ENTREGA WITH(UPDLOCK, HOLDLOCK)
                WHERE ID_EVENTO = ?
                """,
                (id_evento,),
            )
            if cursor.fetchone():
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_EVENTO
                       SET FL_ATIVO = 0,
                           DT_ATUALIZACAO = SYSDATETIME()
                     WHERE ID_EVENTO = ?
                    """,
                    (id_evento,),
                )
                conexao.commit()
                return {"entregas": 0}

            try:
                premio_config = json.loads(evento[4] or "{}")
            except (TypeError, ValueError):
                premio_config = {}

            qtd_coins = max(0, min(300, int(premio_config.get("coins", qtd_coins) or 0)))
            qtd_pacotes = max(0, min(3, int(premio_config.get("qtd_pacotes", qtd_pacotes) or 0)))
            qtd_figurinhas_por_pacote = max(
                1,
                min(5, int(premio_config.get("qtd_figurinhas_por_pacote", qtd_figurinhas_por_pacote) or 1)),
            )
            id_figurinha_premio = premio_config.get("id_figurinha")

            limite = int(evento[3] or 50)
            cursor.execute(
                f"""
                SELECT TOP {limite}
                    ROW_NUMBER() OVER (ORDER BY P.PONTOS DESC, P.GOLS DESC, P.DT_FIM ASC) AS POSICAO,
                    P.ID_USUARIO,
                    P.PONTOS,
                    P.GOLS
                FROM album.TB_ALBUM_EVENTO_PARTICIPACAO P WITH(UPDLOCK, HOLDLOCK)
                WHERE P.ID_EVENTO = ?
                  AND P.STATUS_PARTICIPACAO = 'CONCLUIDO'
                ORDER BY P.PONTOS DESC, P.GOLS DESC, P.DT_FIM ASC
                """,
                (id_evento,),
            )
            ganhadores = cursor.fetchall()
            entregas = 0
            titulo_evento = str(evento[1] or "Evento do album")

            for row in ganhadores:
                posicao = int(row[0] or 0)
                id_usuario = row[1]
                pontos = int(row[2] or 0)
                gols = int(row[3] or 0)
                premio_json = (
                    "{"
                    f'"coins":{int(qtd_coins)},'
                    f'"qtd_pacotes":{int(qtd_pacotes)},'
                    f'"qtd_figurinhas_por_pacote":{int(qtd_figurinhas_por_pacote)},'
                    f'"id_figurinha":{json.dumps(id_figurinha_premio)}'
                    "}"
                )

                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_EVENTO_PREMIO_ENTREGA (
                        ID_EVENTO,
                        ID_USUARIO,
                        POSICAO,
                        PONTOS,
                        GOLS,
                        PREMIO_JSON,
                        DT_ENTREGA
                    )
                    SELECT ?, ?, ?, ?, ?, ?, SYSDATETIME()
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM album.TB_ALBUM_EVENTO_PREMIO_ENTREGA WITH(UPDLOCK, HOLDLOCK)
                        WHERE ID_EVENTO = ?
                          AND ID_USUARIO = ?
                    )
                    """,
                    (
                        id_evento,
                        id_usuario,
                        posicao,
                        pontos,
                        gols,
                        premio_json,
                        id_evento,
                        id_usuario,
                    ),
                )

                if qtd_pacotes > 0:
                    self._criar_pacotes_premio(
                        cursor=cursor,
                        id_usuario=id_usuario,
                        nome_pacote=f"Premio {titulo_evento}",
                        qtd_pacotes=qtd_pacotes,
                        qtd_figurinhas=qtd_figurinhas_por_pacote,
                        detalhe_movimentacao=f"Premio Top {limite} do evento {titulo_evento}",
                        perfis_raridade=[
                            {"min_raridade": "raro", "qtd_garantidas": 1}
                            for _ in range(qtd_pacotes)
                        ],
                    )

                if id_figurinha_premio:
                    self._entregar_figurinha_premio_evento(
                        cursor=cursor,
                        id_usuario=id_usuario,
                        id_figurinha=id_figurinha_premio,
                        detalhe_movimentacao=f"Figurinha premio Top {limite} do evento {titulo_evento}",
                    )

                if self.moedas_habilitadas() and qtd_coins > 0:
                    self._registrar_movimentacao_aurora(
                        cursor=cursor,
                        id_usuario=id_usuario,
                        tp_movimentacao="GANHO",
                        tp_origem="evento_album",
                        id_origem=f"{id_evento}:{id_usuario}",
                        qtd_coins=qtd_coins,
                        descricao=f"Premio Top {limite} do evento {titulo_evento}",
                    )

                entregas += 1

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_EVENTO
                   SET FL_ATIVO = 0,
                       DT_ATUALIZACAO = SYSDATETIME()
                 WHERE ID_EVENTO = ?
                """,
                (id_evento,),
            )
            conexao.commit()
            return {"entregas": entregas}
        except Exception:
            if conexao:
                conexao.rollback()
            raise
        finally:
            if conexao:
                conexao.close()

    def listar_ultimos_ganhadores_eventos_album(self, limite: int = 5):
        if not self.eventos_album_habilitados():
            return []

        return self.db.execute_fetch(
            query=f"""
                SELECT TOP {int(limite)}
                    ROW_NUMBER() OVER (ORDER BY P.PONTOS DESC, P.GOLS DESC, P.DT_FIM ASC) AS POSICAO,
                    P.NM_USUARIO,
                    P.AREA,
                    E.PREMIO,
                    E.COR,
                    E.TITULO,
                    P.PONTOS,
                    P.GOLS,
                    P.DT_FIM
                FROM album.TB_ALBUM_EVENTO_PARTICIPACAO P WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_EVENTO E WITH(NOLOCK)
                    ON E.ID_EVENTO = P.ID_EVENTO
                INNER JOIN album.TB_ALBUM_EVENTO_PREMIO_ENTREGA PE WITH(NOLOCK)
                    ON PE.ID_EVENTO = P.ID_EVENTO
                   AND PE.ID_USUARIO = P.ID_USUARIO
                WHERE P.STATUS_PARTICIPACAO = 'CONCLUIDO'
                ORDER BY PE.DT_ENTREGA DESC
            """,
            parametros=(),
            one=False,
        ) or []

    def listar_movimentos_recentes_eventos_album(self, limite: int = 4):
        if not self.eventos_album_habilitados():
            return []

        return self.db.execute_fetch(
            query=f"""
                SELECT TOP {int(limite)}
                    P.NM_USUARIO,
                    E.TITULO,
                    E.PREMIO,
                    E.COR,
                    P.PONTOS,
                    P.GOLS,
                    P.DT_FIM
                FROM album.TB_ALBUM_EVENTO_PARTICIPACAO P WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_EVENTO E WITH(NOLOCK)
                    ON E.ID_EVENTO = P.ID_EVENTO
                INNER JOIN album.TB_ALBUM_EVENTO_PREMIO_ENTREGA PE WITH(NOLOCK)
                    ON PE.ID_EVENTO = P.ID_EVENTO
                   AND PE.ID_USUARIO = P.ID_USUARIO
                WHERE P.STATUS_PARTICIPACAO = 'CONCLUIDO'
                ORDER BY PE.DT_ENTREGA DESC
            """,
            parametros=(),
            one=False,
        ) or []

    def listar_lembretes_eventos_usuario(self, id_usuario: Any):
        if not self.eventos_lembretes_habilitados():
            return []

        return self.db.execute_fetch(
            query="""
                SELECT
                    ID_EVENTO,
                    FL_ATIVO,
                    DT_CADASTRO,
                    DT_ATUALIZACAO
                FROM album.TB_ALBUM_EVENTO_LEMBRETE WITH(NOLOCK)
                WHERE ID_USUARIO = ?
                  AND FL_ATIVO = 1
            """,
            parametros=(id_usuario,),
            one=False,
        ) or []

    def definir_lembrete_evento(self, id_usuario: Any, id_evento: str, ativo: bool):
        if not self.eventos_lembretes_habilitados():
            return False

        query = """
            UPDATE album.TB_ALBUM_EVENTO_LEMBRETE
               SET FL_ATIVO = ?,
                   DT_ATUALIZACAO = GETDATE()
             WHERE ID_USUARIO = ?
               AND ID_EVENTO = ?;

            IF @@ROWCOUNT = 0
            BEGIN
                INSERT INTO album.TB_ALBUM_EVENTO_LEMBRETE (
                    ID_USUARIO,
                    ID_EVENTO,
                    FL_ATIVO,
                    DT_CADASTRO,
                    DT_ATUALIZACAO
                )
                VALUES (?, ?, ?, GETDATE(), GETDATE());
            END
        """
        self.db.execute_commit(
            query=query,
            parametros=(1 if ativo else 0, id_usuario, id_evento, id_usuario, id_evento, 1 if ativo else 0),
        )
        return True

    def listar_operadores_mesmo_centro_custo(self, id_usuario: Any, centro_custo: str):
        query = """
            SELECT
                u.CPF_COLABORADOR,
                u.NM_COLABORADOR,
                u.CENTRO_CUSTO,
                u.SUPERVISOR
            FROM login.TB_USUARIOS u WITH(NOLOCK)
            WHERE u.CPF_COLABORADOR <> ?
              AND ISNULL(LTRIM(RTRIM(u.CENTRO_CUSTO)), '') = ISNULL(LTRIM(RTRIM(?)), '')
              AND ISNULL(LTRIM(RTRIM(u.CPF_COLABORADOR)), '') <> ''
            ORDER BY u.NM_COLABORADOR
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(id_usuario, centro_custo),
            one=False,
        ) or []

    def listar_participantes_duelos(self, ids_duelo: list[str]):
        if not self.duelos_habilitados() or not ids_duelo:
            return []

        placeholders = ", ".join("?" for _ in ids_duelo)
        query = f"""
            SELECT
                p.ID_DUELO_DIARIO,
                p.ID_USUARIO,
                p.TP_TIME,
                p.NR_ORDEM_TIME,
                p.VL_BASE_METRICA,
                u.NM_COLABORADOR,
                u.CENTRO_CUSTO,
                u.SUPERVISOR
            FROM album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE p WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON u.CPF_COLABORADOR = p.ID_USUARIO
            WHERE p.ID_DUELO_DIARIO IN ({placeholders})
            ORDER BY p.ID_DUELO_DIARIO, p.TP_TIME, p.NR_ORDEM_TIME, u.NM_COLABORADOR
        """

        return self.db.execute_fetch(query=query, parametros=tuple(ids_duelo), one=False) or []

    def listar_duelos_usuario(self, id_usuario: Any, limite_historico: int = 10):
        if not self.duelos_habilitados():
            return []

        limite_historico = max(1, int(limite_historico or 10))
        query = f"""
            WITH BASE AS (
                SELECT
                    d.ID_DUELO_DIARIO,
                    d.DT_DUELO,
                    d.ID_USUARIO_DESAFIANTE,
                    d.ID_USUARIO_DESAFIADO,
                    d.NM_CENTRO_CUSTO,
                    d.TP_METRICA_DUELO,
                    d.QTD_META_ACORDOS,
                    d.STATUS_DUELO,
                    d.DT_CRIACAO,
                    d.DT_RESPOSTA,
                    d.DT_INICIO_CONTAGEM,
                    d.DT_FIM_DUELO,
                    d.DT_CONCLUSAO,
                    d.ID_USUARIO_VENCEDOR,
                    d.VL_BASE_DESAFIANTE,
                    d.VL_BASE_DESAFIADO,
                    d.QTD_ACORDOS_DESAFIANTE,
                    d.QTD_ACORDOS_DESAFIADO,
                    d.NR_STREAK_VITORIAS_VENCEDOR,
                    desafiante.NM_COLABORADOR AS NM_DESAFIANTE,
                    desafiado.NM_COLABORADOR AS NM_DESAFIADO,
                    equipes.QTD_TIME_DESAFIANTE,
                    equipes.QTD_TIME_DESAFIADO,
                    ROW_NUMBER() OVER (
                        PARTITION BY
                            CASE
                                WHEN d.STATUS_DUELO IN ('VENCIDO', 'EXPIRADO', 'RECUSADO') THEN 'HISTORICO'
                                ELSE 'ATUAL'
                            END
                        ORDER BY
                            COALESCE(d.DT_CONCLUSAO, d.DT_RESPOSTA, d.DT_CRIACAO) DESC
                    ) AS RN_GRUPO
                FROM album.TB_ALBUM_DUELO_DIARIO d WITH(NOLOCK)
                INNER JOIN login.TB_USUARIOS desafiante WITH(NOLOCK)
                    ON desafiante.CPF_COLABORADOR = d.ID_USUARIO_DESAFIANTE
                INNER JOIN login.TB_USUARIOS desafiado WITH(NOLOCK)
                    ON desafiado.CPF_COLABORADOR = d.ID_USUARIO_DESAFIADO
                OUTER APPLY (
                    SELECT
                        SUM(CASE WHEN p.TP_TIME = 'DESAFIANTE' THEN 1 ELSE 0 END) AS QTD_TIME_DESAFIANTE,
                        SUM(CASE WHEN p.TP_TIME = 'DESAFIADO' THEN 1 ELSE 0 END) AS QTD_TIME_DESAFIADO
                    FROM album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE p WITH(NOLOCK)
                    WHERE p.ID_DUELO_DIARIO = d.ID_DUELO_DIARIO
                ) equipes
                WHERE EXISTS (
                    SELECT 1
                    FROM album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE p WITH(NOLOCK)
                    WHERE p.ID_DUELO_DIARIO = d.ID_DUELO_DIARIO
                      AND p.ID_USUARIO = ?
                )
            )
            SELECT *
            FROM BASE
            WHERE STATUS_DUELO NOT IN ('VENCIDO', 'EXPIRADO', 'RECUSADO')
               OR RN_GRUPO <= {limite_historico}
            ORDER BY COALESCE(DT_CONCLUSAO, DT_RESPOSTA, DT_CRIACAO) DESC
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(id_usuario,),
            one=False,
        ) or []

    def listar_feed_duelos_ativos(self, limite: int = 12):
        if not self.duelos_habilitados():
            return []

        query = f"""
            SELECT TOP ({max(1, int(limite or 12))})
                d.ID_DUELO_DIARIO,
                d.TP_METRICA_DUELO,
                d.QTD_META_ACORDOS,
                d.DT_RESPOSTA AS DT_EVENTO,
                desafiante.NM_COLABORADOR AS NM_DESAFIANTE,
                desafiado.NM_COLABORADOR AS NM_DESAFIADO
            FROM album.TB_ALBUM_DUELO_DIARIO d WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS desafiante WITH(NOLOCK)
                ON desafiante.CPF_COLABORADOR = d.ID_USUARIO_DESAFIANTE
            INNER JOIN login.TB_USUARIOS desafiado WITH(NOLOCK)
                ON desafiado.CPF_COLABORADOR = d.ID_USUARIO_DESAFIADO
            WHERE d.STATUS_DUELO = 'ATIVO'
              AND d.DT_RESPOSTA IS NOT NULL
            ORDER BY d.DT_RESPOSTA DESC
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_feed_duelos_vencidos(self, limite: int = 12):
        if not self.duelos_habilitados():
            return []

        query = f"""
            SELECT TOP ({max(1, int(limite or 12))})
                d.ID_DUELO_DIARIO,
                d.TP_METRICA_DUELO,
                d.QTD_META_ACORDOS,
                d.DT_CONCLUSAO AS DT_EVENTO,
                vencedor.NM_COLABORADOR AS NM_VENCEDOR,
                CASE
                    WHEN d.ID_USUARIO_VENCEDOR = d.ID_USUARIO_DESAFIANTE THEN desafiado.NM_COLABORADOR
                    ELSE desafiante.NM_COLABORADOR
                END AS NM_PERDEDOR,
                d.NR_STREAK_VITORIAS_VENCEDOR
            FROM album.TB_ALBUM_DUELO_DIARIO d WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS desafiante WITH(NOLOCK)
                ON desafiante.CPF_COLABORADOR = d.ID_USUARIO_DESAFIANTE
            INNER JOIN login.TB_USUARIOS desafiado WITH(NOLOCK)
                ON desafiado.CPF_COLABORADOR = d.ID_USUARIO_DESAFIADO
            INNER JOIN login.TB_USUARIOS vencedor WITH(NOLOCK)
                ON vencedor.CPF_COLABORADOR = d.ID_USUARIO_VENCEDOR
            WHERE d.STATUS_DUELO = 'VENCIDO'
              AND d.DT_CONCLUSAO IS NOT NULL
            ORDER BY d.DT_CONCLUSAO DESC
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_feed_streak_duelos(self, limite: int = 8):
        if not self.duelos_habilitados():
            return []

        query = f"""
            SELECT TOP ({max(1, int(limite or 8))})
                d.ID_DUELO_DIARIO,
                d.DT_CONCLUSAO AS DT_EVENTO,
                vencedor.NM_COLABORADOR AS NM_VENCEDOR,
                d.NR_STREAK_VITORIAS_VENCEDOR
            FROM album.TB_ALBUM_DUELO_DIARIO d WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS vencedor WITH(NOLOCK)
                ON vencedor.CPF_COLABORADOR = d.ID_USUARIO_VENCEDOR
            WHERE d.STATUS_DUELO = 'VENCIDO'
              AND d.NR_STREAK_VITORIAS_VENCEDOR >= 3
              AND d.DT_CONCLUSAO IS NOT NULL
            ORDER BY d.DT_CONCLUSAO DESC
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def obter_saldo_aurora_coins(self, id_usuario: Any):
        if not self.moedas_habilitadas():
            return {
                "saldo_atual": 0,
                "total_ganho": 0,
                "total_gasto": 0,
            }

        query = """
            SELECT
                ISNULL(s.QTD_SALDO_ATUAL, 0) AS SALDO_ATUAL,
                ISNULL(SUM(CASE WHEN m.QTD_COINS > 0 THEN m.QTD_COINS ELSE 0 END), 0) AS TOTAL_GANHO,
                ISNULL(SUM(CASE WHEN m.QTD_COINS < 0 THEN ABS(m.QTD_COINS) ELSE 0 END), 0) AS TOTAL_GASTO
            FROM album.TB_ALBUM_AURORA_COIN_SALDO s WITH(NOLOCK)
            LEFT JOIN album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO m WITH(NOLOCK)
                ON m.ID_USUARIO = s.ID_USUARIO
            WHERE s.ID_USUARIO = ?
            GROUP BY s.QTD_SALDO_ATUAL
        """

        row = self.db.execute_fetch(query=query, parametros=(id_usuario,), one=True)
        if row:
            return {
                "saldo_atual": int(row.get("SALDO_ATUAL") or 0),
                "total_ganho": int(row.get("TOTAL_GANHO") or 0),
                "total_gasto": int(row.get("TOTAL_GASTO") or 0),
            }

        return {
            "saldo_atual": 0,
            "total_ganho": 0,
            "total_gasto": 0,
        }

    def listar_extrato_aurora_coins(self, id_usuario: Any, limite: int = 20):
        if not self.moedas_habilitadas():
            return []

        query = f"""
            SELECT TOP ({int(limite)})
                ID_MOVIMENTACAO_AURORA,
                TP_MOVIMENTACAO,
                TP_ORIGEM,
                ID_ORIGEM,
                QTD_COINS,
                DS_MOVIMENTACAO,
                DT_MOVIMENTACAO
            FROM album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO WITH(NOLOCK)
            WHERE ID_USUARIO = ?
            ORDER BY DT_MOVIMENTACAO DESC, ID_MOVIMENTACAO_AURORA DESC
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario,), one=False) or []

    def _garantir_carteira_aurora(self, cursor, id_usuario: Any):
        cursor.execute(
            """
            UPDATE album.TB_ALBUM_AURORA_COIN_SALDO
            SET DT_ATUALIZACAO = DT_ATUALIZACAO
            WHERE ID_USUARIO = ?
            """,
            (id_usuario,),
        )

        if cursor.rowcount == 0:
            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_AURORA_COIN_SALDO (
                    ID_USUARIO,
                    QTD_SALDO_ATUAL,
                    DT_ATUALIZACAO
                )
                VALUES (?, 0, GETDATE())
                """,
                (id_usuario,),
            )

    def _registrar_movimentacao_aurora(
        self,
        cursor,
        id_usuario: Any,
        tp_movimentacao: str,
        tp_origem: str,
        id_origem: str,
        qtd_coins: int,
        descricao: str,
        permitir_duplicidade: bool = False,
    ):
        if qtd_coins == 0:
            return False

        self._garantir_carteira_aurora(cursor, id_usuario)

        if not permitir_duplicidade:
            cursor.execute(
                """
                SELECT TOP 1 1
                FROM album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_USUARIO = ?
                  AND TP_ORIGEM = ?
                  AND ID_ORIGEM = ?
                """,
                (id_usuario, tp_origem, id_origem),
            )
            if cursor.fetchone():
                return False

        cursor.execute(
            """
            UPDATE album.TB_ALBUM_AURORA_COIN_SALDO
            SET
                QTD_SALDO_ATUAL = ISNULL(QTD_SALDO_ATUAL, 0) + ?,
                DT_ATUALIZACAO = GETDATE()
            WHERE ID_USUARIO = ?
            """,
            (qtd_coins, id_usuario),
        )

        cursor.execute(
            """
            INSERT INTO album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO (
                ID_MOVIMENTACAO_AURORA,
                ID_USUARIO,
                TP_MOVIMENTACAO,
                TP_ORIGEM,
                ID_ORIGEM,
                QTD_COINS,
                DS_MOVIMENTACAO,
                DT_MOVIMENTACAO
            )
            VALUES (NEWID(), ?, ?, ?, ?, ?, ?, GETDATE())
            """,
            (
                id_usuario,
                tp_movimentacao,
                tp_origem,
                id_origem,
                qtd_coins,
                descricao,
            ),
        )
        return True

    def sincronizar_recompensas_aurora(
        self,
        id_usuario: Any,
        conquistas_desbloqueadas: list[dict[str, Any]],
        equipes_completas: list[dict[str, Any]],
        moedas_por_conquista: dict[str, int],
        moedas_por_equipe: int,
    ):
        if not self.moedas_habilitadas():
            return

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            for conquista in conquistas_desbloqueadas:
                qtd = int(moedas_por_conquista.get(str(conquista.get("id")), 0) or 0)
                if qtd <= 0:
                    continue

                self._registrar_movimentacao_aurora(
                    cursor=cursor,
                    id_usuario=id_usuario,
                    tp_movimentacao="GANHO",
                    tp_origem="CONQUISTA",
                    id_origem=f"conquista:{conquista.get('id')}",
                    qtd_coins=qtd,
                    descricao=f"Conquista liberada: {conquista.get('titulo') or 'Conquista'}",
                )

            for equipe in equipes_completas:
                id_equipe = str(equipe.get("id_equipe") or "").strip()
                if not id_equipe or moedas_por_equipe <= 0:
                    continue

                self._registrar_movimentacao_aurora(
                    cursor=cursor,
                    id_usuario=id_usuario,
                    tp_movimentacao="GANHO",
                    tp_origem="EQUIPE_COMPLETA",
                    id_origem=f"equipe:{id_equipe}",
                    qtd_coins=int(moedas_por_equipe),
                    descricao=f"Equipe completa: {equipe.get('nome') or 'Equipe'}",
                )

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def obter_checkin_diario_album(
        self,
        id_usuario: Any,
        nome_pacote_diario: str = "Presen\u00c3\u00a7a Di\u00c3\u00a1ria",
        qtd_pacotes_diarios: int = 5,
    ):
        hoje = date.today()
        query = """
            SELECT
                CAST(DT_MOVIMENTACAO AS DATE) AS DT_CHECKIN
            FROM album.TB_ALBUM_MOVIMENTACAO WITH(NOLOCK)
            WHERE ID_USUARIO = ?
              AND TP_MOVIMENTACAO = ?
              AND DT_MOVIMENTACAO >= DATEADD(DAY, -45, CAST(GETDATE() AS DATE))
            ORDER BY DT_MOVIMENTACAO DESC
        """
        rows = self.db.execute_fetch(
            query=query,
            parametros=(id_usuario, self.CHECKIN_MOVIMENTACAO),
            one=False,
        ) or []
        datas = [
            row.get("DT_CHECKIN")
            for row in rows
            if isinstance(row.get("DT_CHECKIN"), date)
        ]
        streak_atual = self._calcular_streak_checkin_datas(datas, hoje)
        ja_resgatou_hoje = hoje in set(datas)
        proxima_sequencia = streak_atual + 1 if ja_resgatou_hoje else self._calcular_streak_checkin_datas(datas, hoje - timedelta(days=1)) + 1
        pacotes_hoje_row = self.db.execute_fetch(
            query="""
                SELECT COUNT(1) AS TOTAL
                FROM album.TB_ALBUM_PACOTE WITH(NOLOCK)
                WHERE ID_USUARIO = ?
                  AND NM_PACOTE = ?
                  AND CAST(DT_GANHO AS DATE) = CAST(GETDATE() AS DATE)
            """,
            parametros=(id_usuario, nome_pacote_diario),
            one=True,
        ) or {}
        pacotes_resgatados_hoje = int(pacotes_hoje_row.get("TOTAL") or 0)
        pacotes_diarios = int(qtd_pacotes_diarios or 5)
        pacotes_pendentes_hoje = max(pacotes_diarios - pacotes_resgatados_hoje, 0)

        return {
            "habilitado": True,
            "resgatado_hoje": ja_resgatou_hoje and pacotes_pendentes_hoje <= 0,
            "streak_atual": streak_atual,
            "proxima_sequencia": proxima_sequencia,
            "pacotes_diarios": pacotes_diarios,
            "pacotes_resgatados_hoje": pacotes_resgatados_hoje,
            "pacotes_pendentes_hoje": pacotes_pendentes_hoje,
            "figurinhas_por_pacote": 3,
            "bonus_proximo": self._descrever_bonus_checkin(proxima_sequencia),
        }

    def _descrever_bonus_checkin(self, sequencia: int):
        bonus = []
        if sequencia > 0 and sequencia % 3 == 0:
            bonus.append("1 pacote extra com raras ou superiores")
        if sequencia > 0 and sequencia % 7 == 0:
            bonus.append("1 pacote extra com ultra-raras ou superiores")
        return bonus

    def resgatar_checkin_diario_album(
        self,
        id_usuario: Any,
        nome_pacote: str,
        qtd_pacotes: int,
        qtd_figurinhas_por_pacote: int,
    ):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT TOP 1 DT_MOVIMENTACAO
                FROM album.TB_ALBUM_MOVIMENTACAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_USUARIO = ?
                  AND TP_MOVIMENTACAO = ?
                  AND CAST(DT_MOVIMENTACAO AS DATE) = CAST(GETDATE() AS DATE)
                """,
                (id_usuario, self.CHECKIN_MOVIMENTACAO),
            )
            checkin_hoje = cursor.fetchone()

            cursor.execute(
                """
                SELECT CAST(DT_MOVIMENTACAO AS DATE) AS DT_CHECKIN
                FROM album.TB_ALBUM_MOVIMENTACAO WITH(NOLOCK)
                WHERE ID_USUARIO = ?
                  AND TP_MOVIMENTACAO = ?
                  AND DT_MOVIMENTACAO >= DATEADD(DAY, -45, CAST(GETDATE() AS DATE))
                ORDER BY DT_MOVIMENTACAO DESC
                """,
                (id_usuario, self.CHECKIN_MOVIMENTACAO),
            )
            datas = [
                row[0]
                for row in cursor.fetchall()
                if isinstance(row[0], date)
            ]
            sequencia = self._calcular_streak_checkin_datas(
                datas,
                date.today() - timedelta(days=1),
            ) + 1
            if checkin_hoje:
                sequencia = self._calcular_streak_checkin_datas(datas, date.today())

            cursor.execute(
                """
                SELECT COUNT(1)
                FROM album.TB_ALBUM_PACOTE WITH(UPDLOCK, ROWLOCK)
                WHERE ID_USUARIO = ?
                  AND NM_PACOTE = ?
                  AND CAST(DT_GANHO AS DATE) = CAST(GETDATE() AS DATE)
                """,
                (id_usuario, nome_pacote),
            )
            pacotes_resgatados_hoje = int((cursor.fetchone() or [0])[0] or 0)
            pacotes_para_gerar = max(int(qtd_pacotes) - pacotes_resgatados_hoje, 0)
            if pacotes_para_gerar <= 0:
                raise ValueError("Check-in di\u00e1rio j\u00e1 resgatado hoje")

            self._criar_pacotes_premio(
                cursor=cursor,
                id_usuario=id_usuario,
                nome_pacote=nome_pacote,
                qtd_pacotes=pacotes_para_gerar,
                qtd_figurinhas=qtd_figurinhas_por_pacote,
                detalhe_movimentacao=f"Check-in di?rio do ?lbum: {sequencia} dia(s) de sequ?ncia",
            )

            bonus = [] if checkin_hoje else self._descrever_bonus_checkin(sequencia)
            if not checkin_hoje and sequencia % 3 == 0:
                self._criar_pacotes_premio(
                    cursor=cursor,
                    id_usuario=id_usuario,
                    nome_pacote="B?nus Sequ?ncia 3 Dias",
                    qtd_pacotes=1,
                    qtd_figurinhas=qtd_figurinhas_por_pacote,
                    detalhe_movimentacao=f"B?nus de check-in por {sequencia} dias de sequ?ncia",
                    perfis_raridade=[
                        {"min_raridade": "raro", "qtd_garantidas": qtd_figurinhas_por_pacote},
                    ],
                )

            if not checkin_hoje and sequencia % 7 == 0:
                self._criar_pacotes_premio(
                    cursor=cursor,
                    id_usuario=id_usuario,
                    nome_pacote="B?nus Sequ?ncia 7 Dias",
                    qtd_pacotes=1,
                    qtd_figurinhas=qtd_figurinhas_por_pacote,
                    detalhe_movimentacao=f"B?nus especial de check-in por {sequencia} dias de sequ?ncia",
                    perfis_raridade=[
                        {"min_raridade": "ultra-raro", "qtd_garantidas": qtd_figurinhas_por_pacote},
                    ],
                )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, GETDATE())
                """,
                (
                    id_usuario,
                    self.CHECKIN_MOVIMENTACAO,
                    f"Check-in di?rio resgatado com {sequencia} dia(s) de sequ?ncia",
                ),
            )

            conexao.commit()
            return {
                "resgatado": True,
                "streak_atual": sequencia,
                "pacotes_gerados": int(pacotes_para_gerar) + len(bonus),
                "figurinhas_por_pacote": int(qtd_figurinhas_por_pacote),
                "bonus": bonus,
            }
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def obter_spoiler_album(self, id_usuario: Any):
        query_aberto = """
            SELECT TOP 1 1
            FROM album.TB_ALBUM_MOVIMENTACAO WITH(NOLOCK)
            WHERE ID_USUARIO = ?
              AND TP_MOVIMENTACAO = ?
        """
        aberto = self.db.execute_fetch(
            query=query_aberto,
            parametros=(id_usuario, self.SPOILER_MOVIMENTACAO),
            one=True,
        )

        query_leitura = """
            SELECT TOP 1 1
            FROM album.TB_ALBUM_SPOILER_FEEDBACK WITH(NOLOCK)
            WHERE ID_USUARIO = ?
        """
        leitura_confirmada = False
        try:
            leitura_confirmada = bool(
                self.db.execute_fetch(
                    query=query_leitura,
                    parametros=(id_usuario,),
                    one=True,
                )
            )
        except Exception:
            leitura_confirmada = False

        query_pendente = """
            SELECT TOP 1
                ID_PACOTE,
                STATUS_PACOTE
            FROM album.TB_ALBUM_PACOTE WITH(NOLOCK)
            WHERE ID_USUARIO = ?
              AND NM_PACOTE = ?
              AND STATUS_PACOTE = 'FECHADO'
            ORDER BY DT_GANHO DESC, ID_PACOTE DESC
        """
        pendente = self.db.execute_fetch(
            query=query_pendente,
            parametros=(id_usuario, self.SPOILER_NOME_PACOTE),
            one=True,
        )

        return {
            "habilitado": True,
            "ja_abriu": bool(aberto),
            "deve_exibir": not bool(aberto) and not leitura_confirmada,
            "leitura_confirmada": leitura_confirmada,
            "id_pacote": str(pendente.get("ID_PACOTE")) if pendente else None,
        }

    def _buscar_pacote_spoiler_fechado_cursor(self, cursor, id_usuario: Any):
        cursor.execute(
            """
            SELECT TOP 1 ID_PACOTE
            FROM album.TB_ALBUM_PACOTE WITH(UPDLOCK, ROWLOCK)
            WHERE ID_USUARIO = ?
              AND NM_PACOTE = ?
              AND STATUS_PACOTE = 'FECHADO'
            ORDER BY DT_GANHO DESC, ID_PACOTE DESC
            """,
            (id_usuario, self.SPOILER_NOME_PACOTE),
        )
        row = cursor.fetchone()
        return row[0] if row else None

    def preparar_pacote_spoiler_album(self, id_usuario: Any):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT TOP 1 1
                FROM album.TB_ALBUM_MOVIMENTACAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_USUARIO = ?
                  AND TP_MOVIMENTACAO = ?
                """,
                (id_usuario, self.SPOILER_MOVIMENTACAO),
            )
            if cursor.fetchone():
                raise ValueError("Pacote spoiler j? foi aberto")

            id_pacote = self._buscar_pacote_spoiler_fechado_cursor(cursor, id_usuario)
            if id_pacote is None:
                pacotes = self._criar_pacotes_premio(
                    cursor=cursor,
                    id_usuario=id_usuario,
                    nome_pacote=self.SPOILER_NOME_PACOTE,
                    qtd_pacotes=1,
                    qtd_figurinhas=1,
                    detalhe_movimentacao="Pacote spoiler de antecipa??o do ?lbum",
                )
                id_pacote = pacotes[0]

            conexao.commit()
            return id_pacote
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def marcar_spoiler_album_aberto(self, id_usuario: Any, id_pacote: Any):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            cursor.execute(
                """
                SELECT TOP 1 1
                FROM album.TB_ALBUM_MOVIMENTACAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_USUARIO = ?
                  AND TP_MOVIMENTACAO = ?
                """,
                (id_usuario, self.SPOILER_MOVIMENTACAO),
            )
            if not cursor.fetchone():
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                        (ID_USUARIO, ID_PACOTE, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                    VALUES (?, ?, ?, ?, GETDATE())
                    """,
                    (
                        id_usuario,
                        id_pacote,
                        self.SPOILER_MOVIMENTACAO,
                        "Pacote spoiler do ?lbum aberto",
                    ),
                )
            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def registrar_feedback_spoiler_album(
        self,
        id_usuario: Any,
        nome_operador: str | None,
        carteira: str | None,
        gostou: bool,
        feedback: str | None,
        total_paginas: int | None = None,
        assunto: str | None = None,
    ):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                IF OBJECT_ID('album.TB_ALBUM_SPOILER_FEEDBACK', 'U') IS NULL
                BEGIN
                    CREATE TABLE album.TB_ALBUM_SPOILER_FEEDBACK (
                        ID_FEEDBACK BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        ID_USUARIO VARCHAR(50) NOT NULL,
                        NM_OPERADOR NVARCHAR(255) NULL,
                        CARTEIRA NVARCHAR(255) NULL,
                        FL_GOSTOU BIT NOT NULL,
                        DS_FEEDBACK NVARCHAR(MAX) NULL,
                        TP_ASSUNTO NVARCHAR(50) NULL,
                        NR_TOTAL_PAGINAS INT NULL,
                        DT_FEEDBACK DATETIME2 NOT NULL DEFAULT SYSDATETIME()
                    )
                END
                """
            )
            cursor.execute(
                """
                IF COL_LENGTH('album.TB_ALBUM_SPOILER_FEEDBACK', 'NM_OPERADOR') IS NULL
                BEGIN
                    ALTER TABLE album.TB_ALBUM_SPOILER_FEEDBACK
                    ADD NM_OPERADOR NVARCHAR(255) NULL
                END
                IF COL_LENGTH('album.TB_ALBUM_SPOILER_FEEDBACK', 'CARTEIRA') IS NULL
                BEGIN
                    ALTER TABLE album.TB_ALBUM_SPOILER_FEEDBACK
                    ADD CARTEIRA NVARCHAR(255) NULL
                END
                IF COL_LENGTH('album.TB_ALBUM_SPOILER_FEEDBACK', 'TP_ASSUNTO') IS NULL
                BEGIN
                    ALTER TABLE album.TB_ALBUM_SPOILER_FEEDBACK
                    ADD TP_ASSUNTO NVARCHAR(50) NULL
                END
                """
            )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_SPOILER_FEEDBACK (
                    ID_USUARIO,
                    NM_OPERADOR,
                    CARTEIRA,
                    FL_GOSTOU,
                    DS_FEEDBACK,
                    TP_ASSUNTO,
                    NR_TOTAL_PAGINAS,
                    DT_FEEDBACK
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, SYSDATETIME())
                """,
                (
                    str(id_usuario),
                    (nome_operador or "").strip()[:255] or None,
                    (carteira or "").strip()[:255] or None,
                    1 if gostou else 0,
                    (feedback or "").strip()[:500] or None,
                    (assunto or "").strip()[:50] or None,
                    total_paginas,
                ),
            )

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def obter_metricas_conquistas_usuario(self, id_usuario: Any):
        query = """
            SELECT
                (
                    SELECT COUNT(1)
                    FROM album.TB_ALBUM_META_USUARIO mu WITH(NOLOCK)
                    WHERE mu.ID_USUARIO = ?
                      AND ISNULL(mu.FL_BATEU_META, 0) = 1
                ) AS TOTAL_METAS_BATIDAS,
                (
                    SELECT COUNT(1)
                    FROM album.TB_ALBUM_PACOTE p WITH(NOLOCK)
                    WHERE p.ID_USUARIO = ?
                      AND UPPER(ISNULL(p.STATUS_PACOTE, '')) = 'ABERTO'
                ) AS TOTAL_PACOTES_ABERTOS,
                CASE
                    WHEN OBJECT_ID('album.TB_ALBUM_TROCA_FIGURINHA', 'U') IS NULL THEN 0
                    ELSE (
                        SELECT COUNT(1)
                        FROM album.TB_ALBUM_TROCA_FIGURINHA t WITH(NOLOCK)
                        WHERE (t.ID_USUARIO_SOLICITANTE = ? OR t.ID_USUARIO_DESTINATARIO = ?)
                          AND UPPER(ISNULL(t.STATUS_TROCA, '')) = 'ACEITA'
                    )
                END AS TOTAL_TROCAS_ACEITAS
        """

        return self.db.execute_fetch(
            query=query,
            parametros=(id_usuario, id_usuario, id_usuario, id_usuario),
            one=True,
        ) or {}

    def listar_feed_metas(self, limite: int = 20):
        query = f"""
            SELECT TOP ({int(limite)})
                mu.ID_META_USUARIO,
                mu.ID_USUARIO,
                u.CPF_COLABORADOR,
                u.NM_COLABORADOR,
                u.CENTRO_CUSTO,
                m.ID_META,
                m.NM_META,
                m.UNIDADE,
                mu.VL_APURADO,
                mu.VL_ALVO,
                mu.DT_REFERENCIA_INICIO,
                mu.DT_REFERENCIA_FIM,
                COALESCE(mu.DT_PREMIO_GERADO, mu.DT_APURACAO, mu.DT_REFERENCIA_FIM) AS DT_EVENTO
            FROM album.TB_ALBUM_META_USUARIO mu WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_META m WITH(NOLOCK)
                ON m.ID_META = mu.ID_META
            INNER JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON u.CPF_COLABORADOR = mu.ID_USUARIO
            WHERE ISNULL(mu.FL_BATEU_META, 0) = 1
            ORDER BY COALESCE(mu.DT_PREMIO_GERADO, mu.DT_APURACAO, mu.DT_REFERENCIA_FIM) DESC
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_feed_unlocks_raros(self, limite: int = 20):
        query = f"""
            SELECT TOP ({int(limite)})
                inv.ID_USUARIO,
                u.CPF_COLABORADOR,
                u.NM_COLABORADOR,
                u.CENTRO_CUSTO,
                f.ID_FIGURINHA,
                f.NM_FIGURINHA,
                f.FL_BOSS,
                e.NM_EQUIPE,
                r.NM_RARIDADE,
                COALESCE(inv.DT_PRIMEIRA_OBTENCAO, inv.DT_ULTIMA_OBTENCAO) AS DT_EVENTO
            FROM album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                ON f.ID_FIGURINHA = inv.ID_FIGURINHA
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            INNER JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON u.CPF_COLABORADOR = inv.ID_USUARIO
            WHERE ISNULL(inv.QTD_TOTAL, 0) > 0
              AND COALESCE(inv.DT_PRIMEIRA_OBTENCAO, inv.DT_ULTIMA_OBTENCAO) IS NOT NULL
              AND (
                    LOWER(LTRIM(RTRIM(ISNULL(r.NM_RARIDADE, '')))) IN ('epico', 'épico', 'lendario', 'lendário', 'boss')
                    OR ISNULL(f.FL_BOSS, 0) = 1
              )
            ORDER BY COALESCE(inv.DT_PRIMEIRA_OBTENCAO, inv.DT_ULTIMA_OBTENCAO) DESC
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_feed_trocas_aceitas(self, limite: int = 20):
        if not self.trocas_habilitadas():
            return []

        query = f"""
            SELECT TOP ({int(limite)})
                t.ID_TROCA_FIGURINHA,
                t.ID_USUARIO_SOLICITANTE,
                t.ID_USUARIO_DESTINATARIO,
                sol.NM_COLABORADOR AS NM_SOLICITANTE,
                dest.NM_COLABORADOR AS NM_DESTINATARIO,
                sol.CENTRO_CUSTO AS CARTEIRA_SOLICITANTE,
                dest.CENTRO_CUSTO AS CARTEIRA_DESTINATARIO,
                fo.NM_FIGURINHA AS NM_FIGURINHA_OFERECIDA,
                fd.NM_FIGURINHA AS NM_FIGURINHA_DESEJADA,
                t.DT_RESPOSTA AS DT_EVENTO
            FROM album.TB_ALBUM_TROCA_FIGURINHA t WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS sol WITH(NOLOCK)
                ON sol.CPF_COLABORADOR = t.ID_USUARIO_SOLICITANTE
            INNER JOIN login.TB_USUARIOS dest WITH(NOLOCK)
                ON dest.CPF_COLABORADOR = t.ID_USUARIO_DESTINATARIO
            INNER JOIN album.TB_ALBUM_FIGURINHA fo WITH(NOLOCK)
                ON fo.ID_FIGURINHA = t.ID_FIGURINHA_OFERECIDA
            INNER JOIN album.TB_ALBUM_FIGURINHA fd WITH(NOLOCK)
                ON fd.ID_FIGURINHA = t.ID_FIGURINHA_DESEJADA
            WHERE UPPER(ISNULL(t.STATUS_TROCA, '')) = 'ACEITA'
              AND t.DT_RESPOSTA IS NOT NULL
            ORDER BY t.DT_RESPOSTA DESC
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_feed_campanhas(self, limite: int = 20):
        query = f"""
            SELECT TOP ({int(limite)})
                c.ID_CAMPANHA_PREMIO,
                c.NM_CAMPANHA,
                c.CPF_SUPERVISOR,
                c.CPF_COLABORADOR,
                u.NM_COLABORADOR,
                u.CENTRO_CUSTO,
                c.QTD_PACOTES,
                c.QTD_FIGURINHAS_POR_PACOTE,
                c.DT_CADASTRO AS DT_EVENTO
            FROM album.TB_ALBUM_CAMPANHA_PREMIO c WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON u.CPF_COLABORADOR = c.CPF_COLABORADOR
            ORDER BY c.DT_CADASTRO DESC
        """

        return self.db.execute_fetch(query=query, parametros=(), one=False) or []

    def listar_reacoes_feed(self, ids_evento: list[str], id_usuario: Any):
        if not ids_evento or not self.feed_reacoes_habilitadas():
            return {}

        placeholders = ", ".join("?" for _ in ids_evento)
        query = f"""
            SELECT
                r.ID_EVENTO,
                SUM(CASE WHEN r.TP_REACAO = 'like' THEN 1 ELSE 0 END) AS TOTAL_LIKES,
                SUM(CASE WHEN r.TP_REACAO = 'love' THEN 1 ELSE 0 END) AS TOTAL_LOVES,
                SUM(CASE WHEN r.TP_REACAO = 'clap' THEN 1 ELSE 0 END) AS TOTAL_CLAPS,
                MAX(CASE WHEN r.CPF_COLABORADOR = ? THEN r.TP_REACAO ELSE NULL END) AS MINHA_REACAO
            FROM album.TB_ALBUM_FEED_REACAO r WITH(NOLOCK)
            WHERE r.ID_EVENTO IN ({placeholders})
            GROUP BY r.ID_EVENTO
        """

        rows = self.db.execute_fetch(
            query=query,
            parametros=(id_usuario, *ids_evento),
            one=False,
        ) or []

        return {
            str(row["ID_EVENTO"]): {
                "like": int(row.get("TOTAL_LIKES") or 0),
                "love": int(row.get("TOTAL_LOVES") or 0),
                "clap": int(row.get("TOTAL_CLAPS") or 0),
                "minha_reacao": row.get("MINHA_REACAO"),
            }
            for row in rows
        }

    def alternar_reacao_feed(self, id_evento: str, id_usuario: Any, tipo_reacao: str):
        if not self.feed_reacoes_habilitadas():
            raise RuntimeError(
                "Estrutura de reações do feed não encontrada no banco. Execute o script backend/sql/album_social.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT TOP 1 TP_REACAO
                FROM album.TB_ALBUM_FEED_REACAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_EVENTO = ?
                  AND CPF_COLABORADOR = ?
                """,
                (id_evento, id_usuario),
            )
            atual = cursor.fetchone()

            if atual and str(atual[0] or "").lower() == str(tipo_reacao or "").lower():
                cursor.execute(
                    """
                    DELETE FROM album.TB_ALBUM_FEED_REACAO
                    WHERE ID_EVENTO = ?
                      AND CPF_COLABORADOR = ?
                    """,
                    (id_evento, id_usuario),
                )
            elif atual:
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_FEED_REACAO
                    SET
                        TP_REACAO = ?,
                        DT_CADASTRO = GETDATE()
                    WHERE ID_EVENTO = ?
                      AND CPF_COLABORADOR = ?
                    """,
                    (tipo_reacao, id_evento, id_usuario),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_FEED_REACAO (
                        ID_FEED_REACAO,
                        ID_EVENTO,
                        CPF_COLABORADOR,
                        TP_REACAO,
                        DT_CADASTRO
                    )
                    VALUES (NEWID(), ?, ?, ?, GETDATE())
                    """,
                    (id_evento, id_usuario, tipo_reacao),
                )

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

        return self.listar_reacoes_feed([id_evento], id_usuario).get(
            id_evento,
            {"like": 0, "love": 0, "clap": 0, "minha_reacao": None},
        )

    def listar_repetidas_usuario(self, id_usuario: Any):
        query = """
            SELECT
                f.ID_FIGURINHA,
                f.ID_EQUIPE,
                e.NM_EQUIPE,
                r.NM_RARIDADE,
                f.NM_FIGURINHA,
                f.URL_IMAGEM,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.FL_BOSS,
                inv.QTD_TOTAL,
                inv.QTD_COLADAS,
                CASE
                    WHEN ISNULL(inv.QTD_TOTAL, 0) > ISNULL(inv.QTD_COLADAS, 0)
                        THEN ISNULL(inv.QTD_TOTAL, 0) - ISNULL(inv.QTD_COLADAS, 0)
                    ELSE 0
                END AS QTD_REPETIDAS
            FROM album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                ON f.ID_FIGURINHA = inv.ID_FIGURINHA
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            WHERE inv.ID_USUARIO = ?
              AND ISNULL(inv.QTD_TOTAL, 0) > ISNULL(inv.QTD_COLADAS, 0)
              AND f.FL_ATIVA = 1
              AND e.FL_ATIVA = 1
            ORDER BY e.ORDEM_EXIBICAO, f.NR_SLOT_EQUIPE, f.NM_FIGURINHA
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario,), one=False) or []

    def listar_figurinhas_faltantes_usuario(self, id_usuario: Any):
        query = """
            SELECT
                f.ID_FIGURINHA,
                f.ID_EQUIPE,
                e.NM_EQUIPE,
                r.NM_RARIDADE,
                f.NM_FIGURINHA,
                f.URL_IMAGEM,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.FL_BOSS,
                ISNULL(inv.QTD_TOTAL, 0) AS QTD_TOTAL,
                ISNULL(inv.QTD_COLADAS, 0) AS QTD_COLADAS,
                0 AS QTD_REPETIDAS
            FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            LEFT JOIN album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
                ON inv.ID_FIGURINHA = f.ID_FIGURINHA
               AND inv.ID_USUARIO = ?
            WHERE f.FL_ATIVA = 1
              AND e.FL_ATIVA = 1
              AND ISNULL(inv.QTD_TOTAL, 0) = 0
            ORDER BY e.ORDEM_EXIBICAO, f.NR_SLOT_EQUIPE, f.NM_FIGURINHA
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario,), one=False) or []

    def listar_ranking_album(self, limite: int = 50):
        cargos_operador = [
            "aprendiz operador(a) cobrador",
            "operador(a) cobrador(a)",
            "negociador",
            "negociador |",
            "omnichannel",
        ]
        filtros_cargo = " OR ".join(
            "LOWER(LTRIM(RTRIM(ISNULL(u.FUNCAO_COLABORADOR, '')))) LIKE ?"
            for _ in cargos_operador
        )
        query = f"""
            WITH BASE AS (
                SELECT
                    u.CPF_COLABORADOR,
                    u.NM_COLABORADOR,
                    u.CENTRO_CUSTO AS CARTEIRA,
                    COUNT(CASE WHEN ISNULL(inv.QTD_TOTAL, 0) > 0 THEN 1 END) AS TOTAL_FIGURINHAS,
                    SUM(ISNULL(inv.QTD_TOTAL, 0)) AS TOTAL_OBTIDAS
                FROM login.TB_USUARIOS u WITH(NOLOCK)
                LEFT JOIN album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
                    ON inv.ID_USUARIO = u.CPF_COLABORADOR
                WHERE ISNULL(u.CPF_COLABORADOR, '') <> ''
                  AND ISNULL(u.NM_COLABORADOR, '') <> ''
                  AND ({filtros_cargo})
                GROUP BY u.CPF_COLABORADOR, u.NM_COLABORADOR, u.CENTRO_CUSTO
            ),
            RANKING AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        ORDER BY TOTAL_FIGURINHAS DESC, TOTAL_OBTIDAS DESC, NM_COLABORADOR
                    ) AS POSICAO
                FROM BASE
            )
            SELECT TOP ({int(limite)})
                CPF_COLABORADOR,
                NM_COLABORADOR,
                CARTEIRA,
                TOTAL_FIGURINHAS,
                TOTAL_OBTIDAS,
                POSICAO
            FROM RANKING
            ORDER BY POSICAO
        """

        parametros = tuple(f"%{cargo}%" for cargo in cargos_operador)
        return self.db.execute_fetch(query=query, parametros=parametros, one=False) or []

    def buscar_posicao_ranking_album(self, id_usuario: Any):
        cargos_operador = [
            "aprendiz operador(a) cobrador",
            "operador(a) cobrador(a)",
            "negociador",
            "negociador |",
            "omnichannel",
        ]
        filtros_cargo = " OR ".join(
            "LOWER(LTRIM(RTRIM(ISNULL(u.FUNCAO_COLABORADOR, '')))) LIKE ?"
            for _ in cargos_operador
        )
        query = f"""
            WITH BASE AS (
                SELECT
                    u.CPF_COLABORADOR,
                    u.NM_COLABORADOR,
                    u.CENTRO_CUSTO AS CARTEIRA,
                    COUNT(CASE WHEN ISNULL(inv.QTD_TOTAL, 0) > 0 THEN 1 END) AS TOTAL_FIGURINHAS,
                    SUM(ISNULL(inv.QTD_TOTAL, 0)) AS TOTAL_OBTIDAS
                FROM login.TB_USUARIOS u WITH(NOLOCK)
                LEFT JOIN album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
                    ON inv.ID_USUARIO = u.CPF_COLABORADOR
                WHERE ISNULL(u.CPF_COLABORADOR, '') <> ''
                  AND ISNULL(u.NM_COLABORADOR, '') <> ''
                  AND ({filtros_cargo})
                GROUP BY u.CPF_COLABORADOR, u.NM_COLABORADOR, u.CENTRO_CUSTO
            ),
            RANKING AS (
                SELECT
                    *,
                    ROW_NUMBER() OVER (
                        ORDER BY TOTAL_FIGURINHAS DESC, TOTAL_OBTIDAS DESC, NM_COLABORADOR
                    ) AS POSICAO
                FROM BASE
            )
            SELECT TOP 1
                CPF_COLABORADOR,
                NM_COLABORADOR,
                CARTEIRA,
                TOTAL_FIGURINHAS,
                TOTAL_OBTIDAS,
                POSICAO
            FROM RANKING
            WHERE CPF_COLABORADOR = ?
        """

        parametros = tuple(f"%{cargo}%" for cargo in cargos_operador) + (id_usuario,)
        return self.db.execute_fetch(query=query, parametros=parametros, one=True)

    def listar_figurinhas_operador_ranking(self, id_usuario: Any):
        query = """
            SELECT
                f.ID_FIGURINHA,
                f.ID_EQUIPE,
                e.NM_EQUIPE,
                e.SG_EQUIPE,
                f.ID_RARIDADE,
                r.NM_RARIDADE,
                r.SG_RARIDADE,
                r.COR_HEX,
                f.NM_FIGURINHA,
                f.URL_IMAGEM,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.FL_BOSS,
                p.NM_COLABORADOR,
                ISNULL(inv.QTD_TOTAL, 0) AS QTD_TOTAL,
                ISNULL(inv.QTD_COLADAS, 0) AS QTD_COLADAS
            FROM album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                ON f.ID_FIGURINHA = inv.ID_FIGURINHA
            INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            WHERE inv.ID_USUARIO = ?
              AND ISNULL(inv.QTD_TOTAL, 0) > 0
              AND f.FL_ATIVA = 1
              AND p.FL_ATIVO = 1
              AND e.FL_ATIVA = 1
            ORDER BY
                e.ORDEM_EXIBICAO,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.NM_FIGURINHA
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario,), one=False) or []

    def listar_operadores_com_repetidas(self, id_usuario: Any):
        query = """
            SELECT
                u.CPF_COLABORADOR,
                u.NM_COLABORADOR,
                u.SUPERVISOR,
                COUNT(1) AS TOTAL_FIGURINHAS_REPETIDAS,
                SUM(
                    CASE
                        WHEN ISNULL(inv.QTD_TOTAL, 0) > ISNULL(inv.QTD_COLADAS, 0)
                            THEN ISNULL(inv.QTD_TOTAL, 0) - ISNULL(inv.QTD_COLADAS, 0)
                        ELSE 0
                    END
                ) AS TOTAL_UNIDADES_REPETIDAS
            FROM album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON u.CPF_COLABORADOR = inv.ID_USUARIO
            WHERE inv.ID_USUARIO <> ?
              AND ISNULL(inv.QTD_TOTAL, 0) > ISNULL(inv.QTD_COLADAS, 0)
            GROUP BY u.CPF_COLABORADOR, u.NM_COLABORADOR, u.SUPERVISOR
            ORDER BY u.NM_COLABORADOR
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario,), one=False) or []

    def listar_solicitacoes_troca_usuario(self, id_usuario: Any):
        query = """
            SELECT
                t.ID_TROCA_FIGURINHA,
                t.ID_USUARIO_SOLICITANTE,
                t.ID_USUARIO_DESTINATARIO,
                t.STATUS_TROCA,
                t.DT_SOLICITACAO,
                t.DT_RESPOSTA,
                sol.NM_COLABORADOR AS NM_SOLICITANTE,
                dest.NM_COLABORADOR AS NM_DESTINATARIO,
                fo.ID_FIGURINHA AS ID_FIGURINHA_OFERECIDA,
                fo.NM_FIGURINHA AS NM_FIGURINHA_OFERECIDA,
                fo.URL_IMAGEM AS URL_IMAGEM_OFERECIDA,
                eo.NM_EQUIPE AS NM_EQUIPE_OFERECIDA,
                ro.NM_RARIDADE AS NM_RARIDADE_OFERECIDA,
                fd.ID_FIGURINHA AS ID_FIGURINHA_DESEJADA,
                fd.NM_FIGURINHA AS NM_FIGURINHA_DESEJADA,
                fd.URL_IMAGEM AS URL_IMAGEM_DESEJADA,
                ed.NM_EQUIPE AS NM_EQUIPE_DESEJADA,
                rd.NM_RARIDADE AS NM_RARIDADE_DESEJADA
            FROM album.TB_ALBUM_TROCA_FIGURINHA t WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS sol WITH(NOLOCK)
                ON sol.CPF_COLABORADOR = t.ID_USUARIO_SOLICITANTE
            INNER JOIN login.TB_USUARIOS dest WITH(NOLOCK)
                ON dest.CPF_COLABORADOR = t.ID_USUARIO_DESTINATARIO
            INNER JOIN album.TB_ALBUM_FIGURINHA fo WITH(NOLOCK)
                ON fo.ID_FIGURINHA = t.ID_FIGURINHA_OFERECIDA
            INNER JOIN album.TB_ALBUM_EQUIPE eo WITH(NOLOCK)
                ON eo.ID_EQUIPE = fo.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE ro WITH(NOLOCK)
                ON ro.ID_RARIDADE = fo.ID_RARIDADE
            INNER JOIN album.TB_ALBUM_FIGURINHA fd WITH(NOLOCK)
                ON fd.ID_FIGURINHA = t.ID_FIGURINHA_DESEJADA
            INNER JOIN album.TB_ALBUM_EQUIPE ed WITH(NOLOCK)
                ON ed.ID_EQUIPE = fd.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE rd WITH(NOLOCK)
                ON rd.ID_RARIDADE = fd.ID_RARIDADE
            WHERE t.ID_USUARIO_SOLICITANTE = ?
               OR t.ID_USUARIO_DESTINATARIO = ?
            ORDER BY t.DT_SOLICITACAO DESC
        """

        return self.db.execute_fetch(query=query, parametros=(id_usuario, id_usuario), one=False) or []

    def _buscar_inventario_para_troca(self, cursor, id_usuario: Any, id_figurinha: Any):
        cursor.execute(
            """
            SELECT TOP 1
                ID_INVENTARIO,
                ISNULL(QTD_TOTAL, 0) AS QTD_TOTAL,
                ISNULL(QTD_COLADAS, 0) AS QTD_COLADAS
            FROM album.TB_ALBUM_INVENTARIO_USUARIO WITH(UPDLOCK, ROWLOCK)
            WHERE ID_USUARIO = ?
              AND ID_FIGURINHA = ?
            """,
            (id_usuario, id_figurinha),
        )
        return cursor.fetchone()

    def contar_repetidas_disponiveis_usuario(
        self,
        id_usuario: Any,
        excluir_id_figurinha: Any | None = None,
    ) -> int:
        query = """
            SELECT
                SUM(
                    CASE
                        WHEN ISNULL(QTD_TOTAL, 0) > ISNULL(QTD_COLADAS, 0)
                            THEN ISNULL(QTD_TOTAL, 0) - ISNULL(QTD_COLADAS, 0)
                        ELSE 0
                    END
                ) AS TOTAL_REPETIDAS
            FROM album.TB_ALBUM_INVENTARIO_USUARIO WITH(NOLOCK)
            WHERE ID_USUARIO = ?
              AND (? IS NULL OR ID_FIGURINHA <> ?)
        """
        row = self.db.execute_fetch(
            query=query,
            parametros=(id_usuario, excluir_id_figurinha, excluir_id_figurinha),
            one=True,
        )
        return int((row or {}).get("TOTAL_REPETIDAS") or 0)

    def usuario_resgatou_pacote_misterioso(
        self,
        id_usuario: Any,
        id_figurinha: Any,
        nome_pacote: str,
    ) -> bool:
        query = """
            SELECT TOP 1 1 AS ENCONTRADO
            FROM album.TB_ALBUM_PACOTE p WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_PACOTE_ITEM pi WITH(NOLOCK)
                ON pi.ID_PACOTE = p.ID_PACOTE
            WHERE p.ID_USUARIO = ?
              AND p.NM_PACOTE = ?
              AND pi.ID_FIGURINHA = ?
        """
        row = self.db.execute_fetch(
            query=query,
            parametros=(id_usuario, nome_pacote, id_figurinha),
            one=True,
        )
        return bool(row)

    def contar_resgates_pacote_misterioso(
        self,
        id_figurinha_misteriosa: Any,
        nome_pacote: str,
    ) -> int:
        query = """
            SELECT COUNT(DISTINCT p.ID_USUARIO) AS TOTAL_RESGATES
            FROM album.TB_ALBUM_PACOTE p WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_PACOTE_ITEM pi WITH(NOLOCK)
                ON pi.ID_PACOTE = p.ID_PACOTE
            WHERE p.NM_PACOTE = ?
              AND pi.ID_FIGURINHA = ?
        """
        row = self.db.execute_fetch(
            query=query,
            parametros=(nome_pacote, id_figurinha_misteriosa),
            one=True,
        )
        return int((row or {}).get("TOTAL_RESGATES") or 0)

    def _registrar_recebimento_figurinha_troca(self, cursor, id_usuario: Any, id_figurinha: Any):
        cursor.execute(
            """
            UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
            SET
                QTD_TOTAL = ISNULL(QTD_TOTAL, 0) + 1,
                QTD_COLADAS = CASE
                    WHEN ISNULL(QTD_COLADAS, 0) = 0 THEN 1
                    ELSE QTD_COLADAS
                END,
                DT_ULTIMA_OBTENCAO = GETDATE()
            WHERE ID_USUARIO = ?
              AND ID_FIGURINHA = ?
            """,
            (id_usuario, id_figurinha),
        )

        if cursor.rowcount == 0:
            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_INVENTARIO_USUARIO
                    (ID_USUARIO, ID_FIGURINHA, QTD_TOTAL, QTD_COLADAS, DT_PRIMEIRA_OBTENCAO, DT_ULTIMA_OBTENCAO)
                VALUES (?, ?, 1, 1, GETDATE(), GETDATE())
                """,
                (id_usuario, id_figurinha),
            )

    def _obter_saldo_aurora_cursor(self, cursor, id_usuario: Any) -> int:
        self._garantir_carteira_aurora(cursor, id_usuario)
        cursor.execute(
            """
            SELECT TOP 1 ISNULL(QTD_SALDO_ATUAL, 0)
            FROM album.TB_ALBUM_AURORA_COIN_SALDO WITH(UPDLOCK, ROWLOCK)
            WHERE ID_USUARIO = ?
            """,
            (id_usuario,),
        )
        row = cursor.fetchone()
        return int(row[0] or 0) if row else 0

    def _finalizar_leilao_cursor(self, cursor, leilao, status_final: str):
        (
            id_leilao,
            id_figurinha,
            id_vendedor,
            id_maior_lance_usuario,
            vl_atual,
            status_leilao,
        ) = leilao

        if str(status_leilao or "").upper() != "ATIVO":
            return False

        status_final = str(status_final or "").upper()
        vendedor_sistema = str(id_vendedor or "").strip().upper() == self.LEILAO_VENDEDOR_SISTEMA
        if status_final == "VENDIDO" and id_maior_lance_usuario:
            self._registrar_recebimento_figurinha_troca(
                cursor,
                id_maior_lance_usuario,
                id_figurinha,
            )
            if not vendedor_sistema:
                self._registrar_movimentacao_aurora(
                    cursor=cursor,
                    id_usuario=id_vendedor,
                    tp_movimentacao="GANHO",
                    tp_origem="LEILAO_VENDA",
                    id_origem=f"leilao:{id_leilao}:vendedor",
                    qtd_coins=int(vl_atual or 0),
                    descricao="Venda de figurinha no leilao",
                    permitir_duplicidade=True,
                )
            cursor.execute(
                """
                UPDATE album.TB_ALBUM_LEILAO
                SET
                    STATUS_LEILAO = 'VENDIDO',
                    ID_USUARIO_COMPRADOR = ?,
                    DT_FINALIZACAO = SYSDATETIME(),
                    DT_ATUALIZACAO = SYSDATETIME()
                WHERE ID_LEILAO = ?
                """,
                (id_maior_lance_usuario, id_leilao),
            )
            return True

        if not vendedor_sistema:
            self._registrar_recebimento_figurinha_troca(cursor, id_vendedor, id_figurinha)
        cursor.execute(
            """
            UPDATE album.TB_ALBUM_LEILAO
            SET
                STATUS_LEILAO = ?,
                DT_FINALIZACAO = SYSDATETIME(),
                DT_ATUALIZACAO = SYSDATETIME()
            WHERE ID_LEILAO = ?
            """,
            (status_final if status_final in {"EXPIRADO", "CANCELADO"} else "EXPIRADO", id_leilao),
        )
        return True

    def finalizar_leiloes_expirados(self, limite: int = 50):
        if not self.leiloes_habilitados():
            return []

        finalizados = []
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            cursor.execute(
                f"""
                SELECT TOP ({max(1, int(limite or 50))})
                    ID_LEILAO,
                    ID_FIGURINHA,
                    ID_USUARIO_VENDEDOR,
                    ID_MAIOR_LANCE_USUARIO,
                    ISNULL(VL_ATUAL, 0) AS VL_ATUAL,
                    STATUS_LEILAO
                FROM album.TB_ALBUM_LEILAO WITH(UPDLOCK, ROWLOCK)
                WHERE STATUS_LEILAO = 'ATIVO'
                  AND DT_FIM <= SYSDATETIME()
                ORDER BY DT_FIM
                """
            )
            for leilao in cursor.fetchall() or []:
                status_final = "VENDIDO" if leilao[3] else "EXPIRADO"
                if self._finalizar_leilao_cursor(cursor, leilao, status_final):
                    finalizados.append(str(leilao[0]))

            conexao.commit()
            return finalizados
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def listar_leiloes_album(self, id_usuario: Any, termo: str | None = None, limite: int = 80):
        if not self.leiloes_habilitados():
            return []

        self.finalizar_leiloes_expirados()

        termo_like = f"%{str(termo or '').strip()}%"
        filtrar = bool(str(termo or "").strip())
        query = f"""
            SELECT TOP ({max(1, int(limite or 80))})
                l.ID_LEILAO,
                l.ID_FIGURINHA,
                l.ID_USUARIO_VENDEDOR,
                l.ID_USUARIO_COMPRADOR,
                l.ID_MAIOR_LANCE_USUARIO,
                l.VL_INICIAL,
                l.VL_COMPRE_JA,
                l.VL_ATUAL,
                l.STATUS_LEILAO,
                l.DT_INICIO,
                l.DT_FIM,
                l.DT_FINALIZACAO,
                f.NM_FIGURINHA,
                f.URL_IMAGEM,
                f.NR_SLOT_EQUIPE,
                f.ORDEM_EXIBICAO_GERAL,
                f.FL_BOSS,
                e.NM_EQUIPE,
                r.NM_RARIDADE,
                CASE
                    WHEN l.ID_USUARIO_VENDEDOR = ? THEN 'Sistema Copa Acme'
                    ELSE vendedor.NM_COLABORADOR
                END AS NM_VENDEDOR,
                comprador.NM_COLABORADOR AS NM_COMPRADOR,
                maior.NM_COLABORADOR AS NM_MAIOR_LANCE,
                ISNULL(lances.QTD_LANCES, 0) AS QTD_LANCES,
                CASE WHEN l.ID_USUARIO_VENDEDOR = ? THEN 1 ELSE 0 END AS MEU_ANUNCIO,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM album.TB_ALBUM_LEILAO_LANCE ml WITH(NOLOCK)
                    WHERE ml.ID_LEILAO = l.ID_LEILAO
                      AND ml.ID_USUARIO = ?
                ) THEN 1 ELSE 0 END AS MEU_LANCE,
                CASE WHEN l.ID_MAIOR_LANCE_USUARIO = ? THEN 1 ELSE 0 END AS EU_LIDERO
            FROM album.TB_ALBUM_LEILAO l WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                ON f.ID_FIGURINHA = l.ID_FIGURINHA
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            LEFT JOIN login.TB_USUARIOS vendedor WITH(NOLOCK)
                ON vendedor.CPF_COLABORADOR = l.ID_USUARIO_VENDEDOR
            LEFT JOIN login.TB_USUARIOS comprador WITH(NOLOCK)
                ON comprador.CPF_COLABORADOR = l.ID_USUARIO_COMPRADOR
            LEFT JOIN login.TB_USUARIOS maior WITH(NOLOCK)
                ON maior.CPF_COLABORADOR = l.ID_MAIOR_LANCE_USUARIO
            OUTER APPLY (
                SELECT COUNT(1) AS QTD_LANCES
                FROM album.TB_ALBUM_LEILAO_LANCE lance WITH(NOLOCK)
                WHERE lance.ID_LEILAO = l.ID_LEILAO
            ) lances
            WHERE (? = 0 OR f.NM_FIGURINHA LIKE ? OR e.NM_EQUIPE LIKE ?)
            ORDER BY
                CASE WHEN l.STATUS_LEILAO = 'ATIVO' THEN 0 ELSE 1 END,
                l.DT_FIM,
                l.DT_ATUALIZACAO DESC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(
                self.LEILAO_VENDEDOR_SISTEMA,
                id_usuario,
                id_usuario,
                id_usuario,
                int(filtrar),
                termo_like,
                termo_like,
            ),
            one=False,
        ) or []

    def listar_lances_leilao(self, id_leilao: str, limite: int = 20):
        if not self.leiloes_habilitados():
            return []

        query = f"""
            SELECT TOP ({max(1, int(limite or 20))})
                lance.ID_LANCE,
                lance.ID_LEILAO,
                lance.ID_USUARIO,
                usuario.NM_COLABORADOR,
                lance.VL_LANCE,
                lance.DT_LANCE
            FROM album.TB_ALBUM_LEILAO_LANCE lance WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS usuario WITH(NOLOCK)
                ON usuario.CPF_COLABORADOR = lance.ID_USUARIO
            WHERE lance.ID_LEILAO = ?
            ORDER BY lance.DT_LANCE DESC
        """
        return self.db.execute_fetch(query=query, parametros=(id_leilao,), one=False) or []

    def avaliar_mercado_leilao(self, id_figurinha: Any):
        if not self.leiloes_habilitados():
            return None

        figurinha = self.db.execute_fetch(
            query="""
                SELECT TOP 1
                    f.ID_FIGURINHA,
                    f.NM_FIGURINHA,
                    f.ID_RARIDADE,
                    r.NM_RARIDADE
                FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                    ON r.ID_RARIDADE = f.ID_RARIDADE
                WHERE f.ID_FIGURINHA = ?
            """,
            parametros=(id_figurinha,),
            one=True,
        )
        if not figurinha:
            return None

        vendidos_hoje = self.db.execute_fetch(
            query="""
                SELECT
                    COUNT(1) AS QTD,
                    AVG(CAST(NULLIF(ISNULL(VL_ATUAL, 0), 0) AS FLOAT)) AS MEDIA,
                    MIN(NULLIF(ISNULL(VL_ATUAL, 0), 0)) AS MINIMO,
                    MAX(NULLIF(ISNULL(VL_ATUAL, 0), 0)) AS MAXIMO
                FROM album.TB_ALBUM_LEILAO WITH(NOLOCK)
                WHERE ID_FIGURINHA = ?
                  AND STATUS_LEILAO = 'VENDIDO'
                  AND ISNULL(VL_ATUAL, 0) > 0
                  AND CAST(DT_FINALIZACAO AS DATE) = CAST(GETDATE() AS DATE)
            """,
            parametros=(id_figurinha,),
            one=True,
        ) or {}

        mesmos_vendidos = self.db.execute_fetch(
            query="""
                SELECT
                    COUNT(1) AS QTD,
                    AVG(CAST(NULLIF(ISNULL(VL_ATUAL, 0), 0) AS FLOAT)) AS MEDIA,
                    MIN(NULLIF(ISNULL(VL_ATUAL, 0), 0)) AS MINIMO,
                    MAX(NULLIF(ISNULL(VL_ATUAL, 0), 0)) AS MAXIMO
                FROM album.TB_ALBUM_LEILAO WITH(NOLOCK)
                WHERE ID_FIGURINHA = ?
                  AND STATUS_LEILAO = 'VENDIDO'
                  AND ISNULL(VL_ATUAL, 0) > 0
            """,
            parametros=(id_figurinha,),
            one=True,
        ) or {}

        mesmos_ativos = self.db.execute_fetch(
            query="""
                SELECT
                    COUNT(1) AS QTD,
                    AVG(CAST(NULLIF(ISNULL(VL_ATUAL, 0), 0) AS FLOAT)) AS MEDIA,
                    MIN(NULLIF(ISNULL(VL_ATUAL, 0), 0)) AS MINIMO,
                    MAX(NULLIF(ISNULL(VL_ATUAL, 0), 0)) AS MAXIMO
                FROM album.TB_ALBUM_LEILAO WITH(NOLOCK)
                WHERE ID_FIGURINHA = ?
                  AND STATUS_LEILAO = 'ATIVO'
                  AND ISNULL(VL_ATUAL, 0) > 0
            """,
            parametros=(id_figurinha,),
            one=True,
        ) or {}

        raridade_vendidos = self.db.execute_fetch(
            query="""
                SELECT
                    COUNT(1) AS QTD,
                    AVG(CAST(NULLIF(ISNULL(l.VL_ATUAL, 0), 0) AS FLOAT)) AS MEDIA,
                    MIN(NULLIF(ISNULL(l.VL_ATUAL, 0), 0)) AS MINIMO,
                    MAX(NULLIF(ISNULL(l.VL_ATUAL, 0), 0)) AS MAXIMO
                FROM album.TB_ALBUM_LEILAO l WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                    ON f.ID_FIGURINHA = l.ID_FIGURINHA
                WHERE f.ID_RARIDADE = ?
                  AND l.STATUS_LEILAO = 'VENDIDO'
                  AND ISNULL(l.VL_ATUAL, 0) > 0
                  AND l.DT_FINALIZACAO >= DATEADD(DAY, -90, SYSDATETIME())
            """,
            parametros=(figurinha["ID_RARIDADE"],),
            one=True,
        ) or {}

        def _num(row, key, default=0):
            valor = row.get(key) if row else None
            return default if valor is None else float(valor)

        qtd_mesma = int(_num(mesmos_vendidos, "QTD") or 0)
        qtd_hoje = int(_num(vendidos_hoje, "QTD") or 0)
        qtd_ativos = int(_num(mesmos_ativos, "QTD") or 0)
        qtd_raridade = int(_num(raridade_vendidos, "QTD") or 0)
        media_hoje = _num(vendidos_hoje, "MEDIA")
        media_geral = _num(mesmos_vendidos, "MEDIA")

        media = media_hoje or media_geral
        fonte = "vendas_dia_carta" if media_hoje > 0 else "historico_carta"
        confianca = "alta" if qtd_mesma >= 3 else "media"

        if media <= 0 and _num(mesmos_ativos, "MEDIA") > 0:
            media = _num(mesmos_ativos, "MEDIA")
            fonte = "leiloes_ativos_carta"
            confianca = "media" if qtd_ativos >= 2 else "baixa"

        if media <= 0 and _num(raridade_vendidos, "MEDIA") > 0:
            media = _num(raridade_vendidos, "MEDIA")
            fonte = "historico_raridade"
            confianca = "media" if qtd_raridade >= 5 else "baixa"

        if media <= 0:
            return {
                "id_figurinha": str(figurinha["ID_FIGURINHA"]),
                "nome": figurinha["NM_FIGURINHA"],
                "raridade": figurinha["NM_RARIDADE"],
                "tem_dados": False,
                "fonte": "sem_historico",
                "confianca": "baixa",
                "tem_media_diaria": False,
                "mensagem_media_diaria": "Nao foi feita nenhuma venda dessa carta no dia",
                "qtd_vendas_dia": qtd_hoje,
                "media_diaria_pago": None,
                "qtd_vendas_geral": qtd_mesma,
                "media_geral_pago": None,
                "qtd_vendas_carta": qtd_mesma,
                "qtd_leiloes_ativos_carta": qtd_ativos,
                "qtd_vendas_raridade": qtd_raridade,
                "media_pago": None,
                "menor_pago": None,
                "maior_pago": None,
                "sugerido_inicial": None,
                "sugerido_compre_ja": None,
                "faixa_min": None,
                "faixa_max": None,
            }

        menor = _num(mesmos_vendidos, "MINIMO") or _num(mesmos_ativos, "MINIMO") or _num(raridade_vendidos, "MINIMO")
        maior = _num(mesmos_vendidos, "MAXIMO") or _num(mesmos_ativos, "MAXIMO") or _num(raridade_vendidos, "MAXIMO")
        sugerido_inicial = max(1, int(round(media * 0.8)))
        sugerido_compre_ja = max(sugerido_inicial + 1, int(round(media * 1.25)))

        return {
            "id_figurinha": str(figurinha["ID_FIGURINHA"]),
            "nome": figurinha["NM_FIGURINHA"],
            "raridade": figurinha["NM_RARIDADE"],
            "tem_dados": True,
            "fonte": fonte,
            "confianca": confianca,
            "tem_media_diaria": qtd_hoje > 0,
            "mensagem_media_diaria": None if qtd_hoje > 0 else "Nao foi feita nenhuma venda dessa carta no dia",
            "qtd_vendas_dia": qtd_hoje,
            "media_diaria_pago": int(round(media_hoje)) if media_hoje > 0 else None,
            "qtd_vendas_geral": qtd_mesma,
            "media_geral_pago": int(round(media_geral)) if media_geral > 0 else None,
            "qtd_vendas_carta": qtd_mesma,
            "qtd_leiloes_ativos_carta": qtd_ativos,
            "qtd_vendas_raridade": qtd_raridade,
            "media_pago": int(round(media)),
            "menor_pago": int(round(menor)) if menor else None,
            "maior_pago": int(round(maior)) if maior else None,
            "sugerido_inicial": sugerido_inicial,
            "sugerido_compre_ja": sugerido_compre_ja,
            "faixa_min": max(1, int(round(media * 0.7))),
            "faixa_max": max(1, int(round(media * 1.35))),
        }

    def criar_leilao_album(
        self,
        id_usuario: Any,
        id_figurinha: Any,
        valor_inicial: int,
        valor_compre_ja: int | None = None,
    ):
        if not self.leiloes_habilitados():
            raise RuntimeError(
                "Estrutura de leilao nao encontrada no banco. Execute o script backend/sql/album_leilao.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            inventario = self._buscar_inventario_para_troca(cursor, id_usuario, id_figurinha)
            if not inventario or (int(inventario[1] or 0) - int(inventario[2] or 0)) <= 0:
                raise ValueError("Essa figurinha nao esta disponivel como repetida para leilao")

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
                SET
                    QTD_TOTAL = QTD_TOTAL - 1,
                    DT_ULTIMA_OBTENCAO = GETDATE()
                WHERE ID_INVENTARIO = ?
                """,
                (inventario[0],),
            )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_LEILAO (
                    ID_FIGURINHA,
                    ID_USUARIO_VENDEDOR,
                    VL_INICIAL,
                    VL_COMPRE_JA,
                    VL_ATUAL,
                    STATUS_LEILAO,
                    DT_INICIO,
                    DT_FIM
                )
                OUTPUT INSERTED.ID_LEILAO
                VALUES (?, ?, ?, ?, ?, 'ATIVO', SYSDATETIME(), DATEADD(MINUTE, ?, SYSDATETIME()))
                """,
                (
                    id_figurinha,
                    id_usuario,
                    int(valor_inicial),
                    int(valor_compre_ja) if valor_compre_ja else None,
                    int(valor_inicial),
                    self.LEILAO_DURACAO_MINUTOS,
                ),
            )
            id_leilao = cursor.fetchone()[0]

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, ID_FIGURINHA, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, ?, GETDATE())
                """,
                (
                    id_usuario,
                    id_figurinha,
                    "leilao_criado",
                    f"Figurinha anunciada no leilao por {valor_inicial} Aurora Coins",
                ),
            )

            conexao.commit()
            return str(id_leilao)
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def dar_lance_leilao_album(self, id_usuario: Any, id_leilao: str, valor_lance: int):
        if not self.leiloes_habilitados():
            raise RuntimeError(
                "Estrutura de leilao nao encontrada no banco. Execute o script backend/sql/album_leilao.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT TOP 1
                    ID_LEILAO,
                    ID_FIGURINHA,
                    ID_USUARIO_VENDEDOR,
                    ID_MAIOR_LANCE_USUARIO,
                    ISNULL(VL_ATUAL, 0) AS VL_ATUAL,
                    STATUS_LEILAO,
                    VL_COMPRE_JA,
                    DT_FIM,
                    ID_MAIOR_LANCE
                FROM album.TB_ALBUM_LEILAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_LEILAO = ?
                """,
                (id_leilao,),
            )
            leilao = cursor.fetchone()
            if not leilao:
                raise ValueError("Leilao nao encontrado")

            (
                id_leilao_db,
                id_figurinha,
                id_vendedor,
                id_maior_lance_usuario,
                vl_atual,
                status_leilao,
                vl_compre_ja,
                dt_fim,
                id_maior_lance,
            ) = leilao

            if str(status_leilao or "").upper() != "ATIVO":
                raise ValueError("Esse leilao nao esta ativo")
            if dt_fim and dt_fim <= datetime.now():
                self._finalizar_leilao_cursor(
                    cursor,
                    (id_leilao_db, id_figurinha, id_vendedor, id_maior_lance_usuario, vl_atual, status_leilao),
                    "VENDIDO" if id_maior_lance_usuario else "EXPIRADO",
                )
                raise ValueError("Esse leilao ja encerrou")
            usuario_normalizado = re.sub(r"\D", "", str(id_usuario or ""))
            vendedor_normalizado = re.sub(r"\D", "", str(id_vendedor or ""))
            if usuario_normalizado == vendedor_normalizado:
                raise ValueError("Voce nao pode dar lance no proprio leilao")

            valor_lance = int(valor_lance)
            if valor_lance <= int(vl_atual or 0):
                raise ValueError("O lance precisa ser maior que o valor atual")

            saldo_atual = self._obter_saldo_aurora_cursor(cursor, id_usuario)
            if saldo_atual < valor_lance:
                raise ValueError("Saldo insuficiente de Aurora Coins para esse lance")

            segundos_restantes = (dt_fim - datetime.now()).total_seconds() if dt_fim else None
            estender_leilao = (
                segundos_restantes is not None
                and 0 <= segundos_restantes <= self.LEILAO_ANTI_SNIPING_JANELA_SEGUNDOS
            )

            if id_maior_lance_usuario:
                self._registrar_movimentacao_aurora(
                    cursor=cursor,
                    id_usuario=id_maior_lance_usuario,
                    tp_movimentacao="GANHO",
                    tp_origem="LEILAO_ESTORNO",
                    id_origem=f"leilao:{id_leilao_db}:estorno:{id_maior_lance}",
                    qtd_coins=int(vl_atual or 0),
                    descricao="Estorno de lance superado no leilao",
                    permitir_duplicidade=True,
                )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_LEILAO_LANCE (
                    ID_LEILAO,
                    ID_USUARIO,
                    VL_LANCE,
                    DT_LANCE
                )
                OUTPUT INSERTED.ID_LANCE
                VALUES (?, ?, ?, SYSDATETIME())
                """,
                (id_leilao_db, id_usuario, valor_lance),
            )
            id_lance = cursor.fetchone()[0]

            self._registrar_movimentacao_aurora(
                cursor=cursor,
                id_usuario=id_usuario,
                tp_movimentacao="GASTO",
                tp_origem="LEILAO_RESERVA",
                id_origem=f"leilao:{id_leilao_db}:lance:{id_lance}",
                qtd_coins=-abs(valor_lance),
                descricao="Reserva de lance no leilao",
                permitir_duplicidade=True,
            )

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_LEILAO
                SET
                    ID_MAIOR_LANCE = ?,
                    ID_MAIOR_LANCE_USUARIO = ?,
                    VL_ATUAL = ?,
                    DT_FIM = CASE
                        WHEN ? = 1 THEN DATEADD(SECOND, ?, SYSDATETIME())
                        ELSE DT_FIM
                    END,
                    DT_ATUALIZACAO = SYSDATETIME()
                WHERE ID_LEILAO = ?
                """,
                (
                    id_lance,
                    id_usuario,
                    valor_lance,
                    1 if estender_leilao else 0,
                    self.LEILAO_ANTI_SNIPING_EXTENSAO_SEGUNDOS,
                    id_leilao_db,
                ),
            )

            vendido = bool(vl_compre_ja and valor_lance >= int(vl_compre_ja or 0))
            if vendido:
                self._finalizar_leilao_cursor(
                    cursor,
                    (id_leilao_db, id_figurinha, id_vendedor, id_usuario, valor_lance, "ATIVO"),
                    "VENDIDO",
                )

            conexao.commit()
            return {
                "id_leilao": str(id_leilao_db),
                "id_lance": str(id_lance),
                "vendido": vendido,
                "estendido": estender_leilao and not vendido,
            }
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def comprar_agora_leilao_album(self, id_usuario: Any, id_leilao: str):
        if not self.leiloes_habilitados():
            raise RuntimeError(
                "Estrutura de leilao nao encontrada no banco. Execute o script backend/sql/album_leilao.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            cursor.execute(
                """
                SELECT TOP 1
                    ID_LEILAO,
                    ID_FIGURINHA,
                    ID_USUARIO_VENDEDOR,
                    ID_MAIOR_LANCE_USUARIO,
                    ISNULL(VL_ATUAL, 0) AS VL_ATUAL,
                    STATUS_LEILAO,
                    VL_COMPRE_JA,
                    DT_FIM,
                    ID_MAIOR_LANCE
                FROM album.TB_ALBUM_LEILAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_LEILAO = ?
                """,
                (id_leilao,),
            )
            leilao = cursor.fetchone()
            if not leilao:
                raise ValueError("Leilao nao encontrado")

            (
                id_leilao_db,
                id_figurinha,
                id_vendedor,
                id_maior_lance_usuario,
                vl_atual,
                status_leilao,
                vl_compre_ja,
                dt_fim,
                id_maior_lance,
            ) = leilao

            if str(status_leilao or "").upper() != "ATIVO":
                raise ValueError("Esse leilao nao esta ativo")
            if not vl_compre_ja:
                raise ValueError("Esse leilao nao possui compra imediata")
            if dt_fim and dt_fim <= datetime.now():
                self._finalizar_leilao_cursor(
                    cursor,
                    (id_leilao_db, id_figurinha, id_vendedor, id_maior_lance_usuario, vl_atual, status_leilao),
                    "VENDIDO" if id_maior_lance_usuario else "EXPIRADO",
                )
                raise ValueError("Esse leilao ja encerrou")
            usuario_normalizado = re.sub(r"\D", "", str(id_usuario or ""))
            vendedor_normalizado = re.sub(r"\D", "", str(id_vendedor or ""))
            if usuario_normalizado == vendedor_normalizado:
                raise ValueError("Voce nao pode comprar o proprio leilao")

            valor_compra = int(vl_compre_ja or 0)
            saldo_atual = self._obter_saldo_aurora_cursor(cursor, id_usuario)
            if saldo_atual < valor_compra:
                raise ValueError("Saldo insuficiente de Aurora Coins para comprar agora")

            if id_maior_lance_usuario:
                self._registrar_movimentacao_aurora(
                    cursor=cursor,
                    id_usuario=id_maior_lance_usuario,
                    tp_movimentacao="GANHO",
                    tp_origem="LEILAO_ESTORNO",
                    id_origem=f"leilao:{id_leilao_db}:estorno:{id_maior_lance}",
                    qtd_coins=int(vl_atual or 0),
                    descricao="Estorno de lance superado por compra imediata",
                    permitir_duplicidade=True,
                )

            self._registrar_movimentacao_aurora(
                cursor=cursor,
                id_usuario=id_usuario,
                tp_movimentacao="GASTO",
                tp_origem="LEILAO_COMPRA_AGORA",
                id_origem=f"leilao:{id_leilao_db}:compra:{id_usuario}",
                qtd_coins=-abs(valor_compra),
                descricao="Compra imediata no leilao",
                permitir_duplicidade=True,
            )

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_LEILAO
                SET
                    ID_MAIOR_LANCE = NULL,
                    ID_MAIOR_LANCE_USUARIO = ?,
                    VL_ATUAL = ?,
                    DT_ATUALIZACAO = SYSDATETIME()
                WHERE ID_LEILAO = ?
                """,
                (id_usuario, valor_compra, id_leilao_db),
            )

            self._finalizar_leilao_cursor(
                cursor,
                (id_leilao_db, id_figurinha, id_vendedor, id_usuario, valor_compra, "ATIVO"),
                "VENDIDO",
            )

            conexao.commit()
            return {"id_leilao": str(id_leilao_db), "vendido": True}
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def _garantir_seed_olheiros_cursor(self, cursor):
        cursor.execute(
            """
            UPDATE album.TB_ALBUM_OLHEIRO
            SET
                VL_CUSTO = CASE LOWER(LTRIM(RTRIM(NM_RARIDADE)))
                    WHEN 'comum' THEN 40
                    WHEN 'incomum' THEN 75
                    WHEN 'raro' THEN 105
                    WHEN 'ultra raro' THEN 170
                    WHEN 'ultra-raro' THEN 170
                    WHEN 'epico' THEN 250
                    WHEN 'épico' THEN 250
                    WHEN 'lendario' THEN 380
                    WHEN 'lendário' THEN 380
                    WHEN 'boss' THEN 580
                    ELSE VL_CUSTO
                END,
                DT_ATUALIZACAO = SYSDATETIME()
            WHERE VL_CUSTO <> CASE LOWER(LTRIM(RTRIM(NM_RARIDADE)))
                    WHEN 'comum' THEN 40
                    WHEN 'incomum' THEN 75
                    WHEN 'raro' THEN 105
                    WHEN 'ultra raro' THEN 170
                    WHEN 'ultra-raro' THEN 170
                    WHEN 'epico' THEN 250
                    WHEN 'épico' THEN 250
                    WHEN 'lendario' THEN 380
                    WHEN 'lendário' THEN 380
                    WHEN 'boss' THEN 580
                    ELSE VL_CUSTO
                END
            """
        )

        cursor.execute(
            """
            SELECT COUNT(1)
            FROM album.TB_ALBUM_OLHEIRO WITH(HOLDLOCK)
            WHERE ISNULL(ID_FIGURINHA, '') <> ''
            """
        )
        row = cursor.fetchone()
        if row and int(row[0] or 0) > 0:
            return

        cursor.execute("DELETE FROM album.TB_ALBUM_OLHEIRO_OFERTA")
        cursor.execute("DELETE FROM album.TB_ALBUM_OLHEIRO")
        cursor.execute(
            """
            SELECT
                f.ID_FIGURINHA,
                f.NM_FIGURINHA,
                f.URL_IMAGEM,
                e.NM_EQUIPE,
                r.NM_RARIDADE,
                f.FL_BOSS
            FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            WHERE f.FL_ATIVA = 1
              AND p.FL_ATIVO = 1
              AND e.FL_ATIVA = 1
            ORDER BY
                CASE WHEN ISNULL(f.FL_BOSS, 0) = 1 THEN 0 ELSE 1 END,
                r.ID_RARIDADE DESC,
                f.ORDEM_EXIBICAO_GERAL,
                f.NM_FIGURINHA
            """
        )
        figurinhas = cursor.fetchall() or []

        for index, figurinha in enumerate(figurinhas):
            raridade = "boss" if bool(figurinha[5]) else self._normalizar_raridade(figurinha[4])
            rank = self._rank_raridade_pacote(raridade)
            custo = self.OLHEIRO_CUSTO_RARIDADE.get(raridade, 40)
            estrelas = max(1, min(5, rank - 1))
            base = 46 + rank * 7
            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_OLHEIRO (
                    ID_FIGURINHA,
                    NM_OLHEIRO,
                    DS_CARGO,
                    NM_RARIDADE,
                    URL_IMAGEM,
                    VL_CUSTO,
                    NR_ESTRELAS,
                    NR_RADAR,
                    NR_PERSISTENCIA,
                    NR_ALCANCE,
                    FL_ATIVO,
                    DT_CADASTRO,
                    DT_ATUALIZACAO
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, SYSDATETIME(), SYSDATETIME())
                """,
                (
                    str(figurinha[0]),
                    figurinha[1],
                    figurinha[3],
                    raridade,
                    figurinha[2],
                    custo,
                    estrelas,
                    min(99, base + (index % 9)),
                    min(99, base - 3 + (index % 7)),
                    min(99, base + 2 + (index % 8)),
                ),
            )

    def _sortear_olheiros_diarios_cursor(self, cursor, id_usuario: Any, substituir: bool = False):
        hoje = date.today()
        self._garantir_seed_olheiros_cursor(cursor)

        if substituir:
            cursor.execute(
                """
                DELETE FROM album.TB_ALBUM_OLHEIRO_OFERTA
                WHERE ID_USUARIO = ?
                  AND DT_REFERENCIA = ?
                  AND ISNULL(FL_CONTRATADO, 0) = 0
                """,
                (id_usuario, hoje),
            )

        cursor.execute(
            """
            SELECT COUNT(1)
            FROM album.TB_ALBUM_OLHEIRO_OFERTA WITH(HOLDLOCK)
            WHERE ID_USUARIO = ?
              AND DT_REFERENCIA = ?
            """,
            (id_usuario, hoje),
        )
        row = cursor.fetchone()
        ofertas_existentes = int(row[0] or 0) if row else 0
        if ofertas_existentes >= self.OLHEIRO_QTD_OFERTAS_DIA:
            return
        qtd_necessaria = self.OLHEIRO_QTD_OFERTAS_DIA - ofertas_existentes

        cursor.execute(
            """
            SELECT
                ID_OLHEIRO,
                NM_RARIDADE
            FROM album.TB_ALBUM_OLHEIRO WITH(NOLOCK)
            WHERE FL_ATIVO = 1
            """
        )
        candidatos = cursor.fetchall() or []
        if not candidatos:
            return

        pesos_raridade = {
            "comum": 46,
            "raro": 30,
            "epico": 15,
            "lendario": 7,
            "boss": 2,
        }
        escolhidos = []
        pool = list(candidatos)
        while len(escolhidos) < qtd_necessaria and pool:
            pesos = [
                pesos_raridade.get(self._normalizar_raridade(item[1]), 8)
                for item in pool
            ]
            escolhido = random.choices(pool, weights=pesos, k=1)[0]
            escolhidos.append(escolhido)
            pool = [item for item in pool if str(item[0]) != str(escolhido[0])]

        cursor.execute(
            """
            SELECT ISNULL(MAX(NR_ORDEM), 0)
            FROM album.TB_ALBUM_OLHEIRO_OFERTA WITH(NOLOCK)
            WHERE ID_USUARIO = ?
              AND DT_REFERENCIA = ?
            """,
            (id_usuario, hoje),
        )
        ordem_row = cursor.fetchone()
        ordem_atual = int(ordem_row[0] or 0) if ordem_row else 0

        for index, escolhido in enumerate(escolhidos, start=1):
            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_OLHEIRO_OFERTA (
                    ID_USUARIO,
                    ID_OLHEIRO,
                    DT_REFERENCIA,
                    NR_ORDEM,
                    FL_CONTRATADO,
                    DT_CADASTRO
                )
                VALUES (?, ?, ?, ?, 0, SYSDATETIME())
                """,
                (id_usuario, escolhido[0], hoje, ordem_atual + index),
            )

    def atualizar_ofertas_olheiro(self, id_usuario: Any, custo_coins: int = 50):
        if not self.olheiros_habilitados():
            raise RuntimeError(
                "Estrutura de olheiros nao encontrada no banco. Execute o script backend/sql/album_olheiros.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            saldo_atual = self._obter_saldo_aurora_cursor(cursor, id_usuario)
            if saldo_atual < int(custo_coins):
                raise ValueError("Saldo insuficiente para atualizar os olheiros")

            self._registrar_movimentacao_aurora(
                cursor=cursor,
                id_usuario=id_usuario,
                tp_movimentacao="GASTO",
                tp_origem="OLHEIRO_ATUALIZAR",
                id_origem=f"olheiro:atualizar:{datetime.now().timestamp()}",
                qtd_coins=-abs(int(custo_coins)),
                descricao="Atualizacao de olheiros disponiveis",
                permitir_duplicidade=True,
            )
            self._sortear_olheiros_diarios_cursor(cursor, id_usuario, substituir=True)
            conexao.commit()
            return True
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def listar_estado_olheiros(self, id_usuario: Any):
        if not self.olheiros_habilitados():
            return {"ofertas": [], "missoes": []}

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            self._sortear_olheiros_diarios_cursor(cursor, id_usuario)
            cursor.execute(
                """
                UPDATE album.TB_ALBUM_OLHEIRO_MISSAO
                SET
                    STATUS_MISSAO = 'CONCLUIDA',
                    DT_FINALIZACAO = COALESCE(DT_FINALIZACAO, SYSDATETIME()),
                    DT_ATUALIZACAO = SYSDATETIME()
                WHERE ID_USUARIO = ?
                  AND STATUS_MISSAO = 'EM_ANDAMENTO'
                  AND DT_FIM <= SYSDATETIME()
                """,
                (id_usuario,),
            )
            conexao.commit()
        finally:
            if conexao is not None:
                conexao.close()

        hoje = date.today()
        ofertas = self.db.execute_fetch(
            query="""
                SELECT
                    oferta.ID_OFERTA,
                    oferta.ID_USUARIO,
                    oferta.DT_REFERENCIA,
                    oferta.NR_ORDEM,
                    oferta.FL_CONTRATADO,
                    olheiro.ID_OLHEIRO,
                    olheiro.NM_OLHEIRO,
                    olheiro.DS_CARGO,
                    olheiro.NM_RARIDADE,
                    olheiro.URL_IMAGEM,
                    olheiro.VL_CUSTO,
                    olheiro.NR_ESTRELAS,
                    olheiro.NR_RADAR,
                    olheiro.NR_PERSISTENCIA,
                    olheiro.NR_ALCANCE
                FROM album.TB_ALBUM_OLHEIRO_OFERTA oferta WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_OLHEIRO olheiro WITH(NOLOCK)
                    ON olheiro.ID_OLHEIRO = oferta.ID_OLHEIRO
                WHERE oferta.ID_USUARIO = ?
                  AND oferta.DT_REFERENCIA = ?
                ORDER BY oferta.NR_ORDEM
            """,
            parametros=(id_usuario, hoje),
            one=False,
        ) or []

        missoes = self.db.execute_fetch(
            query="""
                SELECT TOP 20
                    missao.ID_MISSAO,
                    missao.ID_USUARIO,
                    missao.ID_OFERTA,
                    missao.DS_TEMPO,
                    missao.DS_DESTINO,
                    missao.VL_CUSTO,
                    missao.STATUS_MISSAO,
                    missao.DT_INICIO,
                    missao.DT_FIM,
                    missao.DT_FINALIZACAO,
                    missao.ID_PACOTE,
                    olheiro.ID_OLHEIRO,
                    olheiro.NM_OLHEIRO,
                    olheiro.DS_CARGO,
                    olheiro.NM_RARIDADE,
                    olheiro.URL_IMAGEM,
                    olheiro.VL_CUSTO AS VL_CUSTO_OLHEIRO,
                    olheiro.NR_ESTRELAS,
                    olheiro.NR_RADAR,
                    olheiro.NR_PERSISTENCIA,
                    olheiro.NR_ALCANCE
                FROM album.TB_ALBUM_OLHEIRO_MISSAO missao WITH(NOLOCK)
                INNER JOIN album.TB_ALBUM_OLHEIRO olheiro WITH(NOLOCK)
                    ON olheiro.ID_OLHEIRO = missao.ID_OLHEIRO
                WHERE missao.ID_USUARIO = ?
                ORDER BY missao.DT_CADASTRO DESC
            """,
            parametros=(id_usuario,),
            one=False,
        ) or []

        return {
            "ofertas": ofertas,
            "missoes": missoes,
        }

    def iniciar_missao_olheiro(
        self,
        id_usuario: Any,
        id_oferta: str,
        tempo: str,
        destino: str,
        duracao_minutos: int,
    ):
        if not self.olheiros_habilitados():
            raise RuntimeError(
                "Estrutura de olheiros nao encontrada no banco. Execute o script backend/sql/album_olheiros.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            cursor.execute(
                """
                SELECT TOP 1 1
                FROM album.TB_ALBUM_OLHEIRO_MISSAO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_USUARIO = ?
                  AND STATUS_MISSAO = 'EM_ANDAMENTO'
                """,
                (id_usuario,),
            )
            if cursor.fetchone():
                raise ValueError("Voce ja possui um olheiro em missao")

            cursor.execute(
                """
                SELECT TOP 1
                    oferta.ID_OFERTA,
                    oferta.ID_OLHEIRO,
                    oferta.FL_CONTRATADO,
                    olheiro.VL_CUSTO,
                    olheiro.NM_OLHEIRO
                FROM album.TB_ALBUM_OLHEIRO_OFERTA oferta WITH(UPDLOCK, ROWLOCK)
                INNER JOIN album.TB_ALBUM_OLHEIRO olheiro WITH(NOLOCK)
                    ON olheiro.ID_OLHEIRO = oferta.ID_OLHEIRO
                WHERE oferta.ID_OFERTA = ?
                  AND oferta.ID_USUARIO = ?
                  AND oferta.DT_REFERENCIA = CONVERT(date, GETDATE())
                """,
                (id_oferta, id_usuario),
            )
            oferta = cursor.fetchone()
            if not oferta:
                raise ValueError("Olheiro nao encontrado nas ofertas de hoje")
            if bool(oferta[2]):
                raise ValueError("Esse olheiro ja foi contratado hoje")

            custo = int(oferta[3] or 0)
            saldo_atual = self._obter_saldo_aurora_cursor(cursor, id_usuario)
            if saldo_atual < custo:
                raise ValueError("Saldo insuficiente para contratar esse olheiro")

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_OLHEIRO_MISSAO (
                    ID_USUARIO,
                    ID_OLHEIRO,
                    ID_OFERTA,
                    DS_TEMPO,
                    DS_DESTINO,
                    VL_CUSTO,
                    STATUS_MISSAO,
                    DT_INICIO,
                    DT_FIM,
                    DT_CADASTRO,
                    DT_ATUALIZACAO
                )
                OUTPUT INSERTED.ID_MISSAO
                VALUES (?, ?, ?, ?, ?, ?, 'EM_ANDAMENTO', SYSDATETIME(), DATEADD(MINUTE, ?, SYSDATETIME()), SYSDATETIME(), SYSDATETIME())
                """,
                (
                    id_usuario,
                    oferta[1],
                    oferta[0],
                    tempo,
                    destino,
                    custo,
                    int(duracao_minutos),
                ),
            )
            id_missao = cursor.fetchone()[0]

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_OLHEIRO_OFERTA
                SET FL_CONTRATADO = 1
                WHERE ID_OFERTA = ?
                """,
                (oferta[0],),
            )

            self._registrar_movimentacao_aurora(
                cursor=cursor,
                id_usuario=id_usuario,
                tp_movimentacao="GASTO",
                tp_origem="OLHEIRO_MISSAO",
                id_origem=f"olheiro:missao:{id_missao}",
                qtd_coins=-abs(custo),
                descricao=f"Contratacao do olheiro {oferta[4]}",
                permitir_duplicidade=True,
            )

            conexao.commit()
            return str(id_missao)
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def resgatar_missao_olheiro(self, id_usuario: Any, id_missao: str, perfil_raridade: dict[str, Any]):
        if not self.olheiros_habilitados():
            raise RuntimeError(
                "Estrutura de olheiros nao encontrada no banco. Execute o script backend/sql/album_olheiros.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            cursor.execute(
                """
                SELECT TOP 1
                    missao.ID_MISSAO,
                    missao.STATUS_MISSAO,
                    missao.DT_FIM,
                    missao.ID_PACOTE,
                    olheiro.NM_OLHEIRO
                FROM album.TB_ALBUM_OLHEIRO_MISSAO missao WITH(UPDLOCK, ROWLOCK)
                INNER JOIN album.TB_ALBUM_OLHEIRO olheiro WITH(NOLOCK)
                    ON olheiro.ID_OLHEIRO = missao.ID_OLHEIRO
                WHERE missao.ID_MISSAO = ?
                  AND missao.ID_USUARIO = ?
                """,
                (id_missao, id_usuario),
            )
            missao = cursor.fetchone()
            if not missao:
                raise ValueError("Missao de olheiro nao encontrada")
            if missao[3]:
                raise ValueError("Essa missao ja foi resgatada")
            if missao[2] and missao[2] > datetime.now():
                raise ValueError("O olheiro ainda nao voltou da missao")

            pacotes = self._criar_pacotes_premio(
                cursor=cursor,
                id_usuario=id_usuario,
                nome_pacote=f"Retorno do Olheiro - {missao[4]}",
                qtd_pacotes=1,
                qtd_figurinhas=self.OLHEIRO_QTD_FIGURINHAS_RETORNO,
                detalhe_movimentacao=f"Olheiro {missao[4]} voltou com novas figurinhas",
                perfis_raridade=[perfil_raridade],
            )
            id_pacote = pacotes[0] if pacotes else None
            cursor.execute(
                """
                UPDATE album.TB_ALBUM_OLHEIRO_MISSAO
                SET
                    STATUS_MISSAO = 'RESGATADA',
                    ID_PACOTE = ?,
                    DT_FINALIZACAO = COALESCE(DT_FINALIZACAO, SYSDATETIME()),
                    DT_ATUALIZACAO = SYSDATETIME()
                WHERE ID_MISSAO = ?
                """,
                (str(id_pacote) if id_pacote is not None else None, id_missao),
            )
            conexao.commit()
            return str(id_pacote) if id_pacote is not None else None
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def _contar_trocas_aceitas_hoje_cursor(self, cursor, id_usuario: Any) -> int:
        cursor.execute(
            """
            SELECT COUNT(1)
            FROM album.TB_ALBUM_TROCA_FIGURINHA WITH(UPDLOCK, HOLDLOCK)
            WHERE UPPER(ISNULL(STATUS_TROCA, '')) = 'ACEITA'
              AND (ID_USUARIO_SOLICITANTE = ? OR ID_USUARIO_DESTINATARIO = ?)
              AND DT_RESPOSTA >= CONVERT(date, GETDATE())
              AND DT_RESPOSTA < DATEADD(day, 1, CONVERT(date, GETDATE()))
            """,
            (id_usuario, id_usuario),
        )
        row = cursor.fetchone()
        return int(row[0] or 0) if row else 0

    def criar_solicitacao_troca(
        self,
        id_usuario_solicitante: Any,
        id_usuario_destinatario: Any,
        id_figurinha_oferecida: Any,
        id_figurinha_desejada: Any,
    ):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            if str(id_usuario_solicitante) == str(id_usuario_destinatario):
                raise ValueError("Não é possível solicitar troca para o próprio usuário")

            inventario_oferta = self._buscar_inventario_para_troca(
                cursor,
                id_usuario_solicitante,
                id_figurinha_oferecida,
            )
            if not inventario_oferta or (inventario_oferta[1] - inventario_oferta[2]) <= 0:
                raise ValueError("A figurinha oferecida não está disponível como repetida")

            inventario_desejado = self._buscar_inventario_para_troca(
                cursor,
                id_usuario_destinatario,
                id_figurinha_desejada,
            )
            if not inventario_desejado or (inventario_desejado[1] - inventario_desejado[2]) <= 0:
                raise ValueError("A figurinha desejada não está disponível como repetida no outro operador")

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_TROCA_FIGURINHA (
                    ID_USUARIO_SOLICITANTE,
                    ID_USUARIO_DESTINATARIO,
                    ID_FIGURINHA_OFERECIDA,
                    ID_FIGURINHA_DESEJADA,
                    STATUS_TROCA,
                    DT_SOLICITACAO
                )
                VALUES (?, ?, ?, ?, 'PENDENTE', GETDATE())
                """,
                (
                    id_usuario_solicitante,
                    id_usuario_destinatario,
                    id_figurinha_oferecida,
                    id_figurinha_desejada,
                ),
            )

            conexao.commit()
            return True
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def responder_solicitacao_troca(
        self,
        id_usuario_resposta: Any,
        id_troca: str,
        acao: str,
    ):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT TOP 1
                    ID_TROCA_FIGURINHA,
                    ID_USUARIO_SOLICITANTE,
                    ID_USUARIO_DESTINATARIO,
                    ID_FIGURINHA_OFERECIDA,
                    ID_FIGURINHA_DESEJADA,
                    STATUS_TROCA
                FROM album.TB_ALBUM_TROCA_FIGURINHA WITH(UPDLOCK, ROWLOCK)
                WHERE ID_TROCA_FIGURINHA = ?
                """,
                (id_troca,),
            )
            troca = cursor.fetchone()

            if not troca:
                raise ValueError("Solicitação de troca não encontrada")

            (
                _id_troca,
                id_usuario_solicitante,
                id_usuario_destinatario,
                id_figurinha_oferecida,
                id_figurinha_desejada,
                status_troca,
            ) = troca

            if str(id_usuario_destinatario) != str(id_usuario_resposta):
                raise ValueError("Apenas o destinatário pode responder a solicitação")

            if str(status_troca or "").upper() != "PENDENTE":
                raise ValueError("Essa solicitação já foi respondida")

            acao_normalizada = str(acao or "").strip().upper()
            if acao_normalizada not in {"ACEITAR", "RECUSAR"}:
                raise ValueError("Ação de troca inválida")

            if acao_normalizada == "RECUSAR":
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_TROCA_FIGURINHA
                    SET
                        STATUS_TROCA = 'RECUSADA',
                        DT_RESPOSTA = GETDATE(),
                        ID_USUARIO_RESPOSTA = ?
                    WHERE ID_TROCA_FIGURINHA = ?
                    """,
                    (id_usuario_resposta, id_troca),
                )
                conexao.commit()
                return True

            trocas_solicitante_hoje = self._contar_trocas_aceitas_hoje_cursor(
                cursor,
                id_usuario_solicitante,
            )
            if trocas_solicitante_hoje >= self.LIMITE_TROCAS_ACEITAS_DIA:
                raise ValueError(
                    f"O solicitante atingiu o limite diario de {self.LIMITE_TROCAS_ACEITAS_DIA} trocas aceitas"
                )

            trocas_destinatario_hoje = self._contar_trocas_aceitas_hoje_cursor(
                cursor,
                id_usuario_destinatario,
            )
            if trocas_destinatario_hoje >= self.LIMITE_TROCAS_ACEITAS_DIA:
                raise ValueError(
                    f"Voce atingiu o limite diario de {self.LIMITE_TROCAS_ACEITAS_DIA} trocas aceitas"
                )

            inventario_oferta = self._buscar_inventario_para_troca(
                cursor,
                id_usuario_solicitante,
                id_figurinha_oferecida,
            )
            if not inventario_oferta or (inventario_oferta[1] - inventario_oferta[2]) <= 0:
                raise ValueError("A figurinha oferecida não está mais disponível")

            inventario_desejado = self._buscar_inventario_para_troca(
                cursor,
                id_usuario_destinatario,
                id_figurinha_desejada,
            )
            if not inventario_desejado or (inventario_desejado[1] - inventario_desejado[2]) <= 0:
                raise ValueError("A figurinha desejada não está mais disponível")

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
                SET
                    QTD_TOTAL = QTD_TOTAL - 1,
                    DT_ULTIMA_OBTENCAO = GETDATE()
                WHERE ID_INVENTARIO = ?
                """,
                (inventario_oferta[0],),
            )
            cursor.execute(
                """
                UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
                SET
                    QTD_TOTAL = QTD_TOTAL - 1,
                    DT_ULTIMA_OBTENCAO = GETDATE()
                WHERE ID_INVENTARIO = ?
                """,
                (inventario_desejado[0],),
            )

            self._registrar_recebimento_figurinha_troca(
                cursor,
                id_usuario_destinatario,
                id_figurinha_oferecida,
            )
            self._registrar_recebimento_figurinha_troca(
                cursor,
                id_usuario_solicitante,
                id_figurinha_desejada,
            )

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_TROCA_FIGURINHA
                SET
                    STATUS_TROCA = 'ACEITA',
                    DT_RESPOSTA = GETDATE(),
                    ID_USUARIO_RESPOSTA = ?
                WHERE ID_TROCA_FIGURINHA = ?
                """,
                (id_usuario_resposta, id_troca),
            )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, GETDATE())
                """,
                (
                    id_usuario_solicitante,
                    "troca_aceita",
                    f"Troca aceita com o usuário {id_usuario_destinatario}",
                ),
            )
            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, GETDATE())
                """,
                (
                    id_usuario_destinatario,
                    "troca_aceita",
                    f"Troca aceita com o usuário {id_usuario_solicitante}",
                ),
            )

            if self.moedas_habilitadas():
                self._registrar_movimentacao_aurora(
                    cursor=cursor,
                    id_usuario=id_usuario_solicitante,
                    tp_movimentacao="GANHO",
                    tp_origem="TROCA_ACEITA",
                    id_origem=f"troca:{id_troca}:solicitante",
                    qtd_coins=6,
                    descricao="Troca de figurinhas concluída com sucesso",
                )
                self._registrar_movimentacao_aurora(
                    cursor=cursor,
                    id_usuario=id_usuario_destinatario,
                    tp_movimentacao="GANHO",
                    tp_origem="TROCA_ACEITA",
                    id_origem=f"troca:{id_troca}:destinatario",
                    qtd_coins=6,
                    descricao="Troca de figurinhas concluída com sucesso",
                )

            conexao.commit()
            return True
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def listar_campanhas_recentes_supervisor(self, cpf_supervisor: str, limite: int = 20):
        query = f"""
            SELECT TOP {int(limite)}
                c.ID_CAMPANHA_PREMIO,
                c.NM_CAMPANHA,
                c.CPF_SUPERVISOR,
                c.CPF_COLABORADOR,
                u.NM_COLABORADOR,
                u.CENTRO_CUSTO,
                c.QTD_PACOTES,
                c.QTD_FIGURINHAS_POR_PACOTE,
                c.DT_CADASTRO
            FROM album.TB_ALBUM_CAMPANHA_PREMIO c WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON u.CPF_COLABORADOR = c.CPF_COLABORADOR
            WHERE c.CPF_SUPERVISOR = ?
            ORDER BY c.DT_CADASTRO DESC, c.NM_CAMPANHA
        """

        return self.db.execute_fetch(query=query, parametros=(cpf_supervisor,), one=False) or []

    def _criar_pacotes_premio(
        self,
        cursor,
        id_usuario: Any,
        nome_pacote: str,
        qtd_pacotes: int,
        qtd_figurinhas: int,
        detalhe_movimentacao: str,
        id_meta_usuario: Any | None = None,
        indice_base: int = 0,
        perfis_raridade: list[dict[str, Any]] | None = None,
    ):
        envelope_colors = [
            "#1EB980",
            "#F8D34B",
            "#E83A3A",
            "#0EA5E9",
            "#7C3AED",
            "#F97316",
        ]

        cursor.execute(
            """
            SELECT
                f.ID_FIGURINHA,
                r.NM_RARIDADE
            FROM album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
            INNER JOIN album.TB_ALBUM_PARTICIPANTE p WITH(NOLOCK)
                ON p.ID_PARTICIPANTE = f.ID_PARTICIPANTE
            INNER JOIN album.TB_ALBUM_EQUIPE e WITH(NOLOCK)
                ON e.ID_EQUIPE = f.ID_EQUIPE
            INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                ON r.ID_RARIDADE = f.ID_RARIDADE
            WHERE f.FL_ATIVA = 1
              AND p.FL_ATIVO = 1
              AND e.FL_ATIVA = 1
            """
        )
        candidatas_rows = cursor.fetchall()

        if not candidatas_rows:
            raise ValueError("Nenhuma figurinha ativa encontrada para gerar pacotes")

        candidatas = []
        for row in candidatas_rows:
            raridade = self._normalizar_raridade(row[1])
            candidatas.append(
                {
                    "id_figurinha": row[0],
                    "peso": self._peso_raridade_pacote(raridade),
                    "rank_raridade": self._rank_raridade_pacote(raridade),
                }
            )

        pacotes_criados: list[Any] = []

        for pacote_index in range(qtd_pacotes):
            cor_pacote = envelope_colors[(indice_base + pacote_index) % len(envelope_colors)]

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_PACOTE (
                    ID_USUARIO,
                    ID_META_USUARIO,
                    NM_PACOTE,
                    COR_PACOTE_HEX,
                    STATUS_PACOTE,
                    QTD_FIGURINHAS,
                    DT_GANHO,
                    DT_ABERTURA
                )
                OUTPUT INSERTED.ID_PACOTE
                VALUES (?, ?, ?, ?, 'FECHADO', ?, GETDATE(), NULL)
                """,
                (
                    id_usuario,
                    id_meta_usuario,
                    nome_pacote,
                    cor_pacote,
                    qtd_figurinhas,
                ),
            )
            id_pacote = cursor.fetchone()[0]
            pacotes_criados.append(id_pacote)

            perfil_raridade = (
                perfis_raridade[pacote_index]
                if perfis_raridade and pacote_index < len(perfis_raridade)
                else None
            )
            sorteadas = self._sortear_figurinhas_pacote(
                candidatas=candidatas,
                qtd_figurinhas=qtd_figurinhas,
                perfil_raridade=perfil_raridade,
            )

            for ordem_revelacao, id_figurinha in enumerate(sorteadas, start=1):
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_PACOTE_ITEM (
                        ID_PACOTE,
                        ORDEM_REVELACAO,
                        ID_FIGURINHA,
                        DT_CADASTRO
                    )
                    VALUES (?, ?, ?, GETDATE())
                    """,
                    (id_pacote, ordem_revelacao, id_figurinha),
                )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, ID_PACOTE, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, ?, GETDATE())
                """,
                (
                    id_usuario,
                    id_pacote,
                    "pacote_ganho",
                    detalhe_movimentacao,
                ),
            )

        return pacotes_criados

    def criar_campanha_premio(
        self,
        cpf_supervisor: str,
        cpf_colaborador: str,
        nome_campanha: str,
        qtd_pacotes: int,
        qtd_figurinhas_por_pacote: int,
    ):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_CAMPANHA_PREMIO (
                    NM_CAMPANHA,
                    CPF_SUPERVISOR,
                    CPF_COLABORADOR,
                    QTD_PACOTES,
                    QTD_FIGURINHAS_POR_PACOTE,
                    DT_CADASTRO
                )
                OUTPUT
                    INSERTED.ID_CAMPANHA_PREMIO,
                    INSERTED.NM_CAMPANHA,
                    INSERTED.CPF_SUPERVISOR,
                    INSERTED.CPF_COLABORADOR,
                    INSERTED.QTD_PACOTES,
                    INSERTED.QTD_FIGURINHAS_POR_PACOTE,
                    INSERTED.DT_CADASTRO
                VALUES (?, ?, ?, ?, ?, GETDATE())
                """,
                (
                    nome_campanha,
                    cpf_supervisor,
                    cpf_colaborador,
                    qtd_pacotes,
                    qtd_figurinhas_por_pacote,
                ),
            )
            campanha = cursor.fetchone()

            self._criar_pacotes_premio(
                cursor=cursor,
                id_usuario=cpf_colaborador,
                nome_pacote=f"Campanha {nome_campanha}",
                qtd_pacotes=qtd_pacotes,
                qtd_figurinhas=qtd_figurinhas_por_pacote,
                detalhe_movimentacao=f"Pacote gerado pela campanha {nome_campanha}",
            )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, GETDATE())
                """,
                (
                    cpf_colaborador,
                    "campanha_premiada",
                    f"Campanha {nome_campanha} premiada pelo supervisor {cpf_supervisor}",
                ),
            )

            conexao.commit()

            colunas = [
                "ID_CAMPANHA_PREMIO",
                "NM_CAMPANHA",
                "CPF_SUPERVISOR",
                "CPF_COLABORADOR",
                "QTD_PACOTES",
                "QTD_FIGURINHAS_POR_PACOTE",
                "DT_CADASTRO",
            ]
            return dict(zip(colunas, campanha)) if campanha else None
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def sincronizar_metas_usuario_e_pacotes(self, id_usuario: Any, metas_apuradas: list[dict[str, Any]]):
        conexao = None

        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            for meta_index, meta in enumerate(metas_apuradas):
                id_meta = meta.get("ID_META")
                dt_inicio = meta.get("DT_REFERENCIA_INICIO")
                dt_fim = meta.get("DT_REFERENCIA_FIM")
                vl_apurado = meta.get("VL_APURADO") or 0
                fl_bateu_meta = 1 if meta.get("FL_BATEU_META") else 0
                nm_meta = meta.get("NM_META") or "Meta do álbum"
                qtd_pacotes = int(meta.get("QTD_PACOTES") or 0)
                qtd_figurinhas = int(meta.get("QTD_FIGURINHAS_POR_PACOTE") or 0)

                cursor.execute(
                    """
                    SELECT TOP 1
                        ID_META_USUARIO,
                        ISNULL(FL_PREMIO_GERADO, 0) AS FL_PREMIO_GERADO
                    FROM album.TB_ALBUM_META_USUARIO WITH(UPDLOCK, ROWLOCK)
                    WHERE ID_META = ?
                      AND ID_USUARIO = ?
                      AND DT_REFERENCIA_INICIO = ?
                      AND DT_REFERENCIA_FIM = ?
                    """,
                    (id_meta, id_usuario, dt_inicio, dt_fim),
                )
                meta_usuario_row = cursor.fetchone()

                premio_gerado = False
                if meta_usuario_row:
                    id_meta_usuario = meta_usuario_row[0]
                    premio_gerado = bool(meta_usuario_row[1])

                    cursor.execute(
                        """
                        UPDATE album.TB_ALBUM_META_USUARIO
                        SET
                            VL_APURADO = ?,
                            FL_BATEU_META = ?,
                            DT_APURACAO = GETDATE()
                        WHERE ID_META_USUARIO = ?
                        """,
                        (vl_apurado, fl_bateu_meta, id_meta_usuario),
                    )
                else:
                    cursor.execute(
                        """
                        INSERT INTO album.TB_ALBUM_META_USUARIO (
                            ID_META,
                            ID_USUARIO,
                            DT_REFERENCIA_INICIO,
                            DT_REFERENCIA_FIM,
                            VL_APURADO,
                            FL_BATEU_META,
                            FL_PREMIO_GERADO,
                            DT_APURACAO,
                            DT_PREMIO_GERADO
                        )
                        OUTPUT INSERTED.ID_META_USUARIO
                        VALUES (?, ?, ?, ?, ?, ?, 0, GETDATE(), NULL)
                        """,
                        (
                            id_meta,
                            id_usuario,
                            dt_inicio,
                            dt_fim,
                            vl_apurado,
                            fl_bateu_meta,
                        ),
                    )
                    id_meta_usuario = cursor.fetchone()[0]

                if not fl_bateu_meta or premio_gerado or qtd_pacotes <= 0 or qtd_figurinhas <= 0:
                    continue

                self._criar_pacotes_premio(
                    cursor=cursor,
                    id_usuario=id_usuario,
                    nome_pacote=f"Pacote {nm_meta}",
                    qtd_pacotes=qtd_pacotes,
                    qtd_figurinhas=qtd_figurinhas,
                    detalhe_movimentacao=f"Pacote gerado automaticamente pela meta {nm_meta}",
                    id_meta_usuario=id_meta_usuario,
                    indice_base=meta_index,
                )

                if self.moedas_habilitadas():
                    frequencia = str(meta.get("FREQUENCIA") or "").strip().upper()
                    if frequencia == "SEMANAL":
                        qtd_coins = 35
                    elif frequencia == "MENSAL":
                        qtd_coins = 90
                    else:
                        qtd_coins = 12

                    self._registrar_movimentacao_aurora(
                        cursor=cursor,
                        id_usuario=id_usuario,
                        tp_movimentacao="GANHO",
                        tp_origem="META_BATIDA",
                        id_origem=f"meta:{id_meta_usuario}",
                        qtd_coins=qtd_coins,
                        descricao=f"Meta batida: {nm_meta}",
                    )

                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_META_USUARIO
                    SET
                        FL_PREMIO_GERADO = 1,
                        DT_PREMIO_GERADO = GETDATE()
                    WHERE ID_META_USUARIO = ?
                    """,
                    (id_meta_usuario,),
                )

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def resgatar_pacote_loja(
        self,
        id_usuario: Any,
        oferta_id: str,
        nome_oferta: str,
        custo_coins: int,
        qtd_pacotes: int,
        qtd_figurinhas_por_pacote: int,
        perfis_raridade: list[dict[str, Any]] | None = None,
    ):
        if not self.moedas_habilitadas():
            raise RuntimeError(
                "Estrutura de moedas não encontrada no banco. Execute o script backend/sql/album_aurora_coins.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            self._garantir_carteira_aurora(cursor, id_usuario)

            cursor.execute(
                """
                SELECT TOP 1 QTD_SALDO_ATUAL
                FROM album.TB_ALBUM_AURORA_COIN_SALDO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_USUARIO = ?
                """,
                (id_usuario,),
            )
            saldo_row = cursor.fetchone()
            saldo_atual = int(saldo_row[0] or 0) if saldo_row else 0
            if saldo_atual < custo_coins:
                raise ValueError("Saldo insuficiente de Aurora Coins para esse resgate")

            compra_id = f"loja:{oferta_id}:{random.randint(100000, 999999)}"

            self._registrar_movimentacao_aurora(
                cursor=cursor,
                id_usuario=id_usuario,
                tp_movimentacao="GASTO",
                tp_origem="LOJA",
                id_origem=compra_id,
                qtd_coins=-abs(int(custo_coins)),
                descricao=f"Resgate na loja: {nome_oferta}",
                permitir_duplicidade=True,
            )

            self._criar_pacotes_premio(
                cursor=cursor,
                id_usuario=id_usuario,
                nome_pacote=f"Loja {nome_oferta}",
                qtd_pacotes=qtd_pacotes,
                qtd_figurinhas=qtd_figurinhas_por_pacote,
                detalhe_movimentacao=f"Pacote resgatado na loja com Aurora Coins ({nome_oferta})",
                perfis_raridade=perfis_raridade,
            )

            conexao.commit()
            return {
                "oferta_id": oferta_id,
                "nome_oferta": nome_oferta,
                "custo_coins": int(custo_coins),
                "qtd_pacotes": int(qtd_pacotes),
                "qtd_figurinhas_por_pacote": int(qtd_figurinhas_por_pacote),
            }
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def obter_total_venda_rapida_hoje(self, id_usuario: Any) -> int:
        if not id_usuario or not self.moedas_habilitadas():
            return 0

        query = """
            SELECT ISNULL(SUM(QTD_COINS), 0) AS TOTAL
            FROM album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO WITH(NOLOCK)
            WHERE ID_USUARIO = ?
              AND TP_ORIGEM = 'VENDA_RAPIDA'
              AND QTD_COINS > 0
              AND CAST(DT_MOVIMENTACAO AS DATE) = CAST(GETDATE() AS DATE)
        """
        row = self.db.execute_fetch(query=query, parametros=(id_usuario,), one=True)
        return int((row or {}).get("TOTAL") or 0)

    def vender_repetidas_rapido(
        self,
        id_usuario: Any,
        itens: list[dict[str, Any]],
        valores_raridade: dict[str, int],
        limite_diario: int,
    ):
        quantidades: dict[str, int] = {}
        for item in itens:
            id_figurinha = str((item or {}).get("id_figurinha") or "").strip()
            try:
                quantidade = int((item or {}).get("quantidade") or 0)
            except (TypeError, ValueError):
                quantidade = 0
            if not id_figurinha or quantidade <= 0:
                continue
            quantidades[id_figurinha] = quantidades.get(id_figurinha, 0) + quantidade

        if not quantidades:
            raise ValueError("Selecione ao menos uma figurinha repetida para vender")

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            ganho_hoje = self.obter_total_venda_rapida_hoje(id_usuario)
            placeholders = ",".join("?" for _ in quantidades)
            cursor.execute(
                f"""
                SELECT
                    inv.ID_INVENTARIO,
                    inv.ID_FIGURINHA,
                    ISNULL(inv.QTD_TOTAL, 0) AS QTD_TOTAL,
                    ISNULL(inv.QTD_COLADAS, 0) AS QTD_COLADAS,
                    r.NM_RARIDADE,
                    f.NM_FIGURINHA
                FROM album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(UPDLOCK, ROWLOCK)
                INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                    ON f.ID_FIGURINHA = inv.ID_FIGURINHA
                INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                    ON r.ID_RARIDADE = f.ID_RARIDADE
                WHERE inv.ID_USUARIO = ?
                  AND inv.ID_FIGURINHA IN ({placeholders})
                """,
                (id_usuario, *quantidades.keys()),
            )
            inventario = {str(row[1]): row for row in cursor.fetchall() or []}

            total_coins = 0
            itens_vendidos = []
            for id_figurinha, quantidade in quantidades.items():
                row = inventario.get(id_figurinha)
                if not row:
                    raise ValueError("Uma das figurinhas selecionadas nao foi encontrada no inventario")

                id_inventario, _id_fig, qtd_total, qtd_coladas, nm_raridade, nm_figurinha = row
                disponivel = max(int(qtd_total or 0) - int(qtd_coladas or 0), 0)
                if quantidade > disponivel:
                    raise ValueError(f"Quantidade indisponivel para vender {nm_figurinha}")

                raridade = self._normalizar_chave(nm_raridade).replace(" ", "-")
                valor_unitario = int(valores_raridade.get(raridade, 0) or 0)
                if valor_unitario <= 0:
                    raise ValueError(f"Raridade sem valor de venda rapida: {nm_raridade}")

                total_item = quantidade * valor_unitario
                total_coins += total_item
                itens_vendidos.append(
                    {
                        "id_inventario": id_inventario,
                        "id_figurinha": _id_fig,
                        "nome": nm_figurinha,
                        "raridade": raridade,
                        "quantidade": quantidade,
                        "valor_unitario": valor_unitario,
                        "total": total_item,
                    }
                )

            if total_coins <= 0:
                raise ValueError("Nenhuma moeda gerada na venda rapida")
            if ganho_hoje + total_coins > int(limite_diario):
                restante = max(int(limite_diario) - ganho_hoje, 0)
                raise ValueError(f"Limite diario de venda rapida excedido. Restam {restante} coins hoje")

            venda_id = f"venda_rapida:{datetime.now().strftime('%Y%m%d%H%M%S')}:{random.randint(100000, 999999)}"
            for item in itens_vendidos:
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
                    SET QTD_TOTAL = QTD_TOTAL - ?,
                        DT_ULTIMA_OBTENCAO = GETDATE()
                    WHERE ID_INVENTARIO = ?
                    """,
                    (item["quantidade"], item["id_inventario"]),
                )
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                        (ID_USUARIO, ID_FIGURINHA, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                    VALUES (?, ?, ?, ?, GETDATE())
                    """,
                    (
                        id_usuario,
                        item["id_figurinha"],
                        "figurinha_venda_rapida",
                        f"Venda rapida de {item['quantidade']}x {item['nome']} por {item['total']} Aurora Coins",
                    ),
                )

            self._registrar_movimentacao_aurora(
                cursor=cursor,
                id_usuario=id_usuario,
                tp_movimentacao="GANHO",
                tp_origem="VENDA_RAPIDA",
                id_origem=venda_id,
                qtd_coins=total_coins,
                descricao="Venda rapida de figurinhas repetidas",
                permitir_duplicidade=True,
            )

            conexao.commit()
            return {
                "id_venda": venda_id,
                "qtd_itens": sum(item["quantidade"] for item in itens_vendidos),
                "total_coins": total_coins,
                "limite_diario": int(limite_diario),
                "ganho_hoje": ganho_hoje + total_coins,
                "itens": itens_vendidos,
            }
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def resgatar_pacote_misterioso(
        self,
        id_usuario: Any,
        id_figurinha_misteriosa: Any,
        custo_repetidas: int,
        nome_pacote: str,
        limite_resgates: int,
    ):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT COUNT(DISTINCT p.ID_USUARIO) AS TOTAL_RESGATES
                FROM album.TB_ALBUM_PACOTE p WITH(UPDLOCK, HOLDLOCK)
                INNER JOIN album.TB_ALBUM_PACOTE_ITEM pi WITH(UPDLOCK, HOLDLOCK)
                    ON pi.ID_PACOTE = p.ID_PACOTE
                WHERE p.NM_PACOTE = ?
                  AND pi.ID_FIGURINHA = ?
                """,
                (nome_pacote, id_figurinha_misteriosa),
            )
            total_resgates = int(cursor.fetchone()[0] or 0)
            if total_resgates >= int(limite_resgates):
                raise ValueError("Os resgates do pacote misterioso se esgotaram")

            cursor.execute(
                """
                SELECT TOP 1 1
                FROM album.TB_ALBUM_PACOTE p WITH(UPDLOCK, HOLDLOCK)
                INNER JOIN album.TB_ALBUM_PACOTE_ITEM pi WITH(UPDLOCK, HOLDLOCK)
                    ON pi.ID_PACOTE = p.ID_PACOTE
                WHERE p.ID_USUARIO = ?
                  AND p.NM_PACOTE = ?
                  AND pi.ID_FIGURINHA = ?
                """,
                (
                    id_usuario,
                    nome_pacote,
                    id_figurinha_misteriosa,
                ),
            )
            if cursor.fetchone():
                raise ValueError("Voc? j? resgatou o pacote misterioso")

            cursor.execute(
                """
                SELECT
                    inv.ID_INVENTARIO,
                    inv.ID_FIGURINHA,
                    ISNULL(inv.QTD_TOTAL, 0) AS QTD_TOTAL,
                    ISNULL(inv.QTD_COLADAS, 0) AS QTD_COLADAS,
                    CASE LOWER(LTRIM(RTRIM(ISNULL(r.NM_RARIDADE, ''))))
                        WHEN 'comum' THEN 1
                        WHEN 'incomum' THEN 2
                        WHEN 'raro' THEN 3
                        WHEN 'ultra-raro' THEN 4
                        WHEN 'epico' THEN 5
                        WHEN '?pico' THEN 5
                        WHEN 'lendario' THEN 6
                        WHEN 'lend?rio' THEN 6
                        WHEN 'boss' THEN 7
                        ELSE 8
                    END AS ORDEM_RARIDADE
                FROM album.TB_ALBUM_INVENTARIO_USUARIO inv WITH(UPDLOCK, ROWLOCK)
                INNER JOIN album.TB_ALBUM_FIGURINHA f WITH(NOLOCK)
                    ON f.ID_FIGURINHA = inv.ID_FIGURINHA
                INNER JOIN album.TB_ALBUM_RARIDADE r WITH(NOLOCK)
                    ON r.ID_RARIDADE = f.ID_RARIDADE
                WHERE inv.ID_USUARIO = ?
                  AND inv.ID_FIGURINHA <> ?
                  AND ISNULL(inv.QTD_TOTAL, 0) > ISNULL(inv.QTD_COLADAS, 0)
                ORDER BY ORDEM_RARIDADE, inv.DT_ULTIMA_OBTENCAO, inv.ID_FIGURINHA
                """,
                (id_usuario, id_figurinha_misteriosa),
            )
            repetidas = cursor.fetchall()
            total_disponivel = sum(
                max(int(row[2] or 0) - int(row[3] or 0), 0)
                for row in repetidas
            )
            if total_disponivel < int(custo_repetidas):
                raise ValueError("Figurinhas repetidas insuficientes para resgatar o pacote misterioso")

            restante = int(custo_repetidas)
            for id_inventario, id_figurinha, qtd_total, qtd_coladas, _ordem in repetidas:
                if restante <= 0:
                    break
                disponivel = max(int(qtd_total or 0) - int(qtd_coladas or 0), 0)
                consumir = min(disponivel, restante)
                if consumir <= 0:
                    continue

                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
                    SET QTD_TOTAL = QTD_TOTAL - ?,
                        DT_ULTIMA_OBTENCAO = GETDATE()
                    WHERE ID_INVENTARIO = ?
                    """,
                    (consumir, id_inventario),
                )
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                        (ID_USUARIO, ID_FIGURINHA, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                    VALUES (?, ?, ?, ?, GETDATE())
                    """,
                    (
                        id_usuario,
                        id_figurinha,
                        "figurinha_repetida_entregue",
                        f"Figurinha repetida entregue para resgate do {nome_pacote}",
                    ),
                )
                restante -= consumir

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_PACOTE (
                    ID_USUARIO,
                    ID_META_USUARIO,
                    NM_PACOTE,
                    COR_PACOTE_HEX,
                    STATUS_PACOTE,
                    QTD_FIGURINHAS,
                    DT_GANHO,
                    DT_ABERTURA
                )
                OUTPUT INSERTED.ID_PACOTE
                VALUES (?, NULL, ?, '#111827', 'FECHADO', 1, GETDATE(), NULL)
                """,
                (id_usuario, nome_pacote),
            )
            id_pacote = cursor.fetchone()[0]

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_PACOTE_ITEM (
                    ID_PACOTE,
                    ORDEM_REVELACAO,
                    ID_FIGURINHA,
                    DT_CADASTRO
                )
                VALUES (?, 1, ?, GETDATE())
                """,
                (id_pacote, id_figurinha_misteriosa),
            )
            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, ID_PACOTE, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, ?, GETDATE())
                """,
                (
                    id_usuario,
                    id_pacote,
                    "pacote_misterioso_resgatado",
                    f"Resgate do {nome_pacote} por {custo_repetidas} figurinhas repetidas",
                ),
            )

            conexao.commit()
            return {
                "id_pacote": str(id_pacote),
                "nome_pacote": nome_pacote,
                "custo_repetidas": int(custo_repetidas),
            }
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def _buscar_streak_vitorias_cursor(self, cursor, id_usuario: Any) -> int:
        cursor.execute(
            """
            SELECT TOP 20
                STATUS_DUELO,
                ID_USUARIO_VENCEDOR
            FROM album.TB_ALBUM_DUELO_DIARIO WITH(NOLOCK)
            WHERE EXISTS (
                    SELECT 1
                    FROM album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE p WITH(NOLOCK)
                    WHERE p.ID_DUELO_DIARIO = album.TB_ALBUM_DUELO_DIARIO.ID_DUELO_DIARIO
                      AND p.ID_USUARIO = ?
                  )
              AND STATUS_DUELO IN ('VENCIDO', 'EXPIRADO')
              AND DT_CONCLUSAO IS NOT NULL
            ORDER BY DT_CONCLUSAO DESC
            """,
            (id_usuario,),
        )
        streak = 0
        for status_duelo, id_usuario_vencedor in cursor.fetchall() or []:
            if str(status_duelo or "").upper() != "VENCIDO":
                break
            if str(id_usuario_vencedor or "") != str(id_usuario):
                break
            streak += 1
        return streak

    def _listar_participantes_duelo_cursor(self, cursor, id_duelo: Any):
        cursor.execute(
            """
            SELECT
                p.ID_USUARIO,
                p.TP_TIME,
                p.NR_ORDEM_TIME,
                p.VL_BASE_METRICA,
                u.NM_COLABORADOR,
                u.CENTRO_CUSTO,
                u.SUPERVISOR
            FROM album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE p WITH(NOLOCK)
            INNER JOIN login.TB_USUARIOS u WITH(NOLOCK)
                ON u.CPF_COLABORADOR = p.ID_USUARIO
            WHERE p.ID_DUELO_DIARIO = ?
            ORDER BY p.TP_TIME, p.NR_ORDEM_TIME, u.NM_COLABORADOR
            """,
            (id_duelo,),
        )
        rows = cursor.fetchall() or []
        participantes = []
        for row in rows:
            participantes.append(
                {
                    "ID_USUARIO": row[0],
                    "TP_TIME": row[1],
                    "NR_ORDEM_TIME": row[2],
                    "VL_BASE_METRICA": row[3],
                    "NM_COLABORADOR": row[4],
                    "CENTRO_CUSTO": row[5],
                    "SUPERVISOR": row[6],
                }
            )
        return participantes

    def criar_duelo_diario(
        self,
        id_usuario_desafiante: Any,
        id_usuario_desafiado: Any,
        centro_custo: str,
        tp_metrica_duelo: str,
        qtd_meta_acordos: int,
        vl_base_desafiante: float = 0,
        vl_base_desafiado: float = 0,
        participantes_desafiante: list[dict[str, Any]] | None = None,
        participantes_desafiado: list[dict[str, Any]] | None = None,
    ):
        if not self.duelos_habilitados():
            raise RuntimeError(
                "Estrutura de duelos não encontrada no banco. Execute o script backend/sql/album_duelos.sql."
            )

        if str(id_usuario_desafiante) == str(id_usuario_desafiado):
            raise ValueError("Não é possível desafiar o próprio operador")

        time_desafiante = participantes_desafiante or [
            {"id_usuario": id_usuario_desafiante, "vl_base_metrica": vl_base_desafiante}
        ]
        time_desafiado = participantes_desafiado or [
            {"id_usuario": id_usuario_desafiado, "vl_base_metrica": vl_base_desafiado}
        ]

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            dt_duelo = datetime.now().date()

            ids_bloqueados = [
                str(item.get("id_usuario") or "")
                for item in [*time_desafiante, *time_desafiado]
                if str(item.get("id_usuario") or "").strip()
            ]
            placeholders = ", ".join("?" for _ in ids_bloqueados)

            cursor.execute(
                f"""
                SELECT TOP 1 d.ID_DUELO_DIARIO
                FROM album.TB_ALBUM_DUELO_DIARIO d WITH(UPDLOCK, ROWLOCK)
                INNER JOIN album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE p WITH(NOLOCK)
                    ON p.ID_DUELO_DIARIO = d.ID_DUELO_DIARIO
                WHERE DT_DUELO = ?
                  AND STATUS_DUELO IN ('PENDENTE', 'ATIVO')
                  AND p.ID_USUARIO IN ({placeholders})
                """,
                (dt_duelo, *ids_bloqueados),
            )
            if cursor.fetchone():
                raise ValueError("Um dos operadores selecionados já possui duelo pendente ou ativo hoje")

            agora = datetime.now()
            fim_duelo = datetime.combine(dt_duelo + timedelta(days=1), datetime.min.time()) - timedelta(seconds=1)

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_DUELO_DIARIO (
                    DT_DUELO,
                    ID_USUARIO_DESAFIANTE,
                    ID_USUARIO_DESAFIADO,
                    NM_CENTRO_CUSTO,
                    TP_METRICA_DUELO,
                    QTD_META_ACORDOS,
                    STATUS_DUELO,
                    DT_CRIACAO,
                    DT_INICIO_CONTAGEM,
                    DT_FIM_DUELO,
                    VL_BASE_DESAFIANTE,
                    VL_BASE_DESAFIADO
                )
                OUTPUT INSERTED.ID_DUELO_DIARIO
                VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?, ?, ?)
                """,
                (
                    dt_duelo,
                    id_usuario_desafiante,
                    id_usuario_desafiado,
                    centro_custo,
                    tp_metrica_duelo,
                    int(qtd_meta_acordos),
                    agora,
                    agora,
                    fim_duelo,
                    float(vl_base_desafiante or 0),
                    float(vl_base_desafiado or 0),
                ),
            )
            duelo_id = cursor.fetchone()[0]

            for indice, participante in enumerate(time_desafiante, start=1):
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE (
                        ID_DUELO_DIARIO,
                        ID_USUARIO,
                        TP_TIME,
                        NR_ORDEM_TIME,
                        VL_BASE_METRICA
                    )
                    VALUES (?, ?, 'DESAFIANTE', ?, ?)
                    """,
                    (
                        duelo_id,
                        str(participante.get("id_usuario")),
                        indice,
                        float(participante.get("vl_base_metrica") or 0),
                    ),
                )

            for indice, participante in enumerate(time_desafiado, start=1):
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_DUELO_DIARIO_PARTICIPANTE (
                        ID_DUELO_DIARIO,
                        ID_USUARIO,
                        TP_TIME,
                        NR_ORDEM_TIME,
                        VL_BASE_METRICA
                    )
                    VALUES (?, ?, 'DESAFIADO', ?, ?)
                    """,
                    (
                        duelo_id,
                        str(participante.get("id_usuario")),
                        indice,
                        float(participante.get("vl_base_metrica") or 0),
                    ),
                )
            conexao.commit()
            return str(duelo_id)
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def responder_duelo_diario(
        self,
        id_usuario_resposta: Any,
        id_duelo: str,
        acao: str,
    ):
        if not self.duelos_habilitados():
            raise RuntimeError(
                "Estrutura de duelos não encontrada no banco. Execute o script backend/sql/album_duelos.sql."
            )

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            cursor.execute(
                """
                SELECT TOP 1
                    ID_USUARIO_DESAFIADO,
                    STATUS_DUELO,
                    DT_FIM_DUELO
                FROM album.TB_ALBUM_DUELO_DIARIO WITH(UPDLOCK, ROWLOCK)
                WHERE ID_DUELO_DIARIO = ?
                """,
                (id_duelo,),
            )
            duelo = cursor.fetchone()
            if not duelo:
                raise ValueError("Duelo não encontrado")

            id_desafiado, status_duelo, dt_fim_duelo = duelo
            participantes = self._listar_participantes_duelo_cursor(cursor, id_duelo)
            time_desafiado = {
                str(item.get("ID_USUARIO") or "")
                for item in participantes
                if str(item.get("TP_TIME") or "").upper() == "DESAFIADO"
            }
            if str(id_usuario_resposta or "") not in time_desafiado:
                raise ValueError("Apenas membros do time desafiado podem responder esse duelo")
            if str(status_duelo or "").upper() != "PENDENTE":
                raise ValueError("Esse duelo não está mais pendente")
            if dt_fim_duelo and datetime.now() > dt_fim_duelo:
                raise ValueError("Esse duelo diário já expirou")

            acao_normalizada = str(acao or "").strip().upper()
            if acao_normalizada == "ACEITAR":
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_DUELO_DIARIO
                    SET
                        STATUS_DUELO = 'ATIVO',
                        DT_RESPOSTA = SYSDATETIME()
                    WHERE ID_DUELO_DIARIO = ?
                    """,
                    (id_duelo,),
                )
            elif acao_normalizada == "RECUSAR":
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_DUELO_DIARIO
                    SET
                        STATUS_DUELO = 'RECUSADO',
                        DT_RESPOSTA = SYSDATETIME(),
                        DT_CONCLUSAO = SYSDATETIME()
                    WHERE ID_DUELO_DIARIO = ?
                    """,
                    (id_duelo,),
                )
            else:
                raise ValueError("Ação de duelo inválida")

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def sincronizar_duelos_diarios(self, duelos: list[dict[str, Any]]):
        if not self.duelos_habilitados() or not duelos:
            return

        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()
            agora = datetime.now()
            participantes_por_duelo = {
                str(item.get("ID_DUELO_DIARIO")): []
                for item in duelos
                if item.get("ID_DUELO_DIARIO")
            }
            if participantes_por_duelo:
                for participante in self.listar_participantes_duelos(list(participantes_por_duelo.keys())):
                    participantes_por_duelo[str(participante.get("ID_DUELO_DIARIO"))].append(participante)

            for duelo in duelos:
                status_duelo = str(duelo.get("STATUS_DUELO") or "").upper()
                if status_duelo not in {"PENDENTE", "ATIVO"}:
                    continue

                id_duelo = duelo.get("ID_DUELO_DIARIO")
                id_desafiante = duelo.get("ID_USUARIO_DESAFIANTE")
                id_desafiado = duelo.get("ID_USUARIO_DESAFIADO")
                tp_metrica = str(duelo.get("TP_METRICA_DUELO") or "ACORDOS").strip().upper()
                meta_acordos = int(duelo.get("QTD_META_ACORDOS") or 0)
                dt_inicio = duelo.get("DT_INICIO_CONTAGEM")
                dt_fim = duelo.get("DT_FIM_DUELO")
                if not id_duelo or not dt_inicio or not dt_fim:
                    continue

                limite_apuracao = min(agora, dt_fim)
                total_desafiante = 0
                total_desafiado = 0
                dt_meta_desafiante = None
                dt_meta_desafiado = None
                participantes_duelo = participantes_por_duelo.get(str(id_duelo), [])
                time_desafiante = [
                    item for item in participantes_duelo if str(item.get("TP_TIME") or "").upper() == "DESAFIANTE"
                ]
                time_desafiado = [
                    item for item in participantes_duelo if str(item.get("TP_TIME") or "").upper() == "DESAFIADO"
                ]
                if not time_desafiante or not time_desafiado:
                    continue

                def _avaliar_time_pp(participantes_time: list[dict[str, Any]]):
                    total_atual = 0
                    eventos = []
                    for participante in participantes_time:
                        snapshots = self.listar_resultados_vega_detalhados(
                            str(participante.get("ID_USUARIO")),
                            dt_inicio,
                            limite_apuracao,
                            participante.get("NM_COLABORADOR"),
                        )
                        base = int(round(float(participante.get("VL_BASE_METRICA") or 0)))
                        progresso_atual = 0
                        for snapshot in snapshots:
                            progresso = max(0, int(snapshot.get("QTD_PP") or 0) - base)
                            progresso_atual = max(progresso_atual, progresso)
                            eventos.append(
                                (
                                    snapshot.get("DT_EVENTO") or limite_apuracao,
                                    str(participante.get("ID_USUARIO")),
                                    progresso,
                                )
                            )
                        total_atual += progresso_atual

                    eventos.sort(key=lambda item: item[0] or limite_apuracao)
                    progresso_por_usuario: dict[str, int] = {}
                    dt_meta = None
                    for dt_evento, id_usuario_evento, progresso in eventos:
                        progresso_por_usuario[id_usuario_evento] = max(
                            progresso_por_usuario.get(id_usuario_evento, 0),
                            progresso,
                        )
                        if sum(progresso_por_usuario.values()) >= meta_acordos:
                            dt_meta = dt_evento
                            break
                    return total_atual, dt_meta

                def _avaliar_time_acordos(participantes_time: list[dict[str, Any]]):
                    total_atual = 0
                    eventos = []
                    for participante in participantes_time:
                        base = int(round(float(participante.get("VL_BASE_METRICA") or 0)))
                        producao_dia = self.listar_producao_usuario_periodo(
                            str(participante.get("ID_USUARIO")),
                            dt_inicio.date(),
                            limite_apuracao.date(),
                            participante.get("NM_COLABORADOR"),
                        )
                        total_dia = len(
                            {
                                str(item.get("ID_ACORDO"))
                                for item in producao_dia
                                if item.get("ID_ACORDO") is not None
                            }
                        )
                        total_atual += max(0, total_dia - base)

                        acordos_periodo = self.listar_acordos_usuario_periodo_detalhado(
                            str(participante.get("ID_USUARIO")),
                            dt_inicio,
                            limite_apuracao,
                            participante.get("NM_COLABORADOR"),
                        )
                        for acordo in acordos_periodo:
                            eventos.append(acordo.get("DATA_ACORDO") or limite_apuracao)

                    eventos.sort(key=lambda item: item or limite_apuracao)
                    dt_meta = eventos[meta_acordos - 1] if len(eventos) >= meta_acordos else None
                    if total_atual >= meta_acordos and dt_meta is None:
                        dt_meta = limite_apuracao
                    return total_atual, dt_meta

                if tp_metrica == "PP":
                    total_desafiante, dt_meta_desafiante = _avaliar_time_pp(time_desafiante)
                    total_desafiado, dt_meta_desafiado = _avaliar_time_pp(time_desafiado)
                else:
                    total_desafiante, dt_meta_desafiante = _avaliar_time_acordos(time_desafiante)
                    total_desafiado, dt_meta_desafiado = _avaliar_time_acordos(time_desafiado)

                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_DUELO_DIARIO
                    SET
                        QTD_ACORDOS_DESAFIANTE = ?,
                        QTD_ACORDOS_DESAFIADO = ?
                    WHERE ID_DUELO_DIARIO = ?
                    """,
                    (total_desafiante, total_desafiado, id_duelo),
                )

                if status_duelo == "PENDENTE" and agora <= dt_fim:
                    continue

                vencedor = None
                dt_vitoria = None
                if status_duelo == "ATIVO" and meta_acordos > 0:
                    if dt_meta_desafiante and dt_meta_desafiado:
                        if dt_meta_desafiante <= dt_meta_desafiado:
                            vencedor = id_desafiante
                            dt_vitoria = dt_meta_desafiante
                        else:
                            vencedor = id_desafiado
                            dt_vitoria = dt_meta_desafiado
                    elif dt_meta_desafiante:
                        vencedor = id_desafiante
                        dt_vitoria = dt_meta_desafiante
                    elif dt_meta_desafiado:
                        vencedor = id_desafiado
                        dt_vitoria = dt_meta_desafiado

                if vencedor:
                    streak = self._buscar_streak_vitorias_cursor(cursor, vencedor) + 1
                    time_vencedor = time_desafiante if str(vencedor) == str(id_desafiante) else time_desafiado
                    nome_oponente = (
                        duelo.get("NM_DESAFIADO")
                        if str(vencedor) == str(id_desafiante)
                        else duelo.get("NM_DESAFIANTE")
                    ) or "oponente"
                    cursor.execute(
                        """
                        UPDATE album.TB_ALBUM_DUELO_DIARIO
                        SET
                            STATUS_DUELO = 'VENCIDO',
                            DT_CONCLUSAO = ?,
                            ID_USUARIO_VENCEDOR = ?,
                            NR_STREAK_VITORIAS_VENCEDOR = ?
                        WHERE ID_DUELO_DIARIO = ?
                        """,
                        (dt_vitoria or agora, vencedor, streak, id_duelo),
                    )
                    for participante_vencedor in time_vencedor:
                        self._criar_pacotes_premio(
                            cursor=cursor,
                            id_usuario=participante_vencedor.get("ID_USUARIO"),
                            nome_pacote="Duelo diário",
                            qtd_pacotes=2,
                            qtd_figurinhas=5,
                            detalhe_movimentacao=f"Pacote ganho no duelo diário contra {nome_oponente}",
                        )
                    continue

                if agora > dt_fim:
                    cursor.execute(
                        """
                        UPDATE album.TB_ALBUM_DUELO_DIARIO
                        SET
                            STATUS_DUELO = 'EXPIRADO',
                            DT_CONCLUSAO = ?
                        WHERE ID_DUELO_DIARIO = ?
                        """,
                        (dt_fim, id_duelo),
                    )

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def abrir_pacote(self, id_usuario: Any, id_pacote: str):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                """
                SELECT
                    ID_PACOTE,
                    STATUS_PACOTE,
                    QTD_FIGURINHAS
                FROM album.TB_ALBUM_PACOTE WITH(UPDLOCK, ROWLOCK)
                WHERE ID_PACOTE = ?
                  AND ID_USUARIO = ?
                """,
                (id_pacote, id_usuario),
            )
            pacote = cursor.fetchone()

            if not pacote:
                raise ValueError("Pacote não encontrado para o usuário")

            status_pacote = str(pacote[1] or "").upper()
            if status_pacote != "FECHADO":
                raise ValueError("Pacote já foi aberto ou não está disponível")

            cursor.execute(
                """
                SELECT
                    pi.ID_FIGURINHA,
                    pi.ORDEM_REVELACAO
                FROM album.TB_ALBUM_PACOTE_ITEM pi WITH(UPDLOCK, ROWLOCK)
                WHERE pi.ID_PACOTE = ?
                ORDER BY pi.ORDEM_REVELACAO
                """,
                (id_pacote,),
            )
            itens = cursor.fetchall()

            if not itens:
                raise ValueError("Pacote sem figurinhas cadastradas")

            for id_figurinha, ordem_revelacao in itens:
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_INVENTARIO_USUARIO
                    SET
                        QTD_TOTAL = ISNULL(QTD_TOTAL, 0) + 1,
                        QTD_COLADAS = CASE
                            WHEN ISNULL(QTD_COLADAS, 0) = 0 THEN 1
                            ELSE QTD_COLADAS
                        END,
                        DT_ULTIMA_OBTENCAO = GETDATE()
                    WHERE ID_USUARIO = ?
                      AND ID_FIGURINHA = ?
                    """,
                    (id_usuario, id_figurinha),
                )

                if cursor.rowcount == 0:
                    cursor.execute(
                        """
                        INSERT INTO album.TB_ALBUM_INVENTARIO_USUARIO
                            (ID_USUARIO, ID_FIGURINHA, QTD_TOTAL, QTD_COLADAS, DT_PRIMEIRA_OBTENCAO, DT_ULTIMA_OBTENCAO)
                        VALUES (?, ?, 1, 1, GETDATE(), GETDATE())
                        """,
                        (id_usuario, id_figurinha),
                    )

                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                        (ID_USUARIO, ID_PACOTE, ID_FIGURINHA, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                    VALUES (?, ?, ?, ?, ?, GETDATE())
                    """,
                    (
                        id_usuario,
                        id_pacote,
                        id_figurinha,
                        "figurinha_recebida",
                        f"Figurinha recebida na ordem {ordem_revelacao}",
                    ),
                )

            cursor.execute(
                """
                UPDATE album.TB_ALBUM_PACOTE
                SET
                    STATUS_PACOTE = 'ABERTO',
                    DT_ABERTURA = GETDATE()
                WHERE ID_PACOTE = ?
                  AND ID_USUARIO = ?
                """,
                (id_pacote, id_usuario),
            )

            cursor.execute(
                """
                INSERT INTO album.TB_ALBUM_MOVIMENTACAO
                    (ID_USUARIO, ID_PACOTE, TP_MOVIMENTACAO, DS_DETALHE, DT_MOVIMENTACAO)
                VALUES (?, ?, ?, ?, GETDATE())
                """,
                (
                    id_usuario,
                    id_pacote,
                    "pacote_aberto",
                    "Pacote aberto pelo usuário",
                ),
            )

            conexao.commit()
            return True
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def salvar_config_global_meta_copa(self, metas: list[dict[str, Any]], cpf_supervisor: str):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            for meta in metas:
                cursor.execute(
                    """
                    UPDATE album.TB_ALBUM_META
                    SET
                        FL_ATIVA = ?,
                        VL_ALVO = ?,
                        FREQUENCIA = ?,
                        ORDEM_EXIBICAO = ?
                    WHERE ID_META = ?
                    """,
                    (
                        meta["ativa"],
                        meta["valor_alvo"],
                        meta["frequencia"],
                        meta["ordem_exibicao"],
                        meta["id_meta_tipo"],
                    ),
                )

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()

    def salvar_overrides_meta_operador(
        self,
        cpf_operador: str,
        overrides: list[dict[str, Any]],
        cpf_supervisor: str,
    ):
        conexao = None
        try:
            conexao = self.db._connect()
            cursor = conexao.cursor()

            cursor.execute(
                "DELETE FROM album.TB_ALBUM_META_CONFIG_OPERADOR WHERE CPF_COLABORADOR = ?",
                (cpf_operador,),
            )

            for meta in overrides:
                cursor.execute(
                    """
                    INSERT INTO album.TB_ALBUM_META_CONFIG_OPERADOR (
                        ID_META_CONFIG_OPERADOR,
                        CPF_COLABORADOR,
                        ID_META,
                        FL_ATIVA,
                        VL_ALVO,
                        FREQUENCIA,
                        QTD_PACOTES,
                        QTD_FIGURINHAS_POR_PACOTE,
                        ORDEM_EXIBICAO,
                        CPF_SUPERVISOR_ALTERACAO,
                        DT_CADASTRO,
                        DT_ATUALIZACAO
                    )
                    VALUES (
                        NEWID(),
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        GETDATE(),
                        GETDATE()
                    )
                    """,
                    (
                        cpf_operador,
                        meta["id_meta_tipo"],
                        meta["ativa"],
                        meta["valor_alvo"],
                        meta["frequencia"],
                        meta["qtd_pacotes"],
                        meta["qtd_figurinhas_por_pacote"],
                        meta["ordem_exibicao"],
                        cpf_supervisor,
                    ),
                )

            conexao.commit()
        except Exception:
            if conexao is not None:
                conexao.rollback()
            raise
        finally:
            if conexao is not None:
                conexao.close()
