import json
import random

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class ArenaRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")
        self._visual_expandido = None

    @staticmethod
    def _calcular_proximidade_bingo(casas, padrao):
        por_posicao = {
            (str(casa["coluna"]), int(casa["linha"])): casa
            for casa in casas
        }
        colunas = "BINGO"
        linhas = [
            {(coluna, linha) for coluna in colunas}
            for linha in range(1, 6)
        ]
        linhas += [
            {(coluna, linha) for linha in range(1, 6)}
            for coluna in colunas
        ]
        linhas += [
            {(colunas[indice], indice + 1) for indice in range(5)},
            {(colunas[4 - indice], indice + 1) for indice in range(5)},
        ]

        def pendentes(posicoes):
            return {
                posicao for posicao in posicoes
                if not bool(por_posicao.get(posicao, {}).get("marcada"))
            }

        if padrao == "QUATRO_CANTOS":
            alvo = {("B", 1), ("O", 1), ("B", 5), ("O", 5)}
            faltantes = pendentes(alvo)
        elif padrao == "CARTELA_CHEIA":
            faltantes = pendentes(set(por_posicao))
        elif padrao == "DUAS_LINHAS":
            possibilidades = [
                pendentes(linhas[primeira] | linhas[segunda])
                for primeira in range(len(linhas))
                for segunda in range(primeira + 1, len(linhas))
            ]
            faltantes = min(possibilidades, key=len) if possibilidades else set()
        else:
            possibilidades = [pendentes(linha) for linha in linhas]
            faltantes = min(possibilidades, key=len) if possibilidades else set()

        numeros = sorted(
            int(por_posicao[posicao]["numero"])
            for posicao in faltantes
            if por_posicao.get(posicao, {}).get("numero") is not None
        )
        return {
            "faltam_para_vencer": len(faltantes),
            "numeros_necessarios": numeros,
            "quase_bingo": len(faltantes) == 1,
        }

    def obter_usuario(self, cpf):
        query = """
            SELECT
                CAST(CPF_COLABORADOR AS VARCHAR(20)) AS cpf,
                LTRIM(RTRIM(NM_COLABORADOR)) AS nome,
                LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo,
                LTRIM(RTRIM(FUNCAO_COLABORADOR)) AS funcao
            FROM login.TB_USUARIOS WITH (NOLOCK)
            WHERE CPF_COLABORADOR = ?
              AND ISNULL(USUARIO_ATIVO, 1) = 1
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(str(cpf),),
            one=True,
        )

    def listar_tipos_jogo(self):
        query = """
            SELECT
                ID_TIPO_JOGO AS id,
                CODIGO AS codigo,
                NOME AS nome,
                DESCRICAO AS descricao,
                ICONE AS icone,
                COR AS cor,
                ORDEM AS ordem
            FROM dbo.TB_ARENA_TIPO_JOGO WITH (NOLOCK)
            WHERE ATIVO = 1
            ORDER BY ORDEM, ID_TIPO_JOGO
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False,
        ) or []

    def obter_tipo_jogo(self, codigo):
        query = """
            SELECT TOP 1
                ID_TIPO_JOGO AS id,
                CODIGO AS codigo,
                NOME AS nome
            FROM dbo.TB_ARENA_TIPO_JOGO WITH (NOLOCK)
            WHERE CODIGO = ?
              AND ATIVO = 1
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(codigo,),
            one=True,
        )

    def obter_temporada_atual(self):
        query = """
            SELECT TOP 1
                ID_TEMPORADA AS id,
                CODIGO AS codigo,
                NOME AS nome,
                DESCRICAO AS descricao,
                DT_INICIO AS data_inicio,
                DT_FIM AS data_fim,
                STATUS AS status
            FROM dbo.TB_ARENA_TEMPORADA WITH (NOLOCK)
            WHERE STATUS = 'ATIVA'
              AND CAST(GETDATE() AS DATE) BETWEEN DT_INICIO AND DT_FIM
            ORDER BY DT_INICIO DESC, ID_TEMPORADA DESC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=True,
        )

    def obter_perfil(self, cpf, id_temporada):
        query = """
            SELECT
                ISNULL(P.XP_TOTAL, 0) AS xp_total,
                ISNULL(P.NIVEL, 1) AS nivel,
                ISNULL(P.TITULO, 'Iniciante') AS titulo,
                ISNULL((
                    SELECT SUM(M.XP)
                    FROM dbo.TB_ARENA_XP_MOVIMENTACAO M WITH (NOLOCK)
                    WHERE M.CPF_COLABORADOR = ?
                      AND (
                            (? IS NULL AND M.ID_TEMPORADA IS NULL)
                            OR M.ID_TEMPORADA = ?
                      )
                ), 0) AS xp_temporada
            FROM (SELECT 1 AS marcador) BASE
            LEFT JOIN dbo.TB_ARENA_PERFIL P WITH (NOLOCK)
                ON P.CPF_COLABORADOR = ?
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(
                str(cpf),
                id_temporada,
                id_temporada,
                str(cpf),
            ),
            one=True,
        ) or {}

    def personalizacao_aurora_habilitada(self):
        """Confirma o contrato compartilhado entre Arena e Album.

        Os visuais pertencem a Arena, mas a carteira continua sendo a fonte
        oficial do Album. A checagem explicita evita criar um segundo saldo
        silenciosamente quando a migration ainda nao foi aplicada.
        """
        row = self.db.execute_fetch(
            query="""
                SELECT CASE
                    WHEN OBJECT_ID(
                        'album.TB_ALBUM_AURORA_COIN_SALDO', 'U'
                    ) IS NULL THEN 0
                    WHEN OBJECT_ID(
                        'album.TB_ALBUM_AURORA_COIN_MOVIMENTACAO', 'U'
                    ) IS NULL THEN 0
                    WHEN OBJECT_ID(
                        'dbo.TB_ARENA_AURORA_ITEM', 'U'
                    ) IS NULL THEN 0
                    WHEN OBJECT_ID(
                        'dbo.TB_ARENA_AURORA_INVENTARIO', 'U'
                    ) IS NULL THEN 0
                    WHEN OBJECT_ID(
                        'dbo.TB_ARENA_AURORA_EQUIPADO', 'U'
                    ) IS NULL THEN 0
                    ELSE 1
                END AS habilitada
            """,
            parametros=(),
            one=True,
        )
        return bool(row and row.get("habilitada"))

    def _visual_expandido_disponivel(self):
        """Diz se a migration 019 ja rodou, memorizando a resposta.

        Sem esta checagem qualquer SELECT que cite FILTRO_COR derruba a aba
        inteira quando a migration ainda nao foi aplicada: o operador ve o
        catalogo de emergencia no lugar do armario, sem nenhuma pista do
        motivo. Aqui a ausencia das colunas so custa as variantes de cor.
        """
        if self._visual_expandido is None:
            row = self.db.execute_fetch(
                query="""
                    SELECT CASE WHEN COL_LENGTH(
                        'dbo.TB_ARENA_AURORA_ITEM', 'FILTRO_COR'
                    ) IS NULL THEN 0 ELSE 1 END AS disponivel
                """,
                parametros=(),
                one=True,
            )
            self._visual_expandido = bool(row and row.get("disponivel"))
        return self._visual_expandido

    def obter_personalizacao_aurora(self, cpf):
        saldo = self.db.execute_fetch(
            query="""
                SELECT ISNULL(QTD_SALDO_ATUAL, 0) AS saldo_coins
                FROM album.TB_ALBUM_AURORA_COIN_SALDO WITH (NOLOCK)
                WHERE ID_USUARIO = ?
            """,
            parametros=(str(cpf),),
            one=True,
        ) or {}
        perfil = self.db.execute_fetch(
            query="""
                SELECT ISNULL(XP_TOTAL, 0) AS xp_total
                FROM dbo.TB_ARENA_PERFIL WITH (NOLOCK)
                WHERE CPF_COLABORADOR = ?
            """,
            parametros=(str(cpf),),
            one=True,
        ) or {}
        colunas_expandidas = (
            """ITEM.FILTRO_COR AS filtro_cor,
                    ITEM.CODIGO_CONJUNTO AS codigo_conjunto,
                    ITEM.NOME_CONJUNTO AS nome_conjunto,"""
            if self._visual_expandido_disponivel()
            else """CAST(NULL AS NVARCHAR(120)) AS filtro_cor,
                    CAST(NULL AS NVARCHAR(40)) AS codigo_conjunto,
                    CAST(NULL AS NVARCHAR(60)) AS nome_conjunto,"""
        )
        itens = self.db.execute_fetch(
            query=f"""
                SELECT
                    ITEM.ID_ITEM AS id,
                    ITEM.CODIGO AS codigo,
                    ITEM.NOME AS nome,
                    ITEM.DESCRICAO AS descricao,
                    ITEM.SLOT AS slot,
                    ITEM.RARIDADE AS raridade,
                    ITEM.PRECO_COINS AS preco_coins,
                    ITEM.XP_NECESSARIO AS xp_necessario,
                    ITEM.CHAVE_VISUAL AS chave_visual,
                    {colunas_expandidas}
                    ITEM.ORDEM AS ordem,
                    CASE WHEN INV.ID_ITEM IS NULL THEN 0 ELSE 1 END
                        AS adquirido,
                    INV.DT_AQUISICAO AS adquirido_em,
                    CASE WHEN EQ.ID_ITEM IS NULL THEN 0 ELSE 1 END
                        AS equipado,
                    EQ.DT_EQUIPADO AS equipado_em
                FROM dbo.TB_ARENA_AURORA_ITEM ITEM WITH (NOLOCK)
                LEFT JOIN dbo.TB_ARENA_AURORA_INVENTARIO INV WITH (NOLOCK)
                    ON INV.ID_ITEM = ITEM.ID_ITEM
                   AND INV.CPF_COLABORADOR = ?
                LEFT JOIN dbo.TB_ARENA_AURORA_EQUIPADO EQ WITH (NOLOCK)
                    ON EQ.ID_ITEM = ITEM.ID_ITEM
                   AND EQ.CPF_COLABORADOR = ?
                   AND EQ.SLOT = ITEM.SLOT
                WHERE ITEM.ATIVO = 1
                ORDER BY ITEM.ORDEM, ITEM.ID_ITEM
            """,
            parametros=(str(cpf), str(cpf)),
            one=False,
        ) or []
        return {
            "saldo_coins": int(saldo.get("saldo_coins") or 0),
            "xp_total": int(perfil.get("xp_total") or 0),
            "itens": itens,
        }

    def comprar_visual_aurora(self, cpf, codigo_item):
        """Compra um visual e debita a carteira oficial do Album.

        Saldo, extrato e inventario sao alterados na mesma transacao. O XP e
        apenas lido como requisito e nunca sofre debito.
        """
        transaction = self.db.begin_transaction()
        try:
            item = transaction.execute_fetch(
                query="""
                    SELECT TOP 1
                        ID_ITEM AS id,
                        CODIGO AS codigo,
                        NOME AS nome,
                        PRECO_COINS AS preco_coins,
                        XP_NECESSARIO AS xp_necessario
                    FROM dbo.TB_ARENA_AURORA_ITEM WITH (UPDLOCK, ROWLOCK)
                    WHERE CODIGO = ?
                      AND ATIVO = 1
                """,
                parametros=(str(codigo_item),),
                one=True,
            )
            if not item:
                raise ValueError("ITEM_NAO_ENCONTRADO")

            adquirido = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 1 AS adquirido
                    FROM dbo.TB_ARENA_AURORA_INVENTARIO
                        WITH (UPDLOCK, HOLDLOCK)
                    WHERE CPF_COLABORADOR = ?
                      AND ID_ITEM = ?
                """,
                parametros=(str(cpf), int(item["id"])),
                one=True,
            )
            if adquirido:
                raise ValueError("ITEM_JA_ADQUIRIDO")

            perfil = transaction.execute_fetch(
                query="""
                    SELECT ISNULL(XP_TOTAL, 0) AS xp_total
                    FROM dbo.TB_ARENA_PERFIL WITH (NOLOCK)
                    WHERE CPF_COLABORADOR = ?
                """,
                parametros=(str(cpf),),
                one=True,
            ) or {}
            xp_total = int(perfil.get("xp_total") or 0)
            if xp_total < int(item.get("xp_necessario") or 0):
                raise ValueError("XP_INSUFICIENTE")

            saldo = transaction.execute_fetch(
                query="""
                    SELECT ISNULL(QTD_SALDO_ATUAL, 0) AS saldo_coins
                    FROM album.TB_ALBUM_AURORA_COIN_SALDO
                        WITH (UPDLOCK, HOLDLOCK)
                    WHERE ID_USUARIO = ?
                """,
                parametros=(str(cpf),),
                one=True,
            ) or {}
            preco = int(item.get("preco_coins") or 0)
            if int(saldo.get("saldo_coins") or 0) < preco:
                raise ValueError("COINS_INSUFICIENTES")

            movimento = None
            if preco > 0:
                atualizado = transaction.execute_commit(
                    query="""
                        UPDATE album.TB_ALBUM_AURORA_COIN_SALDO
                        SET
                            QTD_SALDO_ATUAL = QTD_SALDO_ATUAL - ?,
                            DT_ATUALIZACAO = GETDATE()
                        WHERE ID_USUARIO = ?
                          AND QTD_SALDO_ATUAL >= ?
                    """,
                    parametros=(preco, str(cpf), preco),
                    return_rowcount=True,
                )
                if atualizado != 1:
                    raise ValueError("COINS_INSUFICIENTES")

                movimento = transaction.execute_insert_returning(
                    query="""
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
                        OUTPUT inserted.ID_MOVIMENTACAO_AURORA AS id
                        VALUES (
                            NEWID(), ?, 'GASTO', 'ARENA_AURORA_VISUAL',
                            ?, ?, ?, GETDATE()
                        )
                    """,
                    parametros=(
                        str(cpf),
                        f"arena-aurora-item:{int(item['id'])}",
                        -preco,
                        f"Visual da Aurora: {item['nome']}",
                    ),
                )

            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_AURORA_INVENTARIO (
                        CPF_COLABORADOR,
                        ID_ITEM,
                        PRECO_PAGO_COINS,
                        ID_MOVIMENTACAO_AURORA,
                        DT_AQUISICAO
                    )
                    VALUES (?, ?, ?, ?, GETDATE())
                """,
                parametros=(
                    str(cpf),
                    int(item["id"]),
                    preco,
                    movimento.get("id") if movimento else None,
                ),
            )
            transaction.commit()
            return int(item["id"])
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def equipar_visual_aurora(self, cpf, slot, codigo_item=None):
        transaction = self.db.begin_transaction()
        try:
            if codigo_item is None:
                if str(slot) == "VISUAL":
                    transaction.execute_commit(
                        query="""
                            DELETE FROM dbo.TB_ARENA_AURORA_EQUIPADO
                            WHERE CPF_COLABORADOR = ?
                              AND SLOT IN (
                                  'VISUAL', 'CABECA', 'OCULOS', 'BRINCO',
                                  'MAQUIAGEM', 'SUPERIOR', 'INFERIOR', 'CALCADO'
                              )
                        """,
                        parametros=(str(cpf),),
                    )
                else:
                    transaction.execute_commit(
                        query="""
                            DELETE FROM dbo.TB_ARENA_AURORA_EQUIPADO
                            WHERE CPF_COLABORADOR = ? AND SLOT = ?
                        """,
                        parametros=(str(cpf), str(slot)),
                    )
                transaction.commit()
                return

            item = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 ITEM.ID_ITEM AS id, ITEM.SLOT AS slot
                    FROM dbo.TB_ARENA_AURORA_ITEM ITEM WITH (NOLOCK)
                    INNER JOIN dbo.TB_ARENA_AURORA_INVENTARIO INV
                        WITH (UPDLOCK, HOLDLOCK)
                        ON INV.ID_ITEM = ITEM.ID_ITEM
                       AND INV.CPF_COLABORADOR = ?
                    WHERE ITEM.CODIGO = ?
                      AND ITEM.ATIVO = 1
                """,
                parametros=(str(cpf), str(codigo_item)),
                one=True,
            )
            if not item:
                raise ValueError("ITEM_NAO_ADQUIRIDO")
            slot_item = str(item.get("slot") or "")
            slots_personagem = {
                "VISUAL", "CABECA", "OCULOS", "BRINCO", "MAQUIAGEM",
                "SUPERIOR", "INFERIOR", "CALCADO",
            }
            eh_preset = str(slot) == "VISUAL" and slot_item in slots_personagem
            if not eh_preset and slot_item != str(slot):
                raise ValueError("SLOT_INVALIDO")

            if eh_preset:
                transaction.execute_commit(
                    query="""
                        DELETE FROM dbo.TB_ARENA_AURORA_EQUIPADO
                        WHERE CPF_COLABORADOR = ?
                          AND SLOT IN (
                              'VISUAL', 'CABECA', 'OCULOS', 'BRINCO',
                              'MAQUIAGEM', 'SUPERIOR', 'INFERIOR', 'CALCADO'
                          )
                    """,
                    parametros=(str(cpf),),
                )
            else:
                transaction.execute_commit(
                    query="""
                        DELETE FROM dbo.TB_ARENA_AURORA_EQUIPADO
                        WHERE CPF_COLABORADOR = ? AND SLOT = ?
                    """,
                    parametros=(str(cpf), str(slot)),
                )

            # Antes da migration 021 o item ainda guarda seu slot antigo. A
            # exclusividade ja e de VISUAL; gravar o slot fisico evita quebrar
            # o CHECK legado enquanto a migration nao foi aplicada.
            slot_banco = slot_item if eh_preset else str(slot)
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_AURORA_EQUIPADO (
                        CPF_COLABORADOR, SLOT, ID_ITEM, DT_EQUIPADO
                    ) VALUES (?, ?, ?, GETDATE())
                """,
                parametros=(str(cpf), slot_banco, int(item["id"])),
            )
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def listar_hub_operador(self, cpf):
        query = """
            SELECT TOP 30
                C.ID_CAMPANHA AS id,
                C.TITULO AS titulo,
                C.DESCRICAO AS descricao,
                C.STATUS AS status,
                C.DT_AGENDADA AS data_agendada,
                C.JANELA_ENTRADA_SEGUNDOS AS janela_entrada_segundos,
                T.CODIGO AS tipo_jogo,
                T.NOME AS tipo_jogo_nome,
                T.ICONE AS icone,
                T.COR AS cor,
                P.STATUS AS status_participante,
                P.PONTUACAO AS pontuacao,
                P.CLASSIFICACAO AS classificacao,
                P.XP_CONCEDIDO AS xp_concedido,
                I.ID_CONVITE AS id_convite,
                I.STATUS AS status_convite,
                I.EXPIRA_EM AS convite_expira_em,
                S.ID_SESSAO AS id_sessao,
                S.STATUS AS status_sessao,
                S.LIMITE_ENTRADA_EM AS limite_entrada_em,
                CONVERT(VARCHAR(36), S.CHAVE_SALA) AS chave_sala
            FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
            INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                ON C.ID_CAMPANHA = P.ID_CAMPANHA
            INNER JOIN dbo.TB_ARENA_TIPO_JOGO T WITH (NOLOCK)
                ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
            LEFT JOIN dbo.TB_ARENA_CONVITE I WITH (NOLOCK)
                ON I.ID_PARTICIPANTE = P.ID_PARTICIPANTE
            LEFT JOIN dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                ON S.ID_CAMPANHA = C.ID_CAMPANHA
            WHERE P.CPF_COLABORADOR = ?
              AND P.STATUS <> 'REMOVIDO'
              AND C.STATUS NOT IN ('CANCELADA', 'ARQUIVADA')
            ORDER BY
                CASE C.STATUS
                    WHEN 'EM_ANDAMENTO' THEN 0
                    WHEN 'SALA_ABERTA' THEN 1
                    WHEN 'PUBLICADA' THEN 2
                    ELSE 3
                END,
                ISNULL(C.DT_AGENDADA, C.CREATED_AT) DESC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(str(cpf),),
            one=False,
        ) or []

    def listar_ranking_centros(self, id_temporada, limite):
        query = """
            SELECT TOP (?)
                CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                SUM(XP) AS xp_total,
                COUNT(DISTINCT CPF_COLABORADOR) AS participantes,
                CAST(
                    1.0 * SUM(XP) / NULLIF(COUNT(DISTINCT CPF_COLABORADOR), 0)
                    AS DECIMAL(12, 2)
                ) AS xp_medio
            FROM dbo.TB_ARENA_XP_MOVIMENTACAO WITH (NOLOCK)
            WHERE (
                    (? IS NULL AND ID_TEMPORADA IS NULL)
                    OR ID_TEMPORADA = ?
                  )
            GROUP BY CENTRO_CUSTO_SNAPSHOT
            HAVING SUM(XP) > 0
            ORDER BY xp_total DESC, xp_medio DESC, CENTRO_CUSTO_SNAPSHOT
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(limite, id_temporada, id_temporada),
            one=False,
        ) or []

    def listar_ranking_operadores(self, id_temporada, centro_custo, limite):
        query = """
            SELECT TOP (?)
                M.CPF_COLABORADOR AS cpf,
                MAX(LTRIM(RTRIM(U.NM_COLABORADOR))) AS nome,
                SUM(M.XP) AS xp_total,
                COUNT(DISTINCT M.ID_CAMPANHA) AS campanhas
            FROM dbo.TB_ARENA_XP_MOVIMENTACAO M WITH (NOLOCK)
            LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                ON U.CPF_COLABORADOR = M.CPF_COLABORADOR
            WHERE UPPER(LTRIM(RTRIM(M.CENTRO_CUSTO_SNAPSHOT))) = UPPER(?)
              AND (
                    (? IS NULL AND M.ID_TEMPORADA IS NULL)
                    OR M.ID_TEMPORADA = ?
                  )
            GROUP BY M.CPF_COLABORADOR
            HAVING SUM(M.XP) > 0
            ORDER BY xp_total DESC, nome
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(
                limite,
                centro_custo,
                id_temporada,
                id_temporada,
            ),
            one=False,
        ) or []

    def obter_dashboard_supervisor(self, cpf):
        query = """
            SELECT
                ISNULL((
                    SELECT COUNT(*)
                    FROM dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    WHERE C.CPF_CRIADOR = ?
                      AND C.STATUS IN (
                          'PUBLICADA', 'SALA_ABERTA', 'EM_ANDAMENTO'
                      )
                ), 0) AS campanhas_ativas,
                ISNULL((
                    SELECT COUNT(*)
                    FROM dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    WHERE C.CPF_CRIADOR = ?
                      AND C.STATUS = 'PUBLICADA'
                ), 0) AS salas_agendadas,
                ISNULL((
                    SELECT COUNT(DISTINCT P.CPF_COLABORADOR)
                    FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                        ON C.ID_CAMPANHA = P.ID_CAMPANHA
                    WHERE C.CPF_CRIADOR = ?
                      AND C.STATUS <> 'CANCELADA'
                      AND P.STATUS <> 'REMOVIDO'
                ), 0) AS participantes,
                ISNULL((
                    SELECT SUM(X.XP)
                    FROM dbo.TB_ARENA_XP_MOVIMENTACAO X WITH (NOLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                        ON C.ID_CAMPANHA = X.ID_CAMPANHA
                    WHERE C.CPF_CRIADOR = ?
                      AND C.STATUS <> 'CANCELADA'
                ), 0) AS xp_distribuido
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(str(cpf), str(cpf), str(cpf), str(cpf)),
            one=True,
        ) or {}

    def obter_dashboard_gerencial(self):
        resumo = self.db.execute_fetch(
            query="""
                SELECT
                    (SELECT COUNT(1)
                     FROM dbo.TB_ARENA_CAMPANHA WITH (NOLOCK)
                     WHERE STATUS <> 'CANCELADA') AS campanhas,
                    (SELECT COUNT(1)
                     FROM dbo.TB_ARENA_CAMPANHA WITH (NOLOCK)
                     WHERE STATUS IN ('PUBLICADA', 'SALA_ABERTA', 'EM_ANDAMENTO'))
                        AS campanhas_ativas,
                    (SELECT COUNT(1)
                     FROM dbo.TB_ARENA_CAMPANHA WITH (NOLOCK)
                     WHERE STATUS = 'FINALIZADA') AS finalizadas,
                    (SELECT COUNT(DISTINCT CPF_COLABORADOR)
                     FROM dbo.TB_ARENA_PARTICIPANTE WITH (NOLOCK)
                     WHERE STATUS <> 'REMOVIDO') AS participantes,
                    (SELECT COUNT(1)
                     FROM dbo.TB_ARENA_PARTICIPANTE WITH (NOLOCK)
                     WHERE STATUS <> 'REMOVIDO') AS convites,
                    (SELECT COUNT(1)
                     FROM dbo.TB_ARENA_PARTICIPANTE WITH (NOLOCK)
                     WHERE STATUS IN ('ACEITO', 'NA_SALA', 'JOGANDO', 'FINALIZADO'))
                        AS confirmacoes,
                    (SELECT ISNULL(SUM(XP), 0)
                     FROM dbo.TB_ARENA_XP_MOVIMENTACAO WITH (NOLOCK))
                        AS xp_distribuido
            """,
            parametros=(),
            one=True,
        ) or {}

        centros = self.db.execute_fetch(
            query="""
                SELECT
                    COALESCE(NULLIF(LTRIM(RTRIM(P.CENTRO_CUSTO_SNAPSHOT)), ''),
                             'NAO INFORMADO') AS centro_custo,
                    COUNT(DISTINCT P.ID_CAMPANHA) AS campanhas,
                    COUNT(DISTINCT P.CPF_COLABORADOR) AS participantes,
                    COUNT(1) AS convites,
                    SUM(CASE
                        WHEN P.STATUS IN ('ACEITO', 'NA_SALA', 'JOGANDO', 'FINALIZADO')
                        THEN 1 ELSE 0 END) AS confirmacoes,
                    SUM(CASE WHEN P.STATUS = 'FINALIZADO' THEN 1 ELSE 0 END)
                        AS participacoes_finalizadas,
                    ISNULL((
                        SELECT SUM(X.XP)
                        FROM dbo.TB_ARENA_XP_MOVIMENTACAO X WITH (NOLOCK)
                        WHERE UPPER(LTRIM(RTRIM(X.CENTRO_CUSTO_SNAPSHOT))) =
                              UPPER(LTRIM(RTRIM(P.CENTRO_CUSTO_SNAPSHOT)))
                    ), 0) AS xp
                FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = P.ID_CAMPANHA
                   AND C.STATUS <> 'CANCELADA'
                WHERE P.STATUS <> 'REMOVIDO'
                GROUP BY COALESCE(
                    NULLIF(LTRIM(RTRIM(P.CENTRO_CUSTO_SNAPSHOT)), ''),
                    'NAO INFORMADO'
                ), P.CENTRO_CUSTO_SNAPSHOT
                ORDER BY participantes DESC, xp DESC
            """,
            parametros=(),
            one=False,
        ) or []

        campanhas = self.db.execute_fetch(
            query="""
                SELECT TOP 8
                    C.ID_CAMPANHA AS id,
                    C.TITULO AS titulo,
                    C.STATUS AS status,
                    C.CENTRO_CUSTO AS centro_custo,
                    T.NOME AS tipo_jogo,
                    C.DT_AGENDADA AS data_agendada,
                    COUNT(DISTINCT P.ID_PARTICIPANTE) AS participantes,
                    SUM(CASE
                        WHEN P.STATUS IN ('ACEITO', 'NA_SALA', 'JOGANDO', 'FINALIZADO')
                        THEN 1 ELSE 0 END) AS confirmacoes
                FROM dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_TIPO_JOGO T WITH (NOLOCK)
                    ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                LEFT JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                    ON P.ID_CAMPANHA = C.ID_CAMPANHA
                   AND P.STATUS <> 'REMOVIDO'
                WHERE C.STATUS <> 'CANCELADA'
                GROUP BY C.ID_CAMPANHA, C.TITULO, C.STATUS,
                         C.CENTRO_CUSTO, T.NOME, C.DT_AGENDADA, C.UPDATED_AT
                ORDER BY C.UPDATED_AT DESC, C.ID_CAMPANHA DESC
            """,
            parametros=(),
            one=False,
        ) or []

        return {
            "resumo": resumo,
            "centros": centros,
            "campanhas": campanhas,
        }

    def listar_campanhas_supervisor(self, cpf, incluir_arquivadas=False):
        query = """
            SELECT
                C.ID_CAMPANHA AS id,
                C.TITULO AS titulo,
                C.DESCRICAO AS descricao,
                C.CENTRO_CUSTO AS centro_custo,
                C.STATUS AS status,
                C.DT_AGENDADA AS data_agendada,
                C.JANELA_ENTRADA_SEGUNDOS AS janela_entrada_segundos,
                C.CREATED_AT AS criada_em,
                C.UPDATED_AT AS atualizada_em,
                T.CODIGO AS tipo_jogo,
                T.NOME AS tipo_jogo_nome,
                COUNT(DISTINCT P.ID_PARTICIPANTE) AS participantes,
                SUM(CASE WHEN P.STATUS IN ('ACEITO', 'NA_SALA', 'JOGANDO', 'FINALIZADO')
                    THEN 1 ELSE 0 END) AS confirmados,
                S.ID_SESSAO AS id_sessao,
                S.STATUS AS status_sessao,
                S.LIMITE_ENTRADA_EM AS limite_entrada_em
            FROM dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
            INNER JOIN dbo.TB_ARENA_TIPO_JOGO T WITH (NOLOCK)
                ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
            LEFT JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                ON P.ID_CAMPANHA = C.ID_CAMPANHA
               AND P.STATUS <> 'REMOVIDO'
            LEFT JOIN dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                ON S.ID_CAMPANHA = C.ID_CAMPANHA
            WHERE C.CPF_CRIADOR = ?
              AND (? = 1 OR C.STATUS <> 'ARQUIVADA')
            GROUP BY
                C.ID_CAMPANHA, C.TITULO, C.DESCRICAO, C.CENTRO_CUSTO,
                C.STATUS, C.DT_AGENDADA, C.JANELA_ENTRADA_SEGUNDOS,
                C.CREATED_AT, C.UPDATED_AT, T.CODIGO, T.NOME,
                S.ID_SESSAO, S.STATUS, S.LIMITE_ENTRADA_EM
            ORDER BY C.UPDATED_AT DESC, C.ID_CAMPANHA DESC
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(str(cpf), 1 if incluir_arquivadas else 0),
            one=False,
        ) or []

    def criar_campanha(
        self,
        *,
        id_temporada,
        id_tipo_jogo,
        titulo,
        descricao,
        centro_custo,
        cpf_criador,
        nome_criador,
        data_agendada,
        configuracao,
    ):
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_insert_returning(
                query="""
                    INSERT INTO dbo.TB_ARENA_CAMPANHA (
                        ID_TEMPORADA,
                        ID_TIPO_JOGO,
                        TITULO,
                        DESCRICAO,
                        CENTRO_CUSTO,
                        CPF_CRIADOR,
                        NOME_CRIADOR,
                        STATUS,
                        DT_AGENDADA,
                        JANELA_ENTRADA_SEGUNDOS,
                        CONFIGURACAO_JSON
                    )
                    OUTPUT
                        INSERTED.ID_CAMPANHA AS id,
                        INSERTED.STATUS AS status,
                        INSERTED.CREATED_AT AS criada_em
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'RASCUNHO', ?, 300, ?)
                """,
                parametros=(
                    id_temporada,
                    id_tipo_jogo,
                    titulo,
                    descricao,
                    centro_custo,
                    str(cpf_criador),
                    nome_criador,
                    data_agendada,
                    json.dumps(configuracao, ensure_ascii=False),
                ),
            )
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA,
                        CPF_ATOR,
                        TIPO,
                        DADOS_JSON
                    )
                    VALUES (?, ?, 'CAMPANHA_CRIADA', ?)
                """,
                parametros=(
                    campanha["id"],
                    str(cpf_criador),
                    json.dumps(
                        {"tipo_jogo_id": id_tipo_jogo},
                        ensure_ascii=False,
                    ),
                ),
            )
            transaction.commit()
            return campanha
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def listar_centros_custo(self):
        query = """
            SELECT DISTINCT LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo
            FROM login.TB_USUARIOS WITH (NOLOCK)
            WHERE ISNULL(USUARIO_ATIVO, 1) = 1
              AND NULLIF(LTRIM(RTRIM(CENTRO_CUSTO)), '') IS NOT NULL
            ORDER BY centro_custo
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(),
            one=False,
        ) or []

    def listar_operadores(self, centro_custo, busca, limite):
        termo = f"%{busca}%"
        query = """
            SELECT TOP (?)
                CAST(CPF_COLABORADOR AS VARCHAR(20)) AS cpf,
                LTRIM(RTRIM(NM_COLABORADOR)) AS nome,
                LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo,
                LTRIM(RTRIM(FUNCAO_COLABORADOR)) AS funcao
            FROM login.TB_USUARIOS WITH (NOLOCK)
            WHERE ISNULL(USUARIO_ATIVO, 1) = 1
              AND (
                    ? = ''
                    OR UPPER(LTRIM(RTRIM(CENTRO_CUSTO))) = UPPER(?)
              )
              AND UPPER(ISNULL(FUNCAO_COLABORADOR, '')) NOT LIKE '%SUPERVISOR%'
              AND (
                    ? = ''
                    OR UPPER(NM_COLABORADOR) LIKE UPPER(?)
                    OR CAST(CPF_COLABORADOR AS VARCHAR(20)) LIKE ?
              )
            ORDER BY NM_COLABORADOR
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(limite, centro_custo, centro_custo, busca, termo, termo),
            one=False,
        ) or []

    def obter_campanha_supervisor(self, id_campanha, cpf):
        query = """
            SELECT TOP 1
                C.ID_CAMPANHA AS id,
                C.TITULO AS titulo,
                C.STATUS AS status,
                C.CENTRO_CUSTO AS centro_custo,
                T.CODIGO AS tipo_jogo
            FROM dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
            INNER JOIN dbo.TB_ARENA_TIPO_JOGO T WITH (NOLOCK)
                ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
            WHERE C.ID_CAMPANHA = ?
              AND C.CPF_CRIADOR = ?
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_campanha, str(cpf)),
            one=True,
        )

    def listar_participantes_campanha(self, id_campanha, cpf_criador):
        query = """
            SELECT
                P.ID_PARTICIPANTE AS id,
                P.CPF_COLABORADOR AS cpf,
                P.NOME_COLABORADOR AS nome,
                P.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                P.ORIGEM_SELECAO AS origem_selecao,
                P.STATUS AS status,
                I.ID_CONVITE AS id_convite,
                I.STATUS AS status_convite,
                I.ENVIADO_EM AS convite_enviado_em,
                I.RESPONDIDO_EM AS convite_respondido_em
            FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
            INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                ON C.ID_CAMPANHA = P.ID_CAMPANHA
            LEFT JOIN dbo.TB_ARENA_CONVITE I WITH (NOLOCK)
                ON I.ID_PARTICIPANTE = P.ID_PARTICIPANTE
            WHERE P.ID_CAMPANHA = ?
              AND C.CPF_CRIADOR = ?
              AND P.STATUS <> 'REMOVIDO'
            ORDER BY P.NOME_COLABORADOR
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(id_campanha, str(cpf_criador)),
            one=False,
        ) or []

    def listar_operadores_por_centros(self, centros_custo):
        if not centros_custo:
            return []
        placeholders = ", ".join("?" for _ in centros_custo)
        query = f"""
            SELECT
                CAST(CPF_COLABORADOR AS VARCHAR(20)) AS cpf,
                LTRIM(RTRIM(NM_COLABORADOR)) AS nome,
                LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo
            FROM login.TB_USUARIOS WITH (NOLOCK)
            WHERE ISNULL(USUARIO_ATIVO, 1) = 1
              AND UPPER(LTRIM(RTRIM(CENTRO_CUSTO))) IN ({placeholders})
              AND UPPER(ISNULL(FUNCAO_COLABORADOR, '')) NOT LIKE '%SUPERVISOR%'
            ORDER BY CENTRO_CUSTO, NM_COLABORADOR
        """
        return self.db.execute_fetch(
            query=query,
            parametros=tuple(centro.upper() for centro in centros_custo),
            one=False,
        ) or []

    def listar_operadores_por_cpfs(self, cpfs):
        if not cpfs:
            return []
        placeholders = ", ".join("?" for _ in cpfs)
        query = f"""
            SELECT
                CAST(CPF_COLABORADOR AS VARCHAR(20)) AS cpf,
                LTRIM(RTRIM(NM_COLABORADOR)) AS nome,
                LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo
            FROM login.TB_USUARIOS WITH (NOLOCK)
            WHERE ISNULL(USUARIO_ATIVO, 1) = 1
              AND CAST(CPF_COLABORADOR AS VARCHAR(20)) IN ({placeholders})
              AND UPPER(ISNULL(FUNCAO_COLABORADOR, '')) NOT LIKE '%SUPERVISOR%'
            ORDER BY NM_COLABORADOR
        """
        return self.db.execute_fetch(
            query=query,
            parametros=tuple(str(cpf) for cpf in cpfs),
            one=False,
        ) or []

    def listar_equipes_supervisor(self, cpf_supervisor):
        return self.db.execute_fetch(
            query="""
                SELECT ID AS id,
                       NOME_SUPERVISOR AS nome_supervisor,
                       CPF_SUPERVISOR AS cpf_supervisor,
                       CARTEIRA_NOME AS carteira_nome,
                       INTEGRANTES AS integrantes_json
                FROM dbo.TB_ARENA_EQUIPES WITH (NOLOCK)
                WHERE CPF_SUPERVISOR = ?
                ORDER BY CARTEIRA_NOME, ID DESC
            """,
            parametros=(str(cpf_supervisor),),
            one=False,
        ) or []

    def salvar_equipe_supervisor(self, cpf, nome, carteira, integrantes):
        integrantes_json = json.dumps(integrantes, ensure_ascii=False)
        transaction = self.db.begin_transaction()
        try:
            equipe = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 ID AS id
                    FROM dbo.TB_ARENA_EQUIPES WITH (UPDLOCK, HOLDLOCK)
                    WHERE CPF_SUPERVISOR = ?
                      AND UPPER(LTRIM(RTRIM(CARTEIRA_NOME))) = UPPER(?)
                    ORDER BY ID DESC
                """,
                parametros=(str(cpf), carteira),
                one=True,
            )
            if equipe:
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_EQUIPES
                        SET NOME_SUPERVISOR = ?, INTEGRANTES = ?
                        WHERE ID = ? AND CPF_SUPERVISOR = ?
                    """,
                    parametros=(nome, integrantes_json, equipe["id"], str(cpf)),
                )
                id_equipe = int(equipe["id"])
            else:
                criada = transaction.execute_insert_returning(
                    query="""
                        INSERT INTO dbo.TB_ARENA_EQUIPES (
                            NOME_SUPERVISOR, CPF_SUPERVISOR,
                            CARTEIRA_NOME, INTEGRANTES
                        )
                        OUTPUT INSERTED.ID AS id
                        VALUES (?, ?, ?, ?)
                    """,
                    parametros=(nome, str(cpf), carteira, integrantes_json),
                )
                id_equipe = int(criada["id"])
            transaction.commit()
            return id_equipe
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def obter_contexto_resultado_campanha(self, id_campanha, cpf_supervisor):
        return self.db.execute_fetch(
            query="""
                SELECT TOP 1
                    C.ID_CAMPANHA AS id_campanha,
                    S.ID_SESSAO AS id_sessao,
                    C.STATUS AS status_campanha,
                    S.STATUS AS status_sessao,
                    C.CPF_CRIADOR AS cpf_supervisor,
                    C.NOME_CRIADOR AS nome_supervisor,
                    U.CENTRO_CUSTO AS carteira_nome
                FROM dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                LEFT JOIN dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                    ON S.ID_CAMPANHA = C.ID_CAMPANHA
                LEFT JOIN login.TB_USUARIOS U WITH (NOLOCK)
                    ON CAST(U.CPF_COLABORADOR AS VARCHAR(20)) = C.CPF_CRIADOR
                WHERE C.ID_CAMPANHA = ? AND C.CPF_CRIADOR = ?
            """,
            parametros=(id_campanha, str(cpf_supervisor)),
            one=True,
        )

    def consultar_resultado_producao(self, id_campanha, inicio_mes, inicio_dia, agora):
        return self.db.execute_fetch(
            query="""
                ;WITH OPERADORES AS (
                    SELECT P.CPF_COLABORADOR, MAX(P.NOME_COLABORADOR) AS nome
                    FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                    WHERE P.ID_CAMPANHA = ? AND P.STATUS <> 'REMOVIDO'
                    GROUP BY P.CPF_COLABORADOR
                ), RESULTADOS AS (
                    SELECT O.CPF_COLABORADOR,
                        COUNT(CASE WHEN A.DATA >= ? AND A.DATA < ? THEN 1 END) acordos_dia,
                        COUNT(CASE WHEN A.DATA >= ? AND A.DATA < ? THEN 1 END) acordos_mes,
                        SUM(CASE WHEN A.DATA >= ? AND A.DATA < ? THEN
                            CASE WHEN A.ID_CEDENTE IN (3,60,71,77)
                                 THEN ISNULL(A.VL_RISCO,0) ELSE ISNULL(A.VL_ENTRADA,0) END
                            ELSE 0 END) valor_fechado_dia,
                        SUM(CASE WHEN A.DATA >= ? AND A.DATA < ? THEN
                            CASE WHEN A.ID_CEDENTE IN (3,60,71,77)
                                 THEN ISNULL(A.VL_RISCO,0) ELSE ISNULL(A.VL_ENTRADA,0) END
                            ELSE 0 END) valor_fechado_mes,
                        SUM(CASE WHEN A.DATA_PAGO >= ? AND A.DATA_PAGO < ? THEN
                            CASE WHEN A.ID_CEDENTE IN (3,60,71,77) AND A.PARCELA_PAGA IS NOT NULL
                                 THEN ISNULL(A.VL_RISCO,0)
                                 WHEN A.ID_CEDENTE NOT IN (3,60,71,77) THEN ISNULL(A.VL_PAGO,0)
                                 ELSE 0 END ELSE 0 END) valor_pago_dia,
                        SUM(CASE WHEN A.DATA_PAGO >= ? AND A.DATA_PAGO < ? THEN
                            CASE WHEN A.ID_CEDENTE IN (3,60,71,77) AND A.PARCELA_PAGA IS NOT NULL
                                 THEN ISNULL(A.VL_RISCO,0)
                                 WHEN A.ID_CEDENTE NOT IN (3,60,71,77) THEN ISNULL(A.VL_PAGO,0)
                                 ELSE 0 END ELSE 0 END) valor_pago_mes,
                        COUNT(CASE WHEN A.DATA_PAGO >= ? AND A.DATA_PAGO < ?
                            AND (ISNULL(A.VL_PAGO,0) > 0 OR
                                 (A.ID_CEDENTE IN (3,60,71,77) AND A.PARCELA_PAGA IS NOT NULL))
                            THEN 1 END) pagamentos_dia,
                        COUNT(CASE WHEN A.DATA_PAGO >= ? AND A.DATA_PAGO < ?
                            AND (ISNULL(A.VL_PAGO,0) > 0 OR
                                 (A.ID_CEDENTE IN (3,60,71,77) AND A.PARCELA_PAGA IS NOT NULL))
                            THEN 1 END) pagamentos_mes
                    FROM OPERADORES O
                    INNER JOIN dbo.INFORMACAO_PAGAMENTOS A WITH (NOLOCK)
                        ON UPPER(LTRIM(RTRIM(A.NM_USUARIO))) = UPPER(LTRIM(RTRIM(O.nome)))
                    WHERE A.NU_PARCELA = 1 AND
                         ((A.DATA >= ? AND A.DATA < ?) OR (A.DATA_PAGO >= ? AND A.DATA_PAGO < ?))
                    GROUP BY O.CPF_COLABORADOR
                ), CONTATOS AS (
                    SELECT O.CPF_COLABORADOR,
                        SUM(TRY_CONVERT(INT,T.CPC)) cpc_dia,
                        SUM(TRY_CONVERT(INT,T.CE)) ce_dia,
                        COUNT(*) acionamentos_dia
                    FROM OPERADORES O
                    INNER JOIN dbo.TB_TABULACOES_HOJE_66 T WITH (NOLOCK)
                        ON UPPER(LTRIM(RTRIM(T.NM_USUARIO))) = UPPER(LTRIM(RTRIM(O.nome)))
                    WHERE T.[DATA] >= ? AND T.[DATA] < ?
                    GROUP BY O.CPF_COLABORADOR
                )
                SELECT COUNT(DISTINCT O.CPF_COLABORADOR) quantidade_operadores,
                    SUM(ISNULL(R.acordos_dia,0)) acordos_dia,
                    SUM(ISNULL(R.acordos_mes,0)) acordos_mes,
                    SUM(ISNULL(R.valor_fechado_dia,0)) valor_fechado_dia,
                    SUM(ISNULL(R.valor_fechado_mes,0)) valor_fechado_mes,
                    SUM(ISNULL(R.valor_pago_dia,0)) valor_pago_dia,
                    SUM(ISNULL(R.valor_pago_mes,0)) valor_pago_mes,
                    SUM(ISNULL(R.pagamentos_dia,0)) pagamentos_dia,
                    SUM(ISNULL(R.pagamentos_mes,0)) pagamentos_mes,
                    SUM(ISNULL(C.cpc_dia,0)) cpc_dia,
                    SUM(ISNULL(C.ce_dia,0)) ce_dia,
                    SUM(ISNULL(C.acionamentos_dia,0)) acionamentos_dia
                FROM OPERADORES O
                LEFT JOIN RESULTADOS R ON R.CPF_COLABORADOR = O.CPF_COLABORADOR
                LEFT JOIN CONTATOS C ON C.CPF_COLABORADOR = O.CPF_COLABORADOR
            """,
            parametros=(
                id_campanha,
                inicio_dia, agora, inicio_mes, agora,
                inicio_dia, agora, inicio_mes, agora,
                inicio_dia, agora, inicio_mes, agora,
                inicio_dia, agora, inicio_mes, agora,
                inicio_mes, agora, inicio_mes, agora,
                inicio_dia, agora,
            ),
            one=True,
        ) or {}

    def listar_snapshots_resultado(self, id_campanha, cpf_supervisor):
        return self.db.execute_fetch(
            query="""
                SELECT S.ID AS id, S.ID_CAMPANHA AS id_campanha,
                       S.ID_SESSAO AS id_sessao, S.TIPO_SNAPSHOT AS tipo_snapshot,
                       S.NUMERO_COLETA AS numero_coleta, S.COLETADO_EM AS coletado_em,
                       S.RESULTADO_JSON AS resultado_json,
                       S.VARIACAO_INICIAL_JSON AS variacao_inicial_json,
                       S.VARIACAO_ANTERIOR_JSON AS variacao_anterior_json
                FROM dbo.TB_ARENA_RESULTADO_SNAPSHOT S WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = S.ID_CAMPANHA
                WHERE S.ID_CAMPANHA = ? AND C.CPF_CRIADOR = ?
                ORDER BY S.NUMERO_COLETA
            """,
            parametros=(id_campanha, str(cpf_supervisor)),
            one=False,
        ) or []

    def inserir_snapshot_resultado(self, contexto, tipo, numero, inicio_mes,
                                   agora, resultado, variacao_inicial,
                                   variacao_anterior):
        return self.db.execute_insert_returning(
            query="""
                INSERT INTO dbo.TB_ARENA_RESULTADO_SNAPSHOT (
                    ID_CAMPANHA, ID_SESSAO, CPF_SUPERVISOR, NOME_SUPERVISOR,
                    CARTEIRA_NOME, TIPO_SNAPSHOT, NUMERO_COLETA,
                    PERIODO_INICIO, PERIODO_FIM, COLETADO_EM,
                    RESULTADO_JSON, VARIACAO_INICIAL_JSON,
                    VARIACAO_ANTERIOR_JSON
                )
                OUTPUT INSERTED.ID AS id
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            parametros=(
                contexto["id_campanha"], contexto.get("id_sessao"),
                contexto["cpf_supervisor"], contexto["nome_supervisor"],
                contexto.get("carteira_nome") or "NAO IDENTIFICADA", tipo, numero,
                inicio_mes, agora, agora,
                json.dumps(resultado, ensure_ascii=False, default=str),
                json.dumps(variacao_inicial, ensure_ascii=False, default=str),
                json.dumps(variacao_anterior, ensure_ascii=False, default=str),
            ),
        )

    def salvar_publico(self, id_campanha, cpf_criador, participantes):
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_fetch(
                query="""
                    SELECT STATUS AS status
                    FROM dbo.TB_ARENA_CAMPANHA WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_CAMPANHA = ? AND CPF_CRIADOR = ?
                """,
                parametros=(id_campanha, str(cpf_criador)),
                one=True,
            )
            if not campanha or campanha["status"] != "RASCUNHO":
                raise ValueError("CAMPANHA_NAO_EDITAVEL")

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_PARTICIPANTE
                    SET STATUS = 'REMOVIDO', UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ? AND STATUS <> 'REMOVIDO'
                """,
                parametros=(id_campanha,),
            )

            for participante in participantes:
                transaction.execute_commit(
                    query="""
                        MERGE dbo.TB_ARENA_PARTICIPANTE AS DESTINO
                        USING (
                            SELECT ? AS ID_CAMPANHA, ? AS CPF_COLABORADOR
                        ) AS ORIGEM
                        ON DESTINO.ID_CAMPANHA = ORIGEM.ID_CAMPANHA
                           AND DESTINO.CPF_COLABORADOR = ORIGEM.CPF_COLABORADOR
                        WHEN MATCHED THEN UPDATE SET
                            NOME_COLABORADOR = ?,
                            CENTRO_CUSTO_SNAPSHOT = ?,
                            ORIGEM_SELECAO = ?,
                            STATUS = 'CONVIDADO',
                            UPDATED_AT = SYSDATETIME()
                        WHEN NOT MATCHED THEN INSERT (
                            ID_CAMPANHA, CPF_COLABORADOR, NOME_COLABORADOR,
                            CENTRO_CUSTO_SNAPSHOT, ORIGEM_SELECAO
                        ) VALUES (?, ?, ?, ?, ?);
                    """,
                    parametros=(
                        id_campanha,
                        participante["cpf"],
                        participante["nome"],
                        participante["centro_custo"],
                        participante["origem_selecao"],
                        id_campanha,
                        participante["cpf"],
                        participante["nome"],
                        participante["centro_custo"],
                        participante["origem_selecao"],
                    ),
                )

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                """,
                parametros=(id_campanha,),
            )
            transaction.commit()
            return len(participantes)
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def publicar_campanha(self, id_campanha, cpf_criador):
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_fetch(
                query="""
                    SELECT
                        C.STATUS AS status,
                        T.CODIGO AS tipo_jogo,
                        Q.STATUS AS status_quiz,
                        B.STATUS AS status_bingo,
                        (
                            SELECT COUNT(*)
                            FROM dbo.TB_ARENA_QUIZ_PERGUNTA P
                            WHERE P.ID_QUIZ_CONFIG = Q.ID_QUIZ_CONFIG
                              AND P.ATIVA = 1
                        ) AS perguntas_quiz
                    FROM dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                    LEFT JOIN dbo.TB_ARENA_QUIZ_CONFIG Q
                        ON Q.ID_CAMPANHA = C.ID_CAMPANHA
                    LEFT JOIN dbo.TB_ARENA_BINGO_CONFIG B
                        ON B.ID_CAMPANHA = C.ID_CAMPANHA
                    WHERE C.ID_CAMPANHA = ? AND C.CPF_CRIADOR = ?
                """,
                parametros=(id_campanha, str(cpf_criador)),
                one=True,
            )
            if not campanha:
                raise ValueError("CAMPANHA_NAO_ENCONTRADA")
            if campanha["status"] != "RASCUNHO":
                raise ValueError("CAMPANHA_JA_PUBLICADA")
            if campanha["tipo_jogo"] not in {"QUIZ_AO_VIVO", "BINGO"}:
                raise ValueError("JOGO_NAO_IMPLEMENTADO")
            if campanha["tipo_jogo"] == "QUIZ_AO_VIVO" and (
                campanha.get("status_quiz") != "PRONTO"
                or int(campanha.get("perguntas_quiz") or 0) < 2
            ):
                raise ValueError("QUIZ_INCOMPLETO")
            if (
                campanha["tipo_jogo"] == "BINGO"
                and campanha.get("status_bingo") != "PRONTO"
            ):
                raise ValueError("BINGO_INCOMPLETO")

            resumo = transaction.execute_fetch(
                query="""
                    SELECT COUNT(*) AS quantidade
                    FROM dbo.TB_ARENA_PARTICIPANTE WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_CAMPANHA = ? AND STATUS = 'CONVIDADO'
                """,
                parametros=(id_campanha,),
                one=True,
            )
            quantidade = int((resumo or {}).get("quantidade") or 0)
            if quantidade == 0:
                raise ValueError("PUBLICO_VAZIO")

            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_CONVITE (ID_PARTICIPANTE)
                    SELECT P.ID_PARTICIPANTE
                    FROM dbo.TB_ARENA_PARTICIPANTE P
                    WHERE P.ID_CAMPANHA = ?
                      AND P.STATUS = 'CONVIDADO'
                      AND NOT EXISTS (
                          SELECT 1 FROM dbo.TB_ARENA_CONVITE I
                          WHERE I.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                      )
                """,
                parametros=(id_campanha,),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET STATUS = 'PUBLICADA',
                        PUBLICADA_EM = SYSDATETIME(),
                        UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                """,
                parametros=(id_campanha,),
            )
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, 'CAMPANHA_PUBLICADA', ?)
                """,
                parametros=(
                    id_campanha,
                    str(cpf_criador),
                    json.dumps({"convites": quantidade}),
                ),
            )
            transaction.commit()
            return quantidade
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def responder_convite(self, id_convite, cpf, resposta):
        transaction = self.db.begin_transaction()
        try:
            convite = transaction.execute_fetch(
                query="""
                    SELECT
                        I.ID_CONVITE AS id,
                        I.STATUS AS status,
                        P.ID_PARTICIPANTE AS id_participante,
                        C.ID_CAMPANHA AS id_campanha,
                        C.TITULO AS titulo
                    FROM dbo.TB_ARENA_CONVITE I WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_PARTICIPANTE P
                        ON P.ID_PARTICIPANTE = I.ID_PARTICIPANTE
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C
                        ON C.ID_CAMPANHA = P.ID_CAMPANHA
                    WHERE I.ID_CONVITE = ?
                      AND P.CPF_COLABORADOR = ?
                      AND C.STATUS IN ('PUBLICADA', 'SALA_ABERTA')
                """,
                parametros=(id_convite, str(cpf)),
                one=True,
            )
            if not convite:
                raise ValueError("CONVITE_NAO_ENCONTRADO")
            if convite["status"] != "PENDENTE":
                raise ValueError("CONVITE_JA_RESPONDIDO")

            status_participante = (
                "ACEITO" if resposta == "ACEITO" else "RECUSADO"
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CONVITE
                    SET STATUS = ?, RESPONDIDO_EM = SYSDATETIME()
                    WHERE ID_CONVITE = ?
                """,
                parametros=(resposta, id_convite),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_PARTICIPANTE
                    SET STATUS = ?, UPDATED_AT = SYSDATETIME()
                    WHERE ID_PARTICIPANTE = ?
                """,
                parametros=(status_participante, convite["id_participante"]),
            )
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, 'CONVITE_RESPONDIDO', ?)
                """,
                parametros=(
                    convite["id_campanha"],
                    str(cpf),
                    json.dumps({"resposta": resposta}),
                ),
            )
            transaction.commit()
            return {
                "id_convite": convite["id"],
                "id_campanha": convite["id_campanha"],
                "titulo": convite["titulo"],
                "status": resposta,
            }
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def abrir_sala(self, id_campanha, cpf_criador):
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_fetch(
                query="""
                    SELECT STATUS AS status
                    FROM dbo.TB_ARENA_CAMPANHA WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_CAMPANHA = ? AND CPF_CRIADOR = ?
                """,
                parametros=(id_campanha, str(cpf_criador)),
                one=True,
            )
            if not campanha:
                raise ValueError("CAMPANHA_NAO_ENCONTRADA")

            # Ignora sessoes canceladas: uma sala fechada pelo supervisor nao
            # pode ser devolvida aqui, senao reabrir traria de volta a sessao
            # morta (e com o prazo original ja vencido).
            sessao = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 ID_SESSAO AS id
                    FROM dbo.TB_ARENA_SESSAO WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_CAMPANHA = ? AND STATUS <> 'CANCELADA'
                    ORDER BY ID_SESSAO DESC
                """,
                parametros=(id_campanha,),
                one=True,
            )
            if sessao:
                transaction.commit()
                return sessao["id"]
            if campanha["status"] != "PUBLICADA":
                raise ValueError("CAMPANHA_NAO_PUBLICADA")

            sessao = transaction.execute_insert_returning(
                query="""
                    INSERT INTO dbo.TB_ARENA_SESSAO (
                        ID_CAMPANHA, LIMITE_ENTRADA_EM
                    )
                    OUTPUT INSERTED.ID_SESSAO AS id
                    VALUES (?, DATEADD(SECOND, 300, SYSDATETIME()))
                """,
                parametros=(id_campanha,),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET STATUS = 'SALA_ABERTA', UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                """,
                parametros=(id_campanha,),
            )
            transaction.execute_commit(
                query="""
                    UPDATE I
                    SET EXPIRA_EM = S.LIMITE_ENTRADA_EM
                    FROM dbo.TB_ARENA_CONVITE I
                    INNER JOIN dbo.TB_ARENA_PARTICIPANTE P
                        ON P.ID_PARTICIPANTE = I.ID_PARTICIPANTE
                    INNER JOIN dbo.TB_ARENA_SESSAO S
                        ON S.ID_CAMPANHA = P.ID_CAMPANHA
                    WHERE P.ID_CAMPANHA = ? AND I.STATUS = 'PENDENTE'
                """,
                parametros=(id_campanha,),
            )
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO
                    ) VALUES (?, ?, ?, 'SALA_ABERTA')
                """,
                parametros=(id_campanha, sessao["id"], str(cpf_criador)),
            )
            transaction.commit()
            return sessao["id"]
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def listar_sessoes_ativas(self):
        """Tudo que esta acontecendo agora, sem filtrar por criador.

        As demais consultas do painel sao escopadas por CPF_CRIADOR — esta e a
        unica visao do conjunto, e por isso vive separada.
        """
        return self.db.execute_fetch(
            query="""
                SELECT
                    S.ID_SESSAO AS id,
                    S.ID_CAMPANHA AS id_campanha,
                    S.STATUS AS status,
                    S.ABERTA_EM AS aberta_em,
                    S.LIMITE_ENTRADA_EM AS limite_entrada_em,
                    S.INICIADA_EM AS iniciada_em,
                    C.TITULO AS titulo,
                    C.CENTRO_CUSTO AS centro_custo,
                    C.CPF_CRIADOR AS cpf_supervisor,
                    C.NOME_CRIADOR AS nome_supervisor,
                    T.CODIGO AS tipo_jogo,
                    T.NOME AS tipo_jogo_nome,
                    (SELECT COUNT(1) FROM dbo.TB_ARENA_PARTICIPANTE P
                      WHERE P.ID_CAMPANHA = C.ID_CAMPANHA
                        AND P.STATUS IN ('NA_SALA', 'JOGANDO')) AS na_sala,
                    (SELECT COUNT(1) FROM dbo.TB_ARENA_PARTICIPANTE P
                      WHERE P.ID_CAMPANHA = C.ID_CAMPANHA
                        AND P.STATUS <> 'REMOVIDO') AS convidados,
                    (SELECT COUNT(1) FROM dbo.TB_ARENA_BINGO_SORTEIO X
                      WHERE X.ID_SESSAO = S.ID_SESSAO) AS total_sorteios,
                    SYSDATETIME() AS servidor_agora
                FROM dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = S.ID_CAMPANHA
                INNER JOIN dbo.TB_ARENA_TIPO_JOGO T WITH (NOLOCK)
                    ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                WHERE S.STATUS IN ('AGUARDANDO', 'EM_ANDAMENTO')
                ORDER BY
                    CASE S.STATUS WHEN 'EM_ANDAMENTO' THEN 0 ELSE 1 END,
                    S.ABERTA_EM DESC
            """,
            parametros=(),
            one=False,
        ) or []

    def listar_cartelas_sessao(self, id_sessao):
        """Todas as cartelas da sessao, com as casas de cada uma.

        O estado do jogo devolve so a cartela de quem pergunta; o observador
        nao tem cartela nenhuma, entao precisa desta.
        """
        linhas = self.db.execute_fetch(
            query="""
                SELECT
                    BC.ID_CARTELA AS id_cartela,
                    P.ID_PARTICIPANTE AS id_participante,
                    P.NOME_COLABORADOR AS nome,
                    P.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                    P.STATUS AS status_participante,
                    X.COLUNA AS coluna,
                    X.LINHA AS linha,
                    X.NUMERO AS numero,
                    X.LIVRE AS livre,
                    X.MARCADA AS marcada
                FROM dbo.TB_ARENA_BINGO_CARTELA BC WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                    ON P.ID_PARTICIPANTE = BC.ID_PARTICIPANTE
                INNER JOIN dbo.TB_ARENA_BINGO_CARTELA_CASA X WITH (NOLOCK)
                    ON X.ID_CARTELA = BC.ID_CARTELA
                WHERE BC.ID_SESSAO = ?
                ORDER BY P.NOME_COLABORADOR, X.LINHA,
                         CHARINDEX(X.COLUNA, 'BINGO')
            """,
            parametros=(id_sessao,),
            one=False,
        ) or []

        cartelas = {}
        for linha in linhas:
            chave = linha["id_cartela"]
            if chave not in cartelas:
                cartelas[chave] = {
                    "id_cartela": chave,
                    "id_participante": linha["id_participante"],
                    "nome": linha["nome"],
                    "centro_custo": linha["centro_custo"],
                    "status_participante": linha["status_participante"],
                    "casas": [],
                }
            cartelas[chave]["casas"].append({
                "coluna": linha["coluna"],
                "linha": linha["linha"],
                "numero": linha["numero"],
                "livre": bool(linha["livre"]),
                "marcada": bool(linha["marcada"]),
            })
        return list(cartelas.values())

    def assumir_controle(self, id_sessao, cpf, nome):
        """Passa a campanha para quem pediu.

        Mesmo `UPDATE ... SET CPF_CRIADOR` de `transferir_bingo`, mas sem
        exigir que o requisitante ja seja o dono nem que tenha funcao de
        supervisor — quem valida isso e o service, por centro de custo.

        Trocar o dono, em vez de abrir excecao nas 12 consultas escopadas por
        CPF_CRIADOR, mantem o controle explicito e auditavel: ninguem conduz o
        jogo alheio em silencio.
        """
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status,
                           C.CPF_CRIADOR AS cpf_criador,
                           C.NOME_CRIADOR AS nome_criador
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ?
                """,
                parametros=(id_sessao,),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] not in ("AGUARDANDO", "EM_ANDAMENTO"):
                raise ValueError("SESSAO_NAO_ATIVA")
            if str(sessao["cpf_criador"]) == str(cpf):
                raise ValueError("JA_E_O_DONO")

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET CPF_CRIADOR = ?, NOME_CRIADOR = ?,
                        UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?;
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO = VERSAO_ESTADO + 1 WHERE ID_SESSAO = ?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, ?, 'CONTROLE_ASSUMIDO', ?);
                """,
                parametros=(
                    str(cpf), nome, sessao["id_campanha"], id_sessao,
                    sessao["id_campanha"], id_sessao, str(cpf),
                    json.dumps({
                        "de": str(sessao["cpf_criador"]),
                        "nome_anterior": sessao["nome_criador"],
                        "para": str(cpf),
                        "nome_novo": nome,
                    }),
                ),
            )
            transaction.commit()
            return {
                "id_campanha": sessao["id_campanha"],
                "supervisor_anterior": sessao["nome_criador"],
            }
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def obter_acesso_sessao(self, id_sessao, cpf, observador=False):
        """Quem pode ver esta sessão: criador, participante ou observador.

        `observador` chega já validado pelo service (por centro de custo) —
        aqui ele apenas dispensa a exigência de vínculo com a campanha.
        """
        query = """
            SELECT TOP 1
                S.ID_SESSAO AS id,
                S.ID_CAMPANHA AS id_campanha,
                S.STATUS AS status,
                C.CPF_CRIADOR AS cpf_criador,
                P.ID_PARTICIPANTE AS id_participante,
                P.STATUS AS status_participante,
                CASE WHEN S.STATUS = 'AGUARDANDO'
                           AND SYSDATETIME() >= S.LIMITE_ENTRADA_EM
                     THEN 1 ELSE 0 END AS pode_iniciar,
                CASE WHEN C.CPF_CRIADOR = ? THEN 1 ELSE 0 END AS supervisor,
                CASE WHEN C.CPF_CRIADOR = ? OR P.ID_PARTICIPANTE IS NOT NULL
                     THEN 0 ELSE 1 END AS observador
            FROM dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
            INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                ON C.ID_CAMPANHA = S.ID_CAMPANHA
            LEFT JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                ON P.ID_CAMPANHA = C.ID_CAMPANHA
               AND P.CPF_COLABORADOR = ?
               AND P.STATUS IN ('ACEITO', 'NA_SALA', 'JOGANDO', 'FINALIZADO')
            WHERE S.ID_SESSAO = ?
              AND (? = 1 OR C.CPF_CRIADOR = ? OR P.ID_PARTICIPANTE IS NOT NULL)
        """
        return self.db.execute_fetch(
            query=query,
            parametros=(
                str(cpf), str(cpf), str(cpf), id_sessao,
                1 if observador else 0, str(cpf),
            ),
            one=True,
        )

    def obter_estado_sessao(self, id_sessao):
        sessao = self.db.execute_fetch(
            query="""
                SELECT
                    S.ID_SESSAO AS id,
                    S.ID_CAMPANHA AS id_campanha,
                    C.TITULO AS titulo,
                    T.CODIGO AS tipo_jogo,
                    C.STATUS AS status_campanha,
                    S.STATUS AS status,
                    S.ABERTA_EM AS aberta_em,
                    S.LIMITE_ENTRADA_EM AS limite_entrada_em,
                    S.INICIADA_EM AS iniciada_em,
                    S.FINALIZADA_EM AS finalizada_em,
                    S.VERSAO_ESTADO AS versao,
                    CONVERT(VARCHAR(36), S.CHAVE_SALA) AS chave_sala,
                    SYSDATETIME() AS servidor_agora,
                    CASE WHEN S.STATUS = 'AGUARDANDO'
                              AND SYSDATETIME() <= S.LIMITE_ENTRADA_EM
                         THEN 1 ELSE 0 END AS entrada_aberta
                FROM dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = S.ID_CAMPANHA
                INNER JOIN dbo.TB_ARENA_TIPO_JOGO T WITH (NOLOCK)
                    ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                WHERE S.ID_SESSAO = ?
            """,
            parametros=(id_sessao,),
            one=True,
        )
        if not sessao:
            return None
        filtro_equipado = (
            "ITEM.FILTRO_COR"
            if self._visual_expandido_disponivel()
            else "CAST(NULL AS NVARCHAR(120))"
        )
        participantes = self.db.execute_fetch(
            query=f"""
                SELECT
                    P.ID_PARTICIPANTE AS id,
                    P.CPF_COLABORADOR AS cpf,
                    P.NOME_COLABORADOR AS nome,
                    P.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                    P.STATUS AS status,
                    CASE
                        WHEN SP.STATUS_CONEXAO = 'CONECTADO'
                         AND DATEDIFF(SECOND, SP.ULTIMO_HEARTBEAT_EM, SYSDATETIME()) > 70
                        THEN 'DESCONECTADO'
                        ELSE SP.STATUS_CONEXAO
                    END AS status_conexao,
                    SP.ENTROU_EM AS entrou_em,
                    SP.ULTIMO_HEARTBEAT_EM AS ultimo_heartbeat_em,
                    SP.RECONEXOES AS reconexoes,
                    -- O visual vestido vira JSON aqui para nao multiplicar as
                    -- linhas de participante por peca equipada.
                    (
                        SELECT ITEM.SLOT AS slot,
                               ITEM.CHAVE_VISUAL AS chave,
                               {filtro_equipado} AS filtro,
                               EQ.DT_EQUIPADO AS equipado_em
                        FROM dbo.TB_ARENA_AURORA_EQUIPADO EQ WITH (NOLOCK)
                        INNER JOIN dbo.TB_ARENA_AURORA_ITEM ITEM WITH (NOLOCK)
                            ON ITEM.ID_ITEM = EQ.ID_ITEM
                        WHERE EQ.CPF_COLABORADOR = P.CPF_COLABORADOR
                        ORDER BY EQ.DT_EQUIPADO DESC, EQ.ID_ITEM DESC
                        FOR JSON PATH
                    ) AS visual_json
                FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                    ON S.ID_CAMPANHA = P.ID_CAMPANHA
                LEFT JOIN dbo.TB_ARENA_SESSAO_PARTICIPANTE SP WITH (NOLOCK)
                    ON SP.ID_SESSAO = S.ID_SESSAO
                   AND SP.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                WHERE S.ID_SESSAO = ?
                  AND P.STATUS <> 'REMOVIDO'
                ORDER BY
                    CASE P.STATUS WHEN 'NA_SALA' THEN 0 WHEN 'ACEITO' THEN 1 ELSE 2 END,
                    P.NOME_COLABORADOR
            """,
            parametros=(id_sessao,),
            one=False,
        ) or []
        return {**sessao, "participantes": participantes}

    def entrar_sala(self, id_sessao, cpf):
        transaction = self.db.begin_transaction()
        try:
            acesso = transaction.execute_fetch(
                query="""
                    SELECT
                        S.ID_CAMPANHA AS id_campanha,
                        S.STATUS AS status_sessao,
                        S.LIMITE_ENTRADA_EM AS limite_entrada_em,
                        P.ID_PARTICIPANTE AS id_participante,
                        P.STATUS AS status_participante
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (UPDLOCK, ROWLOCK)
                        ON P.ID_CAMPANHA = S.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ? AND P.CPF_COLABORADOR = ?
                """,
                parametros=(id_sessao, str(cpf)),
                one=True,
            )
            if not acesso:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if acesso["status_participante"] not in {"ACEITO", "NA_SALA"}:
                raise ValueError("CONVITE_NAO_ACEITO")
            prazo = transaction.execute_fetch(
                query="""
                    SELECT CASE WHEN SYSDATETIME() <= ? THEN 1 ELSE 0 END AS aberto
                """,
                parametros=(acesso["limite_entrada_em"],),
                one=True,
            )
            if acesso["status_sessao"] != "AGUARDANDO" or not prazo["aberto"]:
                raise ValueError("JANELA_ENCERRADA")

            transaction.execute_commit(
                query="""
                    MERGE dbo.TB_ARENA_SESSAO_PARTICIPANTE AS DESTINO
                    USING (SELECT ? AS ID_SESSAO, ? AS ID_PARTICIPANTE) AS ORIGEM
                    ON DESTINO.ID_SESSAO = ORIGEM.ID_SESSAO
                       AND DESTINO.ID_PARTICIPANTE = ORIGEM.ID_PARTICIPANTE
                    WHEN MATCHED THEN UPDATE SET
                        STATUS_CONEXAO = 'CONECTADO',
                        ULTIMO_HEARTBEAT_EM = SYSDATETIME(),
                        SAIU_EM = NULL,
                        RECONEXOES = DESTINO.RECONEXOES + 1
                    WHEN NOT MATCHED THEN INSERT (
                        ID_SESSAO, ID_PARTICIPANTE, STATUS_CONEXAO,
                        ENTROU_EM, ULTIMO_HEARTBEAT_EM
                    ) VALUES (?, ?, 'CONECTADO', SYSDATETIME(), SYSDATETIME());
                """,
                parametros=(
                    id_sessao,
                    acesso["id_participante"],
                    id_sessao,
                    acesso["id_participante"],
                ),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_PARTICIPANTE
                    SET STATUS = 'NA_SALA', UPDATED_AT = SYSDATETIME()
                    WHERE ID_PARTICIPANTE = ?
                """,
                parametros=(acesso["id_participante"],),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO = VERSAO_ESTADO + 1
                    WHERE ID_SESSAO = ?
                """,
                parametros=(id_sessao,),
            )
            transaction.commit()
            return acesso["id_campanha"]
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def atualizar_conexao_sessao(self, id_sessao, cpf, conectado):
        query = """
            UPDATE SP
            SET STATUS_CONEXAO = ?,
                ULTIMO_HEARTBEAT_EM = SYSDATETIME(),
                SAIU_EM = CASE WHEN ? = 0 THEN SYSDATETIME() ELSE NULL END
            FROM dbo.TB_ARENA_SESSAO_PARTICIPANTE SP
            INNER JOIN dbo.TB_ARENA_PARTICIPANTE P
                ON P.ID_PARTICIPANTE = SP.ID_PARTICIPANTE
            WHERE SP.ID_SESSAO = ? AND P.CPF_COLABORADOR = ?
        """
        return self.db.execute_commit(
            query=query,
            parametros=(
                "CONECTADO" if conectado else "DESCONECTADO",
                1 if conectado else 0,
                id_sessao,
                str(cpf),
            ),
            return_rowcount=True,
        )

    def iniciar_sessao(self, id_sessao, cpf_criador):
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT
                        S.ID_CAMPANHA AS id_campanha,
                        S.STATUS AS status,
                        S.LIMITE_ENTRADA_EM AS limite_entrada_em,
                        T.CODIGO AS tipo_jogo,
                        B.STATUS AS status_bingo,
                        B.CASA_LIVRE AS casa_livre
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                    LEFT JOIN dbo.TB_ARENA_BINGO_CONFIG B
                        ON B.ID_CAMPANHA = C.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ? AND C.CPF_CRIADOR = ?
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "AGUARDANDO":
                raise ValueError("SESSAO_JA_INICIADA")

            # O prazo de 5 minutos deixou de travar o inicio: o supervisor pode
            # comecar assim que a sala estiver formada. No lugar dele entra a
            # unica guarda que ainda faz sentido — comecar sem ninguem dentro
            # nao e intencao, e engano (clique errado, sala que ninguem entrou).
            presentes = transaction.execute_fetch(
                query="""
                    SELECT COUNT(1) AS total
                    FROM dbo.TB_ARENA_PARTICIPANTE WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_CAMPANHA = ? AND STATUS IN ('NA_SALA', 'JOGANDO')
                """,
                parametros=(sessao["id_campanha"],),
                one=True,
            )
            if not presentes or not presentes["total"]:
                raise ValueError("SALA_VAZIA")

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET STATUS = 'EM_ANDAMENTO', INICIADA_EM = SYSDATETIME(),
                        VERSAO_ESTADO = VERSAO_ESTADO + 1
                    WHERE ID_SESSAO = ?
                """,
                parametros=(id_sessao,),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET STATUS = 'EM_ANDAMENTO', UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                """,
                parametros=(sessao["id_campanha"],),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_PARTICIPANTE
                    SET STATUS = CASE WHEN STATUS = 'NA_SALA' THEN 'JOGANDO' ELSE 'AUSENTE' END,
                        UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                      AND STATUS IN ('CONVIDADO', 'ACEITO', 'NA_SALA')
                """,
                parametros=(sessao["id_campanha"],),
            )
            transaction.execute_commit(
                query="""
                    UPDATE I SET STATUS = 'EXPIRADO'
                    FROM dbo.TB_ARENA_CONVITE I
                    INNER JOIN dbo.TB_ARENA_PARTICIPANTE P
                        ON P.ID_PARTICIPANTE = I.ID_PARTICIPANTE
                    WHERE P.ID_CAMPANHA = ? AND I.STATUS = 'PENDENTE'
                """,
                parametros=(sessao["id_campanha"],),
            )
            if sessao["tipo_jogo"] == "QUIZ_AO_VIVO":
                transaction.execute_commit(
                    query="""
                    INSERT INTO dbo.TB_ARENA_QUIZ_RODADA (
                        ID_SESSAO, ID_PERGUNTA, ORDEM
                    )
                    SELECT
                        ?, P.ID_PERGUNTA,
                        ROW_NUMBER() OVER (
                            ORDER BY
                                CASE WHEN Q.EMBARALHAR_PERGUNTAS = 1
                                     THEN CHECKSUM(NEWID()) END,
                                P.ORDEM
                        )
                    FROM dbo.TB_ARENA_QUIZ_CONFIG Q
                    INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA P
                        ON P.ID_QUIZ_CONFIG = Q.ID_QUIZ_CONFIG
                       AND P.ATIVA = 1
                    WHERE Q.ID_CAMPANHA = ?
                      AND NOT EXISTS (
                          SELECT 1
                          FROM dbo.TB_ARENA_QUIZ_RODADA R
                          WHERE R.ID_SESSAO = ?
                      )
                    """,
                    parametros=(id_sessao, sessao["id_campanha"], id_sessao),
                )
                primeira_rodada = transaction.execute_fetch(
                    query="""
                    SELECT TOP 1 R.ID_RODADA AS id
                    FROM dbo.TB_ARENA_QUIZ_RODADA R WITH (UPDLOCK, ROWLOCK)
                    WHERE R.ID_SESSAO = ? AND R.STATUS = 'AGUARDANDO'
                    ORDER BY R.ORDEM
                    """,
                    parametros=(id_sessao,),
                    one=True,
                )
                if not primeira_rodada:
                    raise ValueError("QUIZ_SEM_PERGUNTAS")
                transaction.execute_commit(
                    query="""
                    UPDATE R
                    SET STATUS = 'ABERTA',
                        INICIADA_EM = SYSDATETIME(),
                        ENCERRA_EM = DATEADD(
                            SECOND,
                            ISNULL(P.TEMPO_SEGUNDOS, Q.TEMPO_PERGUNTA_SEGUNDOS),
                            SYSDATETIME()
                        )
                    FROM dbo.TB_ARENA_QUIZ_RODADA R
                    INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA P
                        ON P.ID_PERGUNTA = R.ID_PERGUNTA
                    INNER JOIN dbo.TB_ARENA_QUIZ_CONFIG Q
                        ON Q.ID_QUIZ_CONFIG = P.ID_QUIZ_CONFIG
                    WHERE R.ID_RODADA = ?
                    """,
                    parametros=(primeira_rodada["id"],),
                )
            elif sessao["tipo_jogo"] == "BINGO":
                if sessao.get("status_bingo") != "PRONTO":
                    raise ValueError("BINGO_NAO_CONFIGURADO")
                transaction.execute_commit(
                    query="""
                        INSERT INTO dbo.TB_ARENA_BINGO_CARTELA (
                            ID_SESSAO, ID_PARTICIPANTE
                        )
                        SELECT ?, P.ID_PARTICIPANTE
                        FROM dbo.TB_ARENA_PARTICIPANTE P
                        WHERE P.ID_CAMPANHA = ? AND P.STATUS = 'JOGANDO'
                          AND NOT EXISTS (
                              SELECT 1 FROM dbo.TB_ARENA_BINGO_CARTELA C
                              WHERE C.ID_SESSAO = ?
                                AND C.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                          )
                    """,
                    parametros=(id_sessao, sessao["id_campanha"], id_sessao),
                )
                transaction.execute_commit(
                    query="""
                        ;WITH DIGITOS AS (
                            SELECT numero FROM (VALUES
                                (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
                                (11),(12),(13),(14),(15)
                            ) V(numero)
                        ), COLUNAS AS (
                            SELECT letra, inicio FROM (VALUES
                                ('B', 0), ('I', 15), ('N', 30),
                                ('G', 45), ('O', 60)
                            ) V(letra, inicio)
                        ), OPCOES AS (
                            SELECT C.ID_CARTELA AS id_cartela, X.letra,
                                   X.inicio + D.numero AS numero,
                                   ROW_NUMBER() OVER (
                                       PARTITION BY C.ID_CARTELA, X.letra
                                       ORDER BY NEWID()
                                   ) AS posicao
                            FROM dbo.TB_ARENA_BINGO_CARTELA C
                            CROSS JOIN COLUNAS X
                            CROSS JOIN DIGITOS D
                            WHERE C.ID_SESSAO = ?
                        )
                        INSERT INTO dbo.TB_ARENA_BINGO_CARTELA_CASA (
                            ID_CARTELA, COLUNA, LINHA, NUMERO, LIVRE, MARCADA
                        )
                        SELECT O.id_cartela, O.letra,
                               CASE WHEN ? = 1 AND O.letra = 'N'
                                    THEN CASE O.posicao
                                         WHEN 1 THEN 1 WHEN 2 THEN 2
                                         WHEN 3 THEN 4 WHEN 4 THEN 5 END
                                    ELSE O.posicao END,
                               O.numero, 0, 0
                        FROM OPCOES O
                        WHERE (
                                ? = 1 AND O.letra = 'N' AND O.posicao <= 4
                              ) OR (
                                NOT (? = 1 AND O.letra = 'N') AND O.posicao <= 5
                              );

                        INSERT INTO dbo.TB_ARENA_BINGO_CARTELA_CASA (
                            ID_CARTELA, COLUNA, LINHA, NUMERO, LIVRE, MARCADA,
                            MARCADA_EM
                        )
                        SELECT C.ID_CARTELA, 'N', 3, NULL, 1, 1, SYSDATETIME()
                        FROM dbo.TB_ARENA_BINGO_CARTELA C
                        WHERE C.ID_SESSAO = ? AND ? = 1
                          AND NOT EXISTS (
                              SELECT 1 FROM dbo.TB_ARENA_BINGO_CARTELA_CASA X
                              WHERE X.ID_CARTELA = C.ID_CARTELA
                                AND X.COLUNA = 'N' AND X.LINHA = 3
                          )
                    """,
                    parametros=(
                        id_sessao,
                        1 if sessao.get("casa_livre") else 0,
                        1 if sessao.get("casa_livre") else 0,
                        1 if sessao.get("casa_livre") else 0,
                        id_sessao,
                        1 if sessao.get("casa_livre") else 0,
                    ),
                )
            else:
                raise ValueError("TIPO_JOGO_INVALIDO")
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO
                    ) VALUES (?, ?, ?, 'SESSAO_INICIADA')
                """,
                parametros=(
                    sessao["id_campanha"],
                    id_sessao,
                    str(cpf_criador),
                ),
            )
            transaction.commit()
            return sessao["id_campanha"]
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def adicionar_participantes(self, id_sessao, cpf_criador, participantes):
        """Inclui gente numa sala que ja esta em espera.

        Diferente de `salvar_publico`, que zera todo mundo antes de reinserir:
        aqui a operacao e aditiva. Quem ja esta ACEITO ou NA_SALA nao e tocado —
        derrubar o status de quem ja entrou seria o pior efeito colateral
        possivel em cima de uma sala montada.
        """
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ? AND C.CPF_CRIADOR = ?
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "AGUARDANDO":
                raise ValueError("SESSAO_JA_INICIADA")

            incluidos = 0
            for participante in participantes:
                transaction.execute_commit(
                    query="""
                        MERGE dbo.TB_ARENA_PARTICIPANTE AS DESTINO
                        USING (
                            SELECT ? AS ID_CAMPANHA, ? AS CPF_COLABORADOR
                        ) AS ORIGEM
                        ON DESTINO.ID_CAMPANHA = ORIGEM.ID_CAMPANHA
                           AND DESTINO.CPF_COLABORADOR = ORIGEM.CPF_COLABORADOR
                        WHEN MATCHED AND DESTINO.STATUS IN ('REMOVIDO', 'AUSENTE')
                            THEN UPDATE SET
                                NOME_COLABORADOR = ?,
                                CENTRO_CUSTO_SNAPSHOT = ?,
                                ORIGEM_SELECAO = ?,
                                STATUS = 'CONVIDADO',
                                UPDATED_AT = SYSDATETIME()
                        WHEN NOT MATCHED THEN INSERT (
                            ID_CAMPANHA, CPF_COLABORADOR, NOME_COLABORADOR,
                            CENTRO_CUSTO_SNAPSHOT, ORIGEM_SELECAO
                        ) VALUES (?, ?, ?, ?, ?);
                    """,
                    parametros=(
                        sessao["id_campanha"],
                        participante["cpf"],
                        participante["nome"],
                        participante["centro_custo"],
                        participante["origem_selecao"],
                        sessao["id_campanha"],
                        participante["cpf"],
                        participante["nome"],
                        participante["centro_custo"],
                        participante["origem_selecao"],
                    ),
                )
                incluidos += 1

            # Convite pendente para quem ficou CONVIDADO e ainda nao tem um.
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_CONVITE (ID_PARTICIPANTE, STATUS)
                    SELECT P.ID_PARTICIPANTE, 'PENDENTE'
                    FROM dbo.TB_ARENA_PARTICIPANTE P
                    WHERE P.ID_CAMPANHA = ? AND P.STATUS = 'CONVIDADO'
                      AND NOT EXISTS (
                          SELECT 1 FROM dbo.TB_ARENA_CONVITE I
                          WHERE I.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                            AND I.STATUS = 'PENDENTE'
                      )
                """,
                parametros=(sessao["id_campanha"],),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO = VERSAO_ESTADO + 1
                    WHERE ID_SESSAO = ?
                """,
                parametros=(id_sessao,),
            )
            transaction.commit()
            return incluidos
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def fechar_sala(self, id_sessao, cpf_criador):
        """Desiste da partida e devolve a campanha para PUBLICADA.

        A campanha nao e cancelada: o supervisor costuma so estar adiando, e
        obrigar a remontar o jogo inteiro para reabrir amanha seria punir o uso
        normal. A sessao vira CANCELADA e `abrir_sala` passa a ignora-la,
        criando uma nova com prazo cheio.
        """
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ? AND C.CPF_CRIADOR = ?
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "AGUARDANDO":
                raise ValueError("SESSAO_JA_INICIADA")

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET STATUS = 'CANCELADA',
                        FINALIZADA_EM = SYSDATETIME(),
                        VERSAO_ESTADO = VERSAO_ESTADO + 1
                    WHERE ID_SESSAO = ?
                """,
                parametros=(id_sessao,),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET STATUS = 'PUBLICADA', UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                """,
                parametros=(sessao["id_campanha"],),
            )
            # Quem entrou volta a ser so convidado, para a proxima abertura
            # encontrar a sala limpa em vez de gente "presente" numa sessao
            # que nao existe mais.
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_PARTICIPANTE
                    SET STATUS = 'CONVIDADO', UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ? AND STATUS IN ('ACEITO', 'NA_SALA')
                """,
                parametros=(sessao["id_campanha"],),
            )
            transaction.commit()
            return sessao["id_campanha"]
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    # Campanha em jogo nao pode sumir da tela de ninguem no meio.
    STATUS_NAO_ARQUIVAVEIS = ("SALA_ABERTA", "EM_ANDAMENTO")

    def arquivar_campanha(self, id_campanha, cpf_criador):
        """Tira a campanha das listas sem apagar nada.

        Guarda o status anterior para o desarquivamento devolver a campanha ao
        estado real, em vez de assumir que tudo que se arquiva estava
        finalizado.
        """
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_fetch(
                query="""
                    SELECT STATUS AS status
                    FROM dbo.TB_ARENA_CAMPANHA WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_CAMPANHA = ? AND CPF_CRIADOR = ?
                """,
                parametros=(id_campanha, str(cpf_criador)),
                one=True,
            )
            if not campanha:
                raise ValueError("CAMPANHA_NAO_ENCONTRADA")
            if campanha["status"] == "ARQUIVADA":
                raise ValueError("CAMPANHA_JA_ARQUIVADA")
            if campanha["status"] in self.STATUS_NAO_ARQUIVAVEIS:
                raise ValueError("CAMPANHA_EM_JOGO")

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET STATUS_ANTES_ARQUIVO = STATUS,
                        STATUS = 'ARQUIVADA',
                        UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                """,
                parametros=(id_campanha,),
            )
            transaction.commit()
            return campanha["status"]
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def desarquivar_campanha(self, id_campanha, cpf_criador):
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_fetch(
                query="""
                    SELECT STATUS AS status,
                           STATUS_ANTES_ARQUIVO AS status_anterior
                    FROM dbo.TB_ARENA_CAMPANHA WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_CAMPANHA = ? AND CPF_CRIADOR = ?
                """,
                parametros=(id_campanha, str(cpf_criador)),
                one=True,
            )
            if not campanha:
                raise ValueError("CAMPANHA_NAO_ENCONTRADA")
            if campanha["status"] != "ARQUIVADA":
                raise ValueError("CAMPANHA_NAO_ARQUIVADA")

            # FINALIZADA como rede: campanha arquivada antes desta migration
            # nao tem status anterior guardado.
            destino = campanha["status_anterior"] or "FINALIZADA"
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET STATUS = ?,
                        STATUS_ANTES_ARQUIVO = NULL,
                        UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?
                """,
                parametros=(destino, id_campanha),
            )
            transaction.commit()
            return destino
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def obter_estado_quiz(self, id_sessao, cpf, observador=False):
        cabecalho = self.db.execute_fetch(
            query="""
                SELECT
                    S.ID_SESSAO AS id_sessao,
                    S.ID_CAMPANHA AS id_campanha,
                    S.STATUS AS status_sessao,
                    C.TITULO AS titulo,
                    C.CPF_CRIADOR AS cpf_criador,
                    CASE WHEN C.CPF_CRIADOR = ? THEN 'SUPERVISOR'
                         ELSE 'OPERADOR' END AS papel,
                    P.ID_PARTICIPANTE AS id_participante,
                    ISNULL((
                        SELECT SUM(X.PONTOS)
                        FROM dbo.TB_ARENA_QUIZ_RESPOSTA X WITH (NOLOCK)
                        INNER JOIN dbo.TB_ARENA_QUIZ_RODADA R WITH (NOLOCK)
                            ON R.ID_RODADA = X.ID_RODADA
                        WHERE R.ID_SESSAO = S.ID_SESSAO
                          AND X.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                    ), 0) AS pontuacao,
                    P.CLASSIFICACAO AS classificacao,
                    P.XP_CONCEDIDO AS xp_concedido,
                    Q.EMBARALHAR_ALTERNATIVAS AS embaralhar_alternativas,
                    (SELECT COUNT(*) FROM dbo.TB_ARENA_QUIZ_RODADA RT
                     WHERE RT.ID_SESSAO = S.ID_SESSAO) AS total_rodadas,
                    SYSDATETIME() AS servidor_agora
                FROM dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = S.ID_CAMPANHA
                INNER JOIN dbo.TB_ARENA_QUIZ_CONFIG Q WITH (NOLOCK)
                    ON Q.ID_CAMPANHA = C.ID_CAMPANHA
                LEFT JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                    ON P.ID_CAMPANHA = C.ID_CAMPANHA
                   AND P.CPF_COLABORADOR = ?
                WHERE S.ID_SESSAO = ?
                  AND (? = 1 OR C.CPF_CRIADOR = ? OR P.ID_PARTICIPANTE IS NOT NULL)
            """,
            parametros=(
                str(cpf), str(cpf), id_sessao,
                1 if observador else 0, str(cpf),
            ),
            one=True,
        )
        if not cabecalho:
            return None

        rodada = self.db.execute_fetch(
            query="""
                SELECT TOP 1
                    R.ID_RODADA AS id,
                    R.ORDEM AS ordem,
                    R.STATUS AS status,
                    R.INICIADA_EM AS iniciada_em,
                    R.ENCERRA_EM AS encerra_em,
                    R.ENCERRADA_EM AS encerrada_em,
                    P.ID_PERGUNTA AS id_pergunta,
                    P.ENUNCIADO AS enunciado,
                    CASE WHEN R.STATUS = 'ENCERRADA' THEN P.EXPLICACAO END
                        AS explicacao,
                    (SELECT COUNT(*) FROM dbo.TB_ARENA_QUIZ_RESPOSTA X
                     WHERE X.ID_RODADA = R.ID_RODADA) AS respostas_recebidas,
                    (SELECT COUNT(*) FROM dbo.TB_ARENA_PARTICIPANTE PA
                     INNER JOIN dbo.TB_ARENA_SESSAO SS
                        ON SS.ID_CAMPANHA = PA.ID_CAMPANHA
                     WHERE SS.ID_SESSAO = R.ID_SESSAO
                       AND PA.STATUS IN ('JOGANDO', 'FINALIZADO'))
                        AS total_participantes
                FROM dbo.TB_ARENA_QUIZ_RODADA R WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA P WITH (NOLOCK)
                    ON P.ID_PERGUNTA = R.ID_PERGUNTA
                WHERE R.ID_SESSAO = ?
                  AND R.STATUS IN ('ABERTA', 'ENCERRADA')
                ORDER BY CASE WHEN R.STATUS = 'ABERTA' THEN 0 ELSE 1 END,
                         R.ORDEM DESC
            """,
            parametros=(id_sessao,),
            one=True,
        )

        if rodada:
            alternativas = self.db.execute_fetch(
                query="""
                    SELECT
                        A.ID_ALTERNATIVA AS id,
                        A.TEXTO AS texto,
                        CASE WHEN R.STATUS = 'ENCERRADA' THEN A.CORRETA END
                            AS correta,
                        A.ORDEM AS ordem
                    FROM dbo.TB_ARENA_QUIZ_ALTERNATIVA A WITH (NOLOCK)
                    INNER JOIN dbo.TB_ARENA_QUIZ_RODADA R WITH (NOLOCK)
                        ON R.ID_PERGUNTA = A.ID_PERGUNTA
                    INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA P WITH (NOLOCK)
                        ON P.ID_PERGUNTA = A.ID_PERGUNTA
                    INNER JOIN dbo.TB_ARENA_QUIZ_CONFIG Q WITH (NOLOCK)
                        ON Q.ID_QUIZ_CONFIG = P.ID_QUIZ_CONFIG
                    WHERE R.ID_RODADA = ?
                    ORDER BY
                        CASE WHEN Q.EMBARALHAR_ALTERNATIVAS = 1
                             THEN CHECKSUM(CONCAT(?, '-', A.ID_ALTERNATIVA)) END,
                        A.ORDEM
                """,
                parametros=(rodada["id"], id_sessao),
                one=False,
            ) or []
            resposta = None
            if cabecalho.get("id_participante"):
                resposta = self.db.execute_fetch(
                    query="""
                        SELECT
                            X.ID_ALTERNATIVA AS id_alternativa,
                            CASE WHEN R.STATUS = 'ENCERRADA' THEN X.CORRETA END
                                AS correta,
                            CASE WHEN R.STATUS = 'ENCERRADA' THEN X.PONTOS END
                                AS pontos,
                            X.RESPONDIDA_EM AS respondida_em
                        FROM dbo.TB_ARENA_QUIZ_RESPOSTA X WITH (NOLOCK)
                        INNER JOIN dbo.TB_ARENA_QUIZ_RODADA R WITH (NOLOCK)
                            ON R.ID_RODADA = X.ID_RODADA
                        WHERE X.ID_RODADA = ? AND X.ID_PARTICIPANTE = ?
                    """,
                    parametros=(rodada["id"], cabecalho["id_participante"]),
                    one=True,
                )
            rodada = {**rodada, "alternativas": alternativas, "resposta": resposta}

        placar = self.db.execute_fetch(
            query="""
                SELECT
                    P.ID_PARTICIPANTE AS id_participante,
                    P.NOME_COLABORADOR AS nome,
                    P.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                    ISNULL(SUM(X.PONTOS), 0) AS pontos,
                    SUM(CASE WHEN X.CORRETA = 1 THEN 1 ELSE 0 END) AS acertos,
                    P.CLASSIFICACAO AS classificacao,
                    P.XP_CONCEDIDO AS xp
                FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                    ON S.ID_CAMPANHA = P.ID_CAMPANHA
                LEFT JOIN dbo.TB_ARENA_QUIZ_RODADA R WITH (NOLOCK)
                    ON R.ID_SESSAO = S.ID_SESSAO
                LEFT JOIN dbo.TB_ARENA_QUIZ_RESPOSTA X WITH (NOLOCK)
                    ON X.ID_RODADA = R.ID_RODADA
                   AND X.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                WHERE S.ID_SESSAO = ?
                  AND P.STATUS IN ('JOGANDO', 'FINALIZADO')
                GROUP BY P.ID_PARTICIPANTE, P.NOME_COLABORADOR,
                         P.CENTRO_CUSTO_SNAPSHOT, P.CLASSIFICACAO,
                         P.XP_CONCEDIDO
                ORDER BY pontos DESC, acertos DESC, P.NOME_COLABORADOR
            """,
            parametros=(id_sessao,),
            one=False,
        ) or []
        return {**cabecalho, "rodada": rodada, "placar": placar}

    def responder_quiz(self, id_sessao, cpf, id_rodada, id_alternativa):
        transaction = self.db.begin_transaction()
        try:
            contexto = transaction.execute_fetch(
                query="""
                    SELECT
                        R.ID_RODADA AS id_rodada,
                        R.STATUS AS status_rodada,
                        R.INICIADA_EM AS iniciada_em,
                        R.ENCERRA_EM AS encerra_em,
                        P.ID_PARTICIPANTE AS id_participante,
                        P.STATUS AS status_participante,
                        Q.PONTOS_ACERTO AS pontos_acerto,
                        Q.BONUS_VELOCIDADE_MAX AS bonus_max,
                        DATEDIFF_BIG(MILLISECOND, R.INICIADA_EM, SYSDATETIME())
                            AS tempo_ms,
                        DATEDIFF_BIG(MILLISECOND, R.INICIADA_EM, R.ENCERRA_EM)
                            AS duracao_ms
                    FROM dbo.TB_ARENA_QUIZ_RODADA R WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                        ON S.ID_SESSAO = R.ID_SESSAO
                    INNER JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (UPDLOCK, ROWLOCK)
                        ON P.ID_CAMPANHA = S.ID_CAMPANHA
                       AND P.CPF_COLABORADOR = ?
                    INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA PG
                        ON PG.ID_PERGUNTA = R.ID_PERGUNTA
                    INNER JOIN dbo.TB_ARENA_QUIZ_CONFIG Q
                        ON Q.ID_QUIZ_CONFIG = PG.ID_QUIZ_CONFIG
                    WHERE R.ID_SESSAO = ? AND R.ID_RODADA = ?
                """,
                parametros=(str(cpf), id_sessao, id_rodada),
                one=True,
            )
            if not contexto or contexto["status_participante"] != "JOGANDO":
                raise ValueError("PARTICIPANTE_INVALIDO")
            if contexto["status_rodada"] != "ABERTA":
                raise ValueError("RODADA_ENCERRADA")
            prazo = transaction.execute_fetch(
                query="SELECT CASE WHEN SYSDATETIME() <= ? THEN 1 ELSE 0 END AS valido",
                parametros=(contexto["encerra_em"],),
                one=True,
            )
            if not prazo["valido"]:
                raise ValueError("TEMPO_ESGOTADO")
            existente = transaction.execute_fetch(
                query="""
                    SELECT ID_RESPOSTA AS id
                    FROM dbo.TB_ARENA_QUIZ_RESPOSTA WITH (UPDLOCK, HOLDLOCK)
                    WHERE ID_RODADA = ? AND ID_PARTICIPANTE = ?
                """,
                parametros=(id_rodada, contexto["id_participante"]),
                one=True,
            )
            if existente:
                raise ValueError("RESPOSTA_JA_REGISTRADA")
            alternativa = transaction.execute_fetch(
                query="""
                    SELECT A.CORRETA AS correta
                    FROM dbo.TB_ARENA_QUIZ_ALTERNATIVA A
                    INNER JOIN dbo.TB_ARENA_QUIZ_RODADA R
                        ON R.ID_PERGUNTA = A.ID_PERGUNTA
                    WHERE R.ID_RODADA = ? AND A.ID_ALTERNATIVA = ?
                """,
                parametros=(id_rodada, id_alternativa),
                one=True,
            )
            if not alternativa:
                raise ValueError("ALTERNATIVA_INVALIDA")
            tempo_ms = max(0, min(int(contexto["tempo_ms"]), int(contexto["duracao_ms"])))
            correta = bool(alternativa["correta"])
            bonus = 0
            if correta and contexto["duracao_ms"]:
                bonus = int(
                    int(contexto["bonus_max"])
                    * (int(contexto["duracao_ms"]) - tempo_ms)
                    / int(contexto["duracao_ms"])
                )
            pontos = int(contexto["pontos_acerto"]) + bonus if correta else 0
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_QUIZ_RESPOSTA (
                        ID_RODADA, ID_PARTICIPANTE, ID_ALTERNATIVA,
                        CORRETA, TEMPO_RESPOSTA_MS, PONTOS
                    ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                parametros=(id_rodada, contexto["id_participante"], id_alternativa,
                            correta, tempo_ms, pontos),
            )
            transaction.commit()
            return {"id_rodada": id_rodada, "registrada": True}
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def processar_fluxo_quiz(self, id_sessao):
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT
                        S.ID_CAMPANHA AS id_campanha,
                        S.STATUS AS status,
                        C.CPF_CRIADOR AS cpf_criador
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ?
                """,
                parametros=(id_sessao,),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] == "FINALIZADA":
                transaction.commit()
                return {"acao": "FINALIZADA", "aguardar_segundos": None}
            if sessao["status"] != "EM_ANDAMENTO":
                transaction.commit()
                return {"acao": "AGUARDANDO_SESSAO", "aguardar_segundos": 1}

            aberta = transaction.execute_fetch(
                query="""
                    SELECT TOP 1
                        ID_RODADA AS id, ENCERRA_EM AS encerra_em,
                        DATEDIFF(MILLISECOND, SYSDATETIME(), ENCERRA_EM)
                            AS restante_ms
                    FROM dbo.TB_ARENA_QUIZ_RODADA WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_SESSAO = ? AND STATUS = 'ABERTA'
                    ORDER BY ORDEM
                """,
                parametros=(id_sessao,),
                one=True,
            )
            if aberta and int(aberta["restante_ms"] or 0) > 0:
                transaction.commit()
                return {
                    "acao": "PERGUNTA_ABERTA",
                    "aguardar_segundos": max(0.1, int(aberta["restante_ms"]) / 1000),
                }
            if aberta:
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_QUIZ_RODADA
                        SET STATUS = 'ENCERRADA', ENCERRADA_EM = SYSDATETIME()
                        WHERE ID_RODADA = ? AND STATUS = 'ABERTA'
                    """,
                    parametros=(aberta["id"],),
                )
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_SESSAO
                        SET VERSAO_ESTADO = VERSAO_ESTADO + 1
                        WHERE ID_SESSAO = ?
                    """,
                    parametros=(id_sessao,),
                )
                transaction.commit()
                return {"acao": "RODADA_ENCERRADA", "aguardar_segundos": 4}

            ultima = transaction.execute_fetch(
                query="""
                    SELECT TOP 1
                        ID_RODADA AS id, ORDEM AS ordem,
                        DATEDIFF(MILLISECOND, SYSDATETIME(),
                                 DATEADD(SECOND, 4, ENCERRADA_EM)) AS restante_ms
                    FROM dbo.TB_ARENA_QUIZ_RODADA WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_SESSAO = ? AND STATUS = 'ENCERRADA'
                    ORDER BY ORDEM DESC
                """,
                parametros=(id_sessao,),
                one=True,
            )
            if ultima and int(ultima["restante_ms"] or 0) > 0:
                transaction.commit()
                return {
                    "acao": "EXIBINDO_RESULTADO",
                    "aguardar_segundos": max(0.1, int(ultima["restante_ms"]) / 1000),
                }

            proxima = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 R.ID_RODADA AS id
                    FROM dbo.TB_ARENA_QUIZ_RODADA R WITH (UPDLOCK, ROWLOCK)
                    WHERE R.ID_SESSAO = ? AND R.STATUS = 'AGUARDANDO'
                    ORDER BY R.ORDEM
                """,
                parametros=(id_sessao,),
                one=True,
            )
            if proxima:
                transaction.execute_commit(
                    query="""
                        UPDATE R
                        SET STATUS = 'ABERTA', INICIADA_EM = SYSDATETIME(),
                            ENCERRA_EM = DATEADD(
                                SECOND,
                                ISNULL(P.TEMPO_SEGUNDOS, Q.TEMPO_PERGUNTA_SEGUNDOS),
                                SYSDATETIME()
                            )
                        FROM dbo.TB_ARENA_QUIZ_RODADA R
                        INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA P
                            ON P.ID_PERGUNTA = R.ID_PERGUNTA
                        INNER JOIN dbo.TB_ARENA_QUIZ_CONFIG Q
                            ON Q.ID_QUIZ_CONFIG = P.ID_QUIZ_CONFIG
                        WHERE R.ID_RODADA = ? AND R.STATUS = 'AGUARDANDO'
                    """,
                    parametros=(proxima["id"],),
                )
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_SESSAO
                        SET VERSAO_ESTADO = VERSAO_ESTADO + 1
                        WHERE ID_SESSAO = ?
                    """,
                    parametros=(id_sessao,),
                )
                transaction.commit()
                return {"acao": "NOVA_RODADA", "aguardar_segundos": 0.1}

            classificados = transaction.execute_fetch(
                query="""
                    WITH PLACAR AS (
                        SELECT
                            P.ID_PARTICIPANTE AS id_participante,
                            P.CPF_COLABORADOR AS cpf,
                            P.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                            ISNULL(SUM(X.PONTOS), 0) AS pontos,
                            SUM(CASE WHEN X.CORRETA = 1 THEN 1 ELSE 0 END) AS acertos
                        FROM dbo.TB_ARENA_PARTICIPANTE P
                        LEFT JOIN dbo.TB_ARENA_QUIZ_RODADA R
                            ON R.ID_SESSAO = ?
                        LEFT JOIN dbo.TB_ARENA_QUIZ_RESPOSTA X
                            ON X.ID_RODADA = R.ID_RODADA
                           AND X.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                        WHERE P.ID_CAMPANHA = ? AND P.STATUS = 'JOGANDO'
                        GROUP BY P.ID_PARTICIPANTE, P.CPF_COLABORADOR,
                                 P.CENTRO_CUSTO_SNAPSHOT
                    ), CLASSIFICADO AS (
                        SELECT *, ROW_NUMBER() OVER (
                            ORDER BY pontos DESC, acertos DESC, id_participante
                        ) AS posicao
                        FROM PLACAR
                    )
                    SELECT id_participante, cpf, centro_custo, pontos, acertos,
                           posicao,
                           25 + (acertos * 10) + CASE posicao
                               WHEN 1 THEN 50 WHEN 2 THEN 30 WHEN 3 THEN 20
                               ELSE 0 END AS xp
                    FROM CLASSIFICADO
                """,
                parametros=(id_sessao, sessao["id_campanha"]),
                one=False,
            ) or []
            temporada = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 ID_TEMPORADA AS id
                    FROM dbo.TB_ARENA_TEMPORADA
                    WHERE STATUS = 'ATIVA'
                      AND CAST(GETDATE() AS DATE) BETWEEN DT_INICIO AND DT_FIM
                    ORDER BY DT_INICIO DESC
                """,
                parametros=(),
                one=True,
            )
            for item in classificados:
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_PARTICIPANTE
                        SET PONTUACAO = ?, CLASSIFICACAO = ?, XP_CONCEDIDO = ?,
                            STATUS = 'FINALIZADO', UPDATED_AT = SYSDATETIME()
                        WHERE ID_PARTICIPANTE = ?
                    """,
                    parametros=(item["pontos"], item["posicao"], item["xp"],
                                item["id_participante"]),
                )
                chave = f"ARENA:SESSAO:{id_sessao}:PARTICIPANTE:{item['id_participante']}"
                inserida = transaction.execute_commit(
                    query="""
                        INSERT INTO dbo.TB_ARENA_XP_MOVIMENTACAO (
                            CPF_COLABORADOR, ID_TEMPORADA, ID_CAMPANHA,
                            CENTRO_CUSTO_SNAPSHOT, TIPO, XP, DESCRICAO,
                            CHAVE_IDEMPOTENCIA
                        )
                        SELECT ?, ?, ?, ?, 'PARTICIPACAO', ?,
                               'Resultado final do Quiz ao Vivo', ?
                        WHERE NOT EXISTS (
                            SELECT 1 FROM dbo.TB_ARENA_XP_MOVIMENTACAO
                            WHERE CHAVE_IDEMPOTENCIA = ?
                        )
                    """,
                    parametros=(item["cpf"], temporada.get("id") if temporada else None,
                                sessao["id_campanha"], item["centro_custo"],
                                item["xp"], chave, chave),
                    return_rowcount=True,
                )
                if inserida:
                    transaction.execute_commit(
                        query="""
                            MERGE dbo.TB_ARENA_PERFIL AS D
                            USING (SELECT ? AS CPF_COLABORADOR) AS O
                            ON D.CPF_COLABORADOR = O.CPF_COLABORADOR
                            WHEN MATCHED THEN UPDATE SET
                                XP_TOTAL = D.XP_TOTAL + ?,
                                NIVEL = ((D.XP_TOTAL + ?) / 500) + 1,
                                UPDATED_AT = SYSDATETIME()
                            WHEN NOT MATCHED THEN INSERT (
                                CPF_COLABORADOR, XP_TOTAL, NIVEL
                            ) VALUES (?, ?, (? / 500) + 1);
                        """,
                        parametros=(item["cpf"], item["xp"], item["xp"],
                                    item["cpf"], item["xp"], item["xp"]),
                    )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET STATUS = 'FINALIZADA', FINALIZADA_EM = SYSDATETIME(),
                        VERSAO_ESTADO = VERSAO_ESTADO + 1
                    WHERE ID_SESSAO = ? AND STATUS = 'EM_ANDAMENTO';
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET STATUS = 'FINALIZADA', UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO
                    ) VALUES (?, ?, ?, 'SESSAO_FINALIZADA');
                """,
                parametros=(id_sessao, sessao["id_campanha"],
                            sessao["id_campanha"], id_sessao,
                            sessao["cpf_criador"]),
            )
            transaction.commit()
            return {"acao": "SESSAO_FINALIZADA", "aguardar_segundos": None}
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def obter_bingo_supervisor(self, id_campanha, cpf_criador):
        return self.db.execute_fetch(
            query="""
                SELECT
                    B.ID_BINGO_CONFIG AS id,
                    B.ID_CAMPANHA AS id_campanha,
                    B.PADRAO_VITORIA AS padrao_vitoria,
                    B.CASA_LIVRE AS casa_livre,
                    B.XP_PARTICIPACAO AS xp_participacao,
                    B.XP_VITORIA AS xp_vitoria,
                    B.STATUS AS status
                FROM dbo.TB_ARENA_BINGO_CONFIG B WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = B.ID_CAMPANHA
                WHERE B.ID_CAMPANHA = ? AND C.CPF_CRIADOR = ?
            """,
            parametros=(id_campanha, str(cpf_criador)),
            one=True,
        )

    def salvar_bingo_supervisor(self, id_campanha, cpf_criador, config):
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_fetch(
                query="""
                    SELECT C.STATUS AS status, T.CODIGO AS tipo_jogo
                    FROM dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                    WHERE C.ID_CAMPANHA = ? AND C.CPF_CRIADOR = ?
                """,
                parametros=(id_campanha, str(cpf_criador)),
                one=True,
            )
            if not campanha:
                raise ValueError("CAMPANHA_NAO_ENCONTRADA")
            if campanha["status"] != "RASCUNHO":
                raise ValueError("CAMPANHA_NAO_EDITAVEL")
            if campanha["tipo_jogo"] != "BINGO":
                raise ValueError("TIPO_JOGO_INVALIDO")
            transaction.execute_commit(
                query="""
                    MERGE dbo.TB_ARENA_BINGO_CONFIG AS D
                    USING (SELECT ? AS ID_CAMPANHA) AS O
                    ON D.ID_CAMPANHA = O.ID_CAMPANHA
                    WHEN MATCHED THEN UPDATE SET
                        PADRAO_VITORIA = ?, CASA_LIVRE = ?,
                        XP_PARTICIPACAO = ?, XP_VITORIA = ?,
                        STATUS = 'PRONTO', UPDATED_AT = SYSDATETIME()
                    WHEN NOT MATCHED THEN INSERT (
                        ID_CAMPANHA, PADRAO_VITORIA, CASA_LIVRE,
                        XP_PARTICIPACAO, XP_VITORIA, STATUS
                    ) VALUES (?, ?, ?, ?, ?, 'PRONTO');
                """,
                parametros=(
                    id_campanha,
                    config["padrao_vitoria"],
                    1 if config["casa_livre"] else 0,
                    config["xp_participacao"],
                    config["xp_vitoria"],
                    id_campanha,
                    config["padrao_vitoria"],
                    1 if config["casa_livre"] else 0,
                    config["xp_participacao"],
                    config["xp_vitoria"],
                ),
            )
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def obter_estado_bingo(self, id_sessao, cpf, observador=False):
        estado = self.db.execute_fetch(
            query="""
                SELECT
                    S.ID_SESSAO AS id_sessao,
                    S.ID_CAMPANHA AS id_campanha,
                    S.STATUS AS status_sessao,
                    S.VERSAO_ESTADO AS versao,
                    S.INICIADA_EM AS iniciada_em,
                    S.FINALIZADA_EM AS finalizada_em,
                    C.TITULO AS titulo,
                    CASE WHEN C.CPF_CRIADOR = ? THEN 'SUPERVISOR'
                         ELSE 'OPERADOR' END AS papel,
                    P.ID_PARTICIPANTE AS id_participante,
                    P.PONTUACAO AS pontuacao,
                    P.CLASSIFICACAO AS classificacao,
                    P.XP_CONCEDIDO AS xp_concedido,
                    B.PADRAO_VITORIA AS padrao_vitoria,
                    B.CASA_LIVRE AS casa_livre,
                    B.PAUSADA AS pausada,
                    B.PAUSADA_EM AS pausada_em,
                    B.AGUARDANDO_DECISAO AS aguardando_decisao,
                    B.JANELA_ABERTA_EM AS janela_aberta_em,
                    B.DESEMPATE_EM AS desempate_em,
                    B.ENCERRAMENTO_TIPO AS encerramento_tipo,
                    BC.ID_CARTELA AS id_cartela,
                    SYSDATETIME() AS servidor_agora,
                    (SELECT COUNT(*) FROM dbo.TB_ARENA_BINGO_SORTEIO X
                     WHERE X.ID_SESSAO = S.ID_SESSAO) AS total_sorteios,
                    (SELECT COUNT(*) FROM dbo.TB_ARENA_PARTICIPANTE PP
                     WHERE PP.ID_CAMPANHA = C.ID_CAMPANHA
                       AND PP.STATUS IN ('JOGANDO', 'FINALIZADO')) AS participantes_online
                FROM dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = S.ID_CAMPANHA
                INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B WITH (NOLOCK)
                    ON B.ID_CAMPANHA = C.ID_CAMPANHA
                LEFT JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                    ON P.ID_CAMPANHA = C.ID_CAMPANHA
                   AND P.CPF_COLABORADOR = ?
                LEFT JOIN dbo.TB_ARENA_BINGO_CARTELA BC WITH (NOLOCK)
                    ON BC.ID_SESSAO = S.ID_SESSAO
                   AND BC.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                WHERE S.ID_SESSAO = ?
                  AND (? = 1 OR C.CPF_CRIADOR = ? OR P.ID_PARTICIPANTE IS NOT NULL)
            """,
            parametros=(
                str(cpf), str(cpf), id_sessao,
                1 if observador else 0, str(cpf),
            ),
            one=True,
        )
        if not estado:
            return None
        sorteios = self.db.execute_fetch(
            query="""
                SELECT ID_SORTEIO AS id, NUMERO AS numero, LETRA AS letra,
                       ORDEM AS ordem, SORTEADO_EM AS sorteado_em
                FROM dbo.TB_ARENA_BINGO_SORTEIO WITH (NOLOCK)
                WHERE ID_SESSAO = ? ORDER BY ORDEM DESC
            """,
            parametros=(id_sessao,),
            one=False,
        ) or []
        vitorias = self.db.execute_fetch(
            query="""
                SELECT V.ID_PARTICIPANTE AS id_participante,
                       P.NOME_COLABORADOR AS nome,
                       V.PADRAO AS padrao,
                       V.POSICAO AS posicao,
                       V.PEDRA_DESEMPATE AS pedra_desempate
                FROM dbo.TB_ARENA_BINGO_VITORIA V WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                    ON P.ID_PARTICIPANTE = V.ID_PARTICIPANTE
                WHERE V.ID_SESSAO = ?
                ORDER BY CASE WHEN V.POSICAO IS NULL THEN 1 ELSE 0 END,
                         V.POSICAO, V.RECLAMADA_EM
            """,
            parametros=(id_sessao,),
            one=False,
        ) or []
        casas = []
        if estado.get("id_cartela"):
            casas = self.db.execute_fetch(
                query="""
                    SELECT ID_CARTELA_CASA AS id, COLUNA AS coluna,
                           LINHA AS linha, NUMERO AS numero, LIVRE AS livre,
                           MARCADA AS marcada, MARCADA_EM AS marcada_em
                    FROM dbo.TB_ARENA_BINGO_CARTELA_CASA WITH (NOLOCK)
                    WHERE ID_CARTELA = ?
                    ORDER BY LINHA, CHARINDEX(COLUNA, 'BINGO')
                """,
                parametros=(estado["id_cartela"],),
                one=False,
            ) or []
        progresso = self.db.execute_fetch(
            query="""
                SELECT P.ID_PARTICIPANTE AS id_participante,
                       P.NOME_COLABORADOR AS nome,
                       P.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                       SUM(CASE WHEN X.MARCADA = 1 AND X.LIVRE = 0 THEN 1 ELSE 0 END)
                           AS marcadas,
                       P.CLASSIFICACAO AS classificacao,
                       P.XP_CONCEDIDO AS xp,
                       P.PONTUACAO AS pontos
                FROM dbo.TB_ARENA_PARTICIPANTE P WITH (NOLOCK)
                LEFT JOIN dbo.TB_ARENA_BINGO_CARTELA C WITH (NOLOCK)
                    ON C.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                   AND C.ID_SESSAO = ?
                LEFT JOIN dbo.TB_ARENA_BINGO_CARTELA_CASA X WITH (NOLOCK)
                    ON X.ID_CARTELA = C.ID_CARTELA
                INNER JOIN dbo.TB_ARENA_SESSAO S WITH (NOLOCK)
                    ON S.ID_CAMPANHA = P.ID_CAMPANHA AND S.ID_SESSAO = ?
                WHERE P.STATUS IN ('JOGANDO', 'FINALIZADO')
                GROUP BY P.ID_PARTICIPANTE, P.NOME_COLABORADOR,
                         P.CENTRO_CUSTO_SNAPSHOT, P.CLASSIFICACAO,
                         P.XP_CONCEDIDO, P.PONTUACAO
                ORDER BY ISNULL(P.CLASSIFICACAO, 9999), marcadas DESC,
                         P.NOME_COLABORADOR
            """,
            parametros=(id_sessao, id_sessao),
            one=False,
        ) or []
        casas_participantes = self.db.execute_fetch(
            query="""
                SELECT C.ID_PARTICIPANTE AS id_participante,
                       X.COLUNA AS coluna, X.LINHA AS linha,
                       X.NUMERO AS numero, X.MARCADA AS marcada
                FROM dbo.TB_ARENA_BINGO_CARTELA C WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_BINGO_CARTELA_CASA X WITH (NOLOCK)
                    ON X.ID_CARTELA = C.ID_CARTELA
                WHERE C.ID_SESSAO = ?
            """,
            parametros=(id_sessao,),
            one=False,
        ) or []
        casas_por_participante = {}
        for casa in casas_participantes:
            casas_por_participante.setdefault(casa["id_participante"], []).append(casa)
        for participante in progresso:
            participante.update(self._calcular_proximidade_bingo(
                casas_por_participante.get(participante["id_participante"], []),
                estado["padrao_vitoria"],
            ))
        progresso.sort(key=lambda item: (
            int(item.get("classificacao") or 9999)
            if estado["status_sessao"] == "FINALIZADA"
            else int(
                item["faltam_para_vencer"]
                if item.get("faltam_para_vencer") is not None else 99
            ),
            -int(item.get("marcadas") or 0),
            item.get("nome") or "",
        ))
        return {
            **estado,
            "sorteios": sorteios,
            "cartela": casas,
            "progresso": progresso,
            "vitorias": vitorias,
        }

    def sortear_bingo(self, id_sessao, cpf_criador):
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status,
                           B.PAUSADA AS pausada
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                    INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B
                        ON B.ID_CAMPANHA = C.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ? AND C.CPF_CRIADOR = ?
                      AND T.CODIGO = 'BINGO'
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "EM_ANDAMENTO":
                raise ValueError("SESSAO_NAO_ATIVA")
            if sessao.get("pausada"):
                raise ValueError("BINGO_PAUSADO")
            sorteado = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 N.numero
                    FROM (VALUES
                        (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),
                        (11),(12),(13),(14),(15),(16),(17),(18),(19),(20),
                        (21),(22),(23),(24),(25),(26),(27),(28),(29),(30),
                        (31),(32),(33),(34),(35),(36),(37),(38),(39),(40),
                        (41),(42),(43),(44),(45),(46),(47),(48),(49),(50),
                        (51),(52),(53),(54),(55),(56),(57),(58),(59),(60),
                        (61),(62),(63),(64),(65),(66),(67),(68),(69),(70),
                        (71),(72),(73),(74),(75)
                    ) N(numero)
                    WHERE NOT EXISTS (
                        SELECT 1 FROM dbo.TB_ARENA_BINGO_SORTEIO S
                        WHERE S.ID_SESSAO = ? AND S.NUMERO = N.numero
                    )
                    ORDER BY NEWID()
                """,
                parametros=(id_sessao,),
                one=True,
            )
            if not sorteado:
                raise ValueError("TODOS_NUMEROS_SORTEADOS")
            numero = int(sorteado["numero"])
            letra = "BINGO"[(numero - 1) // 15]
            ordem = transaction.execute_fetch(
                query="""
                    SELECT COUNT(*) + 1 AS ordem
                    FROM dbo.TB_ARENA_BINGO_SORTEIO WITH (UPDLOCK, ROWLOCK)
                    WHERE ID_SESSAO = ?
                """,
                parametros=(id_sessao,),
                one=True,
            )["ordem"]
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_BINGO_SORTEIO (
                        ID_SESSAO, NUMERO, LETRA, ORDEM
                    ) VALUES (?, ?, ?, ?)
                """,
                parametros=(id_sessao, numero, letra, ordem),
            )
            transaction.execute_commit(
                query="""
                    UPDATE X SET MARCADA = 1, MARCADA_EM = SYSDATETIME()
                    FROM dbo.TB_ARENA_BINGO_CARTELA_CASA X
                    INNER JOIN dbo.TB_ARENA_BINGO_CARTELA C
                        ON C.ID_CARTELA = X.ID_CARTELA
                    WHERE C.ID_SESSAO = ? AND X.NUMERO = ? AND X.MARCADA = 0;
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO = VERSAO_ESTADO + 1
                    WHERE ID_SESSAO = ?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, ?, 'BINGO_SORTEIO', ?);
                """,
                parametros=(
                    id_sessao, numero, id_sessao, sessao["id_campanha"],
                    id_sessao, str(cpf_criador),
                    json.dumps({"numero": numero, "letra": letra, "ordem": ordem}),
                ),
            )
            transaction.commit()
            return {"numero": numero, "letra": letra, "ordem": int(ordem)}
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def solicitar_bingo(self, id_sessao, cpf, janela_segundos=3):
        transaction = self.db.begin_transaction()
        try:
            dados = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status_sessao,
                           C.ID_CARTELA AS id_cartela,
                           P.ID_PARTICIPANTE AS id_participante,
                           B.PADRAO_VITORIA AS padrao,
                           B.XP_PARTICIPACAO AS xp_participacao,
                           B.XP_VITORIA AS xp_vitoria,
                           B.PAUSADA AS pausada,
                           B.AGUARDANDO_DECISAO AS aguardando_decisao,
                           B.JANELA_ABERTA_EM AS janela_aberta_em,
                           CASE
                               WHEN B.JANELA_ABERTA_EM IS NOT NULL
                                AND SYSDATETIME() < DATEADD(
                                        SECOND, ?, B.JANELA_ABERTA_EM
                                    )
                               THEN 1 ELSE 0
                           END AS janela_aberta,
                           P.CENTRO_CUSTO_SNAPSHOT AS centro_custo
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_PARTICIPANTE P WITH (UPDLOCK, ROWLOCK)
                        ON P.ID_CAMPANHA = S.ID_CAMPANHA
                       AND P.CPF_COLABORADOR = ?
                    INNER JOIN dbo.TB_ARENA_BINGO_CARTELA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_SESSAO = S.ID_SESSAO
                       AND C.ID_PARTICIPANTE = P.ID_PARTICIPANTE
                    INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B WITH (UPDLOCK, ROWLOCK)
                        ON B.ID_CAMPANHA = S.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ?
                """,
                parametros=(int(janela_segundos), str(cpf), id_sessao),
                one=True,
            )
            if not dados:
                raise ValueError("PARTICIPANTE_INVALIDO")
            if dados["status_sessao"] != "EM_ANDAMENTO":
                raise ValueError("SESSAO_NAO_ATIVA")
            # A janela aberta e justamente o momento em que outros bingos sao
            # bem-vindos — e o que impede o atraso de entrega de decidir o jogo.
            janela_aberta = bool(dados.get("janela_aberta"))
            if dados.get("aguardando_decisao"):
                raise ValueError("BINGO_AGUARDANDO_DECISAO")
            if dados.get("pausada") and not janela_aberta:
                raise ValueError("BINGO_PAUSADO")
            resumo = transaction.execute_fetch(
                query="""
                    WITH PADROES AS (
                        SELECT CONCAT('L', LINHA) AS padrao
                        FROM dbo.TB_ARENA_BINGO_CARTELA_CASA
                        WHERE ID_CARTELA = ? GROUP BY LINHA
                        HAVING COUNT(*) = 5 AND MIN(CAST(MARCADA AS INT)) = 1
                        UNION ALL
                        SELECT CONCAT('C', COLUNA)
                        FROM dbo.TB_ARENA_BINGO_CARTELA_CASA
                        WHERE ID_CARTELA = ? GROUP BY COLUNA
                        HAVING COUNT(*) = 5 AND MIN(CAST(MARCADA AS INT)) = 1
                        UNION ALL
                        SELECT 'D1' WHERE 5 = (
                            SELECT COUNT(*) FROM dbo.TB_ARENA_BINGO_CARTELA_CASA
                            WHERE ID_CARTELA = ? AND MARCADA = 1
                              AND ((COLUNA='B' AND LINHA=1) OR (COLUNA='I' AND LINHA=2)
                                OR (COLUNA='N' AND LINHA=3) OR (COLUNA='G' AND LINHA=4)
                                OR (COLUNA='O' AND LINHA=5))
                        )
                        UNION ALL
                        SELECT 'D2' WHERE 5 = (
                            SELECT COUNT(*) FROM dbo.TB_ARENA_BINGO_CARTELA_CASA
                            WHERE ID_CARTELA = ? AND MARCADA = 1
                              AND ((COLUNA='O' AND LINHA=1) OR (COLUNA='G' AND LINHA=2)
                                OR (COLUNA='N' AND LINHA=3) OR (COLUNA='I' AND LINHA=4)
                                OR (COLUNA='B' AND LINHA=5))
                        )
                    )
                    SELECT (SELECT COUNT(*) FROM PADROES) AS linhas,
                           (SELECT COUNT(*) FROM dbo.TB_ARENA_BINGO_CARTELA_CASA
                            WHERE ID_CARTELA = ? AND MARCADA = 1) AS marcadas,
                           (SELECT COUNT(*) FROM dbo.TB_ARENA_BINGO_CARTELA_CASA
                            WHERE ID_CARTELA = ? AND MARCADA = 1
                              AND ((COLUNA='B' AND LINHA=1) OR (COLUNA='O' AND LINHA=1)
                                OR (COLUNA='B' AND LINHA=5) OR (COLUNA='O' AND LINHA=5)))
                                AS cantos
                """,
                parametros=(
                    dados["id_cartela"], dados["id_cartela"],
                    dados["id_cartela"], dados["id_cartela"],
                    dados["id_cartela"], dados["id_cartela"],
                ),
                one=True,
            )
            valido = {
                "LINHA": int(resumo["linhas"] or 0) >= 1,
                "DUAS_LINHAS": int(resumo["linhas"] or 0) >= 2,
                "QUATRO_CANTOS": int(resumo["cantos"] or 0) == 4,
                "CARTELA_CHEIA": int(resumo["marcadas"] or 0) == 25,
            }.get(dados["padrao"], False)
            if not valido:
                raise ValueError("BINGO_INVALIDO")
            if transaction.execute_fetch(
                query="""
                    SELECT TOP 1 1 AS existe
                    FROM dbo.TB_ARENA_BINGO_VITORIA WITH (UPDLOCK, HOLDLOCK)
                    WHERE ID_SESSAO=? AND ID_PARTICIPANTE=?
                """,
                parametros=(id_sessao, dados["id_participante"]),
                one=True,
            ):
                raise ValueError("BINGO_JA_CONFIRMADO")
            # Sem posicao ainda: quem decide a colocacao e o fechamento da
            # janela — e, havendo empate, o sorteio de desempate. Gravar a
            # ordem de chegada aqui seria trazer de volta a corrida de rede.
            transaction.execute_commit(
                query="""
                    INSERT INTO dbo.TB_ARENA_BINGO_VITORIA (
                        ID_SESSAO, ID_CARTELA, ID_PARTICIPANTE, PADRAO,
                        POSICAO, RECLAMADA_EM
                    ) VALUES (?, ?, ?, ?, NULL, SYSDATETIME())
                """,
                parametros=(
                    id_sessao, dados["id_cartela"], dados["id_participante"],
                    dados["padrao"],
                ),
            )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_BINGO_CONFIG SET PAUSADA=1,
                        PAUSADA_EM=SYSDATETIME(), PAUSADA_POR=?,
                        JANELA_ABERTA_EM=ISNULL(JANELA_ABERTA_EM, SYSDATETIME()),
                        UPDATED_AT=SYSDATETIME()
                        WHERE ID_CAMPANHA=?;
                    UPDATE dbo.TB_ARENA_SESSAO
                        SET VERSAO_ESTADO=VERSAO_ESTADO+1 WHERE ID_SESSAO=?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, ?, 'BINGO_CONFIRMADO', ?);
                """,
                parametros=(
                    str(cpf), dados["id_campanha"], id_sessao,
                    dados["id_campanha"], id_sessao, str(cpf),
                    json.dumps({
                        "id_participante": dados["id_participante"],
                        "padrao": dados["padrao"],
                        "aguardando_desempate": True,
                    }),
                ),
            )
            transaction.commit()
            return {"vitoria": True, "posicao": None}
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def fechar_janela_bingo(self, id_sessao, janela_segundos=3):
        """Encerra a coleta de bingos e entrega a decisão ao supervisor.

        Com um vencedor só, resolve a posição na hora e o jogo segue como
        sempre. Com dois ou mais, deixa a posição em aberto: quem decide é o
        sorteio de desempate, não a ordem de chegada.
        """
        transaction = self.db.begin_transaction()
        try:
            dados = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha,
                           B.JANELA_ABERTA_EM AS janela_aberta_em,
                           B.AGUARDANDO_DECISAO AS aguardando_decisao,
                           CASE
                               WHEN B.JANELA_ABERTA_EM IS NOT NULL
                                AND SYSDATETIME() >= DATEADD(
                                        SECOND, ?, B.JANELA_ABERTA_EM
                                    )
                               THEN 1 ELSE 0
                           END AS janela_vencida
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B WITH (UPDLOCK, ROWLOCK)
                        ON B.ID_CAMPANHA = S.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ?
                """,
                parametros=(int(janela_segundos), id_sessao),
                one=True,
            )
            if not dados or not dados.get("janela_aberta_em"):
                transaction.commit()
                return {"fechada": False, "empatados": 0}
            if dados.get("aguardando_decisao"):
                transaction.commit()
                return {"fechada": True, "empatados": 0}
            if not dados.get("janela_vencida"):
                transaction.commit()
                return {"fechada": False, "empatados": 0}

            pendentes = transaction.execute_fetch(
                query="""
                    SELECT ID_VITORIA AS id
                    FROM dbo.TB_ARENA_BINGO_VITORIA WITH (UPDLOCK, HOLDLOCK)
                    WHERE ID_SESSAO = ? AND POSICAO IS NULL
                    ORDER BY RECLAMADA_EM, ID_VITORIA
                """,
                parametros=(id_sessao,),
                one=False,
            ) or []

            # Vencedor único não passa por desempate: o sorteio existe para
            # separar quem empatou, não como etapa obrigatória.
            if len(pendentes) == 1:
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_BINGO_VITORIA
                        SET POSICAO = (
                            SELECT ISNULL(MAX(POSICAO), 0) + 1
                            FROM dbo.TB_ARENA_BINGO_VITORIA
                            WHERE ID_SESSAO = ? AND POSICAO IS NOT NULL
                        )
                        WHERE ID_VITORIA = ?
                    """,
                    parametros=(id_sessao, pendentes[0]["id"]),
                )

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_BINGO_CONFIG
                    SET AGUARDANDO_DECISAO = 1, UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?;
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO = VERSAO_ESTADO + 1 WHERE ID_SESSAO = ?;
                """,
                parametros=(dados["id_campanha"], id_sessao),
            )
            transaction.commit()
            return {"fechada": True, "empatados": len(pendentes)}
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def sortear_desempate(self, id_sessao, cpf_criador):
        """Tira uma pedra para cada empatado; a maior vence.

        Sorteio **sem reposição, entre os números que ainda não saíram** na
        partida: assim é impossível empatar de novo, e um desempate que empata
        seria a pior versão disto.
        """
        transaction = self.db.begin_transaction()
        try:
            dados = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status,
                           B.DESEMPATE_EM AS desempate_em
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B WITH (UPDLOCK, ROWLOCK)
                        ON B.ID_CAMPANHA = C.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ? AND C.CPF_CRIADOR = ?
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not dados:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if dados.get("desempate_em"):
                raise ValueError("DESEMPATE_JA_SORTEADO")

            empatados = transaction.execute_fetch(
                query="""
                    SELECT V.ID_VITORIA AS id,
                           V.ID_PARTICIPANTE AS id_participante,
                           P.NOME_COLABORADOR AS nome
                    FROM dbo.TB_ARENA_BINGO_VITORIA V WITH (UPDLOCK, HOLDLOCK)
                    INNER JOIN dbo.TB_ARENA_PARTICIPANTE P
                        ON P.ID_PARTICIPANTE = V.ID_PARTICIPANTE
                    WHERE V.ID_SESSAO = ? AND V.POSICAO IS NULL
                    ORDER BY V.RECLAMADA_EM, V.ID_VITORIA
                """,
                parametros=(id_sessao,),
                one=False,
            ) or []
            if len(empatados) < 2:
                raise ValueError("SEM_EMPATE")

            disponiveis = [
                int(row["numero"])
                for row in transaction.execute_fetch(
                    query="""
                        SELECT N.numero
                        FROM (
                            SELECT TOP (75)
                                   ROW_NUMBER() OVER (ORDER BY object_id)
                                       AS numero
                            FROM sys.all_objects
                        ) N
                        WHERE NOT EXISTS (
                            SELECT 1 FROM dbo.TB_ARENA_BINGO_SORTEIO T
                            WHERE T.ID_SESSAO = ? AND T.NUMERO = N.numero
                        )
                    """,
                    parametros=(id_sessao,),
                    one=False,
                ) or []
            ]
            if len(disponiveis) < len(empatados):
                raise ValueError("PEDRAS_INSUFICIENTES")

            pedras = random.sample(disponiveis, len(empatados))
            resultado = []
            for participante, pedra in zip(empatados, pedras):
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_BINGO_VITORIA
                        SET PEDRA_DESEMPATE = ?
                        WHERE ID_VITORIA = ?
                    """,
                    parametros=(pedra, participante["id"]),
                )
                resultado.append({
                    "id_vitoria": participante["id"],
                    "id_participante": participante["id_participante"],
                    "nome": participante["nome"],
                    "pedra": pedra,
                })

            # Maior pedra fica em primeiro, e as posições seguem a partir do
            # que ja existia (rodadas anteriores mantem o pódio).
            base = transaction.execute_fetch(
                query="""
                    SELECT ISNULL(MAX(POSICAO), 0) AS ultima
                    FROM dbo.TB_ARENA_BINGO_VITORIA
                    WHERE ID_SESSAO = ? AND POSICAO IS NOT NULL
                """,
                parametros=(id_sessao,),
                one=True,
            )["ultima"]
            resultado.sort(key=lambda item: item["pedra"], reverse=True)
            for indice, item in enumerate(resultado, start=1):
                item["posicao"] = int(base) + indice
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_BINGO_VITORIA
                        SET POSICAO = ? WHERE ID_VITORIA = ?
                    """,
                    parametros=(item["posicao"], item["id_vitoria"]),
                )

            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_BINGO_CONFIG
                    SET DESEMPATE_EM = SYSDATETIME(), UPDATED_AT = SYSDATETIME()
                    WHERE ID_CAMPANHA = ?;
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO = VERSAO_ESTADO + 1 WHERE ID_SESSAO = ?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, ?, 'BINGO_DESEMPATE', ?);
                """,
                parametros=(
                    dados["id_campanha"], id_sessao,
                    dados["id_campanha"], id_sessao, str(cpf_criador),
                    json.dumps(resultado),
                ),
            )
            transaction.commit()
            return resultado
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def continuar_bingo(self, id_sessao, cpf_criador, padrao_vitoria):
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status,
                           B.AGUARDANDO_DECISAO AS aguardando_decisao
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA=S.ID_CAMPANHA
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO=C.ID_TIPO_JOGO
                    INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B WITH (UPDLOCK, ROWLOCK)
                        ON B.ID_CAMPANHA=C.ID_CAMPANHA
                    WHERE S.ID_SESSAO=? AND C.CPF_CRIADOR=?
                      AND T.CODIGO='BINGO'
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "EM_ANDAMENTO":
                raise ValueError("SESSAO_NAO_ATIVA")
            if not sessao.get("aguardando_decisao"):
                raise ValueError("DECISAO_NAO_PENDENTE")
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_BINGO_CONFIG
                    SET PADRAO_VITORIA=?, PAUSADA=0, PAUSADA_EM=NULL,
                        PAUSADA_POR=NULL, AGUARDANDO_DECISAO=0,
                        UPDATED_AT=SYSDATETIME()
                    WHERE ID_CAMPANHA=?;
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO=VERSAO_ESTADO+1 WHERE ID_SESSAO=?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, ?, 'BINGO_CONTINUADO', ?);
                """,
                parametros=(
                    padrao_vitoria, sessao["id_campanha"], id_sessao,
                    sessao["id_campanha"], id_sessao, str(cpf_criador),
                    json.dumps({"padrao_vitoria": padrao_vitoria}),
                ),
            )
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def alterar_pausa_bingo(self, id_sessao, cpf_criador, pausada):
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status,
                           B.PAUSADA AS pausada,
                           B.AGUARDANDO_DECISAO AS aguardando_decisao
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                    INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B WITH (UPDLOCK, ROWLOCK)
                        ON B.ID_CAMPANHA = C.ID_CAMPANHA
                    WHERE S.ID_SESSAO = ? AND C.CPF_CRIADOR = ?
                      AND T.CODIGO = 'BINGO'
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "EM_ANDAMENTO":
                raise ValueError("SESSAO_NAO_ATIVA")
            if not pausada and sessao.get("aguardando_decisao"):
                raise ValueError("DECISAO_PENDENTE")
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_BINGO_CONFIG
                    SET PAUSADA=?,
                        PAUSADA_EM=CASE WHEN ?=1 THEN SYSDATETIME() ELSE NULL END,
                        PAUSADA_POR=CASE WHEN ?=1 THEN ? ELSE NULL END,
                        UPDATED_AT=SYSDATETIME()
                    WHERE ID_CAMPANHA=?;
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO=VERSAO_ESTADO+1 WHERE ID_SESSAO=?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO
                    ) VALUES (?, ?, ?, ?);
                """,
                parametros=(
                    1 if pausada else 0,
                    1 if pausada else 0,
                    1 if pausada else 0,
                    str(cpf_criador),
                    sessao["id_campanha"],
                    id_sessao,
                    sessao["id_campanha"],
                    id_sessao,
                    str(cpf_criador),
                    "BINGO_PAUSADO" if pausada else "BINGO_RETOMADO",
                ),
            )
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def encerrar_bingo(self, id_sessao, cpf_criador):
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status,
                           B.XP_PARTICIPACAO AS xp_participacao,
                           B.XP_VITORIA AS xp_vitoria,
                           B.AGUARDANDO_DECISAO AS aguardando_decisao,
                           (SELECT COUNT(*) FROM dbo.TB_ARENA_BINGO_VITORIA V
                            WHERE V.ID_SESSAO=S.ID_SESSAO) AS total_vitorias
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA = S.ID_CAMPANHA
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                    INNER JOIN dbo.TB_ARENA_BINGO_CONFIG B WITH (UPDLOCK, ROWLOCK)
                        ON B.ID_CAMPANHA = C.ID_CAMPANHA
                    WHERE S.ID_SESSAO=? AND C.CPF_CRIADOR=?
                      AND T.CODIGO='BINGO'
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "EM_ANDAMENTO":
                raise ValueError("SESSAO_NAO_ATIVA")
            classificados = transaction.execute_fetch(
                query="""
                    WITH VITORIAS AS (
                        SELECT ID_PARTICIPANTE, MIN(POSICAO) AS posicao_vitoria
                        FROM dbo.TB_ARENA_BINGO_VITORIA
                        WHERE ID_SESSAO=? GROUP BY ID_PARTICIPANTE
                    ), RESULTADO AS (
                        SELECT P.ID_PARTICIPANTE AS id_participante,
                               P.CPF_COLABORADOR AS cpf,
                               P.CENTRO_CUSTO_SNAPSHOT AS centro_custo,
                               SUM(CASE WHEN X.MARCADA=1 AND X.LIVRE=0
                                        THEN 1 ELSE 0 END) AS marcadas,
                               V.posicao_vitoria
                        FROM dbo.TB_ARENA_PARTICIPANTE P
                        INNER JOIN dbo.TB_ARENA_BINGO_CARTELA C
                            ON C.ID_PARTICIPANTE=P.ID_PARTICIPANTE
                           AND C.ID_SESSAO=?
                        INNER JOIN dbo.TB_ARENA_BINGO_CARTELA_CASA X
                            ON X.ID_CARTELA=C.ID_CARTELA
                        LEFT JOIN VITORIAS V
                            ON V.ID_PARTICIPANTE=P.ID_PARTICIPANTE
                        WHERE P.STATUS='JOGANDO'
                        GROUP BY P.ID_PARTICIPANTE, P.CPF_COLABORADOR,
                                 P.CENTRO_CUSTO_SNAPSHOT, V.posicao_vitoria
                    )
                    SELECT *, ROW_NUMBER() OVER (
                        ORDER BY CASE WHEN posicao_vitoria IS NULL THEN 1 ELSE 0 END,
                                 posicao_vitoria, marcadas DESC, id_participante
                    ) AS posicao FROM RESULTADO
                """,
                parametros=(id_sessao, id_sessao),
                one=False,
            ) or []
            temporada = transaction.execute_fetch(
                query="""
                    SELECT TOP 1 ID_TEMPORADA AS id FROM dbo.TB_ARENA_TEMPORADA
                    WHERE STATUS='ATIVA'
                      AND CAST(GETDATE() AS DATE) BETWEEN DT_INICIO AND DT_FIM
                    ORDER BY DT_INICIO DESC
                """,
                parametros=(),
                one=True,
            )
            tipo_encerramento = (
                "BINGO" if int(sessao.get("total_vitorias") or 0) > 0 else "MANUAL"
            )
            for item in classificados:
                vencedor = item.get("posicao_vitoria") is not None
                pontos = int(item.get("marcadas") or 0) * 10 + (
                    500 if vencedor else 0
                )
                xp = int(sessao.get("xp_participacao") or 0) + (
                    int(sessao.get("xp_vitoria") or 0) if vencedor else 0
                )
                transaction.execute_commit(
                    query="""
                        UPDATE dbo.TB_ARENA_PARTICIPANTE
                        SET PONTUACAO=?, CLASSIFICACAO=?, XP_CONCEDIDO=?,
                            STATUS='FINALIZADO', UPDATED_AT=SYSDATETIME()
                        WHERE ID_PARTICIPANTE=?
                    """,
                    parametros=(pontos, item["posicao"], xp, item["id_participante"]),
                )
                chave = f"ARENA:BINGO:{id_sessao}:PARTICIPANTE:{item['id_participante']}"
                inserida = transaction.execute_commit(
                    query="""
                        INSERT INTO dbo.TB_ARENA_XP_MOVIMENTACAO (
                            CPF_COLABORADOR, ID_TEMPORADA, ID_CAMPANHA,
                            CENTRO_CUSTO_SNAPSHOT, TIPO, XP, DESCRICAO,
                            CHAVE_IDEMPOTENCIA
                        ) SELECT ?, ?, ?, ?, 'PARTICIPACAO', ?,
                                 'Resultado final do Bingo da Carteira', ?
                        WHERE ? <> 0 AND NOT EXISTS (
                            SELECT 1 FROM dbo.TB_ARENA_XP_MOVIMENTACAO
                            WHERE CHAVE_IDEMPOTENCIA=?
                        )
                    """,
                    parametros=(
                        item["cpf"], temporada.get("id") if temporada else None,
                        sessao["id_campanha"], item["centro_custo"], xp,
                        chave, xp, chave,
                    ),
                    return_rowcount=True,
                )
                if inserida:
                    transaction.execute_commit(
                        query="""
                            MERGE dbo.TB_ARENA_PERFIL AS D
                            USING (SELECT ? AS CPF_COLABORADOR) AS O
                            ON D.CPF_COLABORADOR=O.CPF_COLABORADOR
                            WHEN MATCHED THEN UPDATE SET
                                XP_TOTAL=D.XP_TOTAL+?,
                                NIVEL=((D.XP_TOTAL+?)/500)+1,
                                UPDATED_AT=SYSDATETIME()
                            WHEN NOT MATCHED THEN INSERT (
                                CPF_COLABORADOR, XP_TOTAL, NIVEL
                            ) VALUES (?, ?, (?/500)+1);
                        """,
                        parametros=(item["cpf"], xp, xp, item["cpf"], xp, xp),
                    )
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_SESSAO SET STATUS='FINALIZADA',
                        FINALIZADA_EM=SYSDATETIME(), VERSAO_ESTADO=VERSAO_ESTADO+1
                        WHERE ID_SESSAO=?;
                    UPDATE dbo.TB_ARENA_CAMPANHA SET STATUS='FINALIZADA',
                        FINALIZADA_EM=SYSDATETIME(), UPDATED_AT=SYSDATETIME()
                        WHERE ID_CAMPANHA=?;
                    UPDATE dbo.TB_ARENA_BINGO_CONFIG SET PAUSADA=0,
                        PAUSADA_EM=NULL, PAUSADA_POR=NULL,
                        AGUARDANDO_DECISAO=0,
                        ENCERRAMENTO_TIPO=?,
                        UPDATED_AT=SYSDATETIME()
                        WHERE ID_CAMPANHA=?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO
                    ) VALUES (?, ?, ?, ?);
                """,
                parametros=(
                    id_sessao, sessao["id_campanha"], tipo_encerramento,
                    sessao["id_campanha"], sessao["id_campanha"],
                    id_sessao, str(cpf_criador),
                    "BINGO_FINALIZADO" if tipo_encerramento == "BINGO"
                    else "BINGO_ENCERRADO_MANUALMENTE",
                ),
            )
            transaction.commit()
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def listar_supervisores(self, busca, limite):
        termo = f"%{busca}%"
        return self.db.execute_fetch(
            query="""
                SELECT TOP (?) CAST(CPF_COLABORADOR AS VARCHAR(20)) AS cpf,
                       LTRIM(RTRIM(NM_COLABORADOR)) AS nome,
                       LTRIM(RTRIM(CENTRO_CUSTO)) AS centro_custo,
                       LTRIM(RTRIM(FUNCAO_COLABORADOR)) AS funcao
                FROM login.TB_USUARIOS WITH (NOLOCK)
                WHERE ISNULL(USUARIO_ATIVO, 1)=1
                  AND UPPER(ISNULL(FUNCAO_COLABORADOR, '')) LIKE '%SUPERVISOR%'
                  AND (?='' OR UPPER(NM_COLABORADOR) LIKE UPPER(?)
                       OR CAST(CPF_COLABORADOR AS VARCHAR(20)) LIKE ?)
                ORDER BY NM_COLABORADOR
            """,
            parametros=(limite, busca, termo, termo),
            one=False,
        ) or []

    def transferir_bingo(self, id_sessao, cpf_criador, cpf_destino):
        transaction = self.db.begin_transaction()
        try:
            sessao = transaction.execute_fetch(
                query="""
                    SELECT S.ID_CAMPANHA AS id_campanha, S.STATUS AS status,
                           C.CPF_CRIADOR AS cpf_criador
                    FROM dbo.TB_ARENA_SESSAO S WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                        ON C.ID_CAMPANHA=S.ID_CAMPANHA
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO=C.ID_TIPO_JOGO
                    WHERE S.ID_SESSAO=? AND C.CPF_CRIADOR=?
                      AND T.CODIGO='BINGO'
                """,
                parametros=(id_sessao, str(cpf_criador)),
                one=True,
            )
            if not sessao:
                raise ValueError("SESSAO_NAO_ENCONTRADA")
            if sessao["status"] != "EM_ANDAMENTO":
                raise ValueError("SESSAO_NAO_ATIVA")
            destino = transaction.execute_fetch(
                query="""
                    SELECT CAST(CPF_COLABORADOR AS VARCHAR(20)) AS cpf,
                           LTRIM(RTRIM(NM_COLABORADOR)) AS nome
                    FROM login.TB_USUARIOS WITH (NOLOCK)
                    WHERE CPF_COLABORADOR=? AND ISNULL(USUARIO_ATIVO, 1)=1
                      AND UPPER(ISNULL(FUNCAO_COLABORADOR, '')) LIKE '%SUPERVISOR%'
                """,
                parametros=(str(cpf_destino),),
                one=True,
            )
            if not destino:
                raise ValueError("SUPERVISOR_DESTINO_INVALIDO")
            if str(destino["cpf"]) == str(cpf_criador):
                raise ValueError("MESMO_SUPERVISOR")
            transaction.execute_commit(
                query="""
                    UPDATE dbo.TB_ARENA_CAMPANHA
                    SET CPF_CRIADOR=?, NOME_CRIADOR=?, UPDATED_AT=SYSDATETIME()
                    WHERE ID_CAMPANHA=?;
                    UPDATE dbo.TB_ARENA_SESSAO
                    SET VERSAO_ESTADO=VERSAO_ESTADO+1 WHERE ID_SESSAO=?;
                    INSERT INTO dbo.TB_ARENA_EVENTO (
                        ID_CAMPANHA, ID_SESSAO, CPF_ATOR, TIPO, DADOS_JSON
                    ) VALUES (?, ?, ?, 'BINGO_CONTROLE_TRANSFERIDO', ?);
                """,
                parametros=(
                    str(destino["cpf"]), destino["nome"], sessao["id_campanha"],
                    id_sessao, sessao["id_campanha"], id_sessao,
                    str(cpf_criador), json.dumps({
                        "cpf_origem": str(cpf_criador),
                        "cpf_destino": str(destino["cpf"]),
                        "nome_destino": destino["nome"],
                    }, ensure_ascii=False),
                ),
            )
            transaction.commit()
            return destino
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()

    def obter_quiz_supervisor(self, id_campanha, cpf_criador):
        config = self.db.execute_fetch(
            query="""
                SELECT
                    Q.ID_QUIZ_CONFIG AS id,
                    Q.ID_CAMPANHA AS id_campanha,
                    Q.TEMPO_PERGUNTA_SEGUNDOS AS tempo_pergunta_segundos,
                    Q.PONTOS_ACERTO AS pontos_acerto,
                    Q.BONUS_VELOCIDADE_MAX AS bonus_velocidade_max,
                    Q.EMBARALHAR_PERGUNTAS AS embaralhar_perguntas,
                    Q.EMBARALHAR_ALTERNATIVAS AS embaralhar_alternativas,
                    Q.STATUS AS status
                FROM dbo.TB_ARENA_QUIZ_CONFIG Q WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_CAMPANHA C WITH (NOLOCK)
                    ON C.ID_CAMPANHA = Q.ID_CAMPANHA
                WHERE Q.ID_CAMPANHA = ? AND C.CPF_CRIADOR = ?
            """,
            parametros=(id_campanha, str(cpf_criador)),
            one=True,
        )
        if not config:
            return None
        perguntas = self.db.execute_fetch(
            query="""
                SELECT
                    P.ID_PERGUNTA AS id,
                    P.ENUNCIADO AS enunciado,
                    P.EXPLICACAO AS explicacao,
                    P.ORDEM AS ordem,
                    P.TEMPO_SEGUNDOS AS tempo_segundos
                FROM dbo.TB_ARENA_QUIZ_PERGUNTA P WITH (NOLOCK)
                WHERE P.ID_QUIZ_CONFIG = ? AND P.ATIVA = 1
                ORDER BY P.ORDEM
            """,
            parametros=(config["id"],),
            one=False,
        ) or []
        alternativas = self.db.execute_fetch(
            query="""
                SELECT
                    A.ID_ALTERNATIVA AS id,
                    A.ID_PERGUNTA AS id_pergunta,
                    A.TEXTO AS texto,
                    A.CORRETA AS correta,
                    A.ORDEM AS ordem
                FROM dbo.TB_ARENA_QUIZ_ALTERNATIVA A WITH (NOLOCK)
                INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA P WITH (NOLOCK)
                    ON P.ID_PERGUNTA = A.ID_PERGUNTA
                WHERE P.ID_QUIZ_CONFIG = ? AND P.ATIVA = 1
                ORDER BY P.ORDEM, A.ORDEM
            """,
            parametros=(config["id"],),
            one=False,
        ) or []
        por_pergunta = {}
        for alternativa in alternativas:
            por_pergunta.setdefault(alternativa["id_pergunta"], []).append(alternativa)
        return {
            **config,
            "perguntas": [
                {
                    **pergunta,
                    "alternativas": por_pergunta.get(pergunta["id"], []),
                }
                for pergunta in perguntas
            ],
        }

    def salvar_quiz_supervisor(self, id_campanha, cpf_criador, config, perguntas):
        transaction = self.db.begin_transaction()
        try:
            campanha = transaction.execute_fetch(
                query="""
                    SELECT C.STATUS AS status, T.CODIGO AS tipo_jogo
                    FROM dbo.TB_ARENA_CAMPANHA C WITH (UPDLOCK, ROWLOCK)
                    INNER JOIN dbo.TB_ARENA_TIPO_JOGO T
                        ON T.ID_TIPO_JOGO = C.ID_TIPO_JOGO
                    WHERE C.ID_CAMPANHA = ? AND C.CPF_CRIADOR = ?
                """,
                parametros=(id_campanha, str(cpf_criador)),
                one=True,
            )
            if not campanha:
                raise ValueError("CAMPANHA_NAO_ENCONTRADA")
            if campanha["status"] != "RASCUNHO":
                raise ValueError("CAMPANHA_NAO_EDITAVEL")
            if campanha["tipo_jogo"] != "QUIZ_AO_VIVO":
                raise ValueError("TIPO_JOGO_INVALIDO")

            quiz = transaction.execute_insert_returning(
                query="""
                    MERGE dbo.TB_ARENA_QUIZ_CONFIG AS DESTINO
                    USING (SELECT ? AS ID_CAMPANHA) AS ORIGEM
                    ON DESTINO.ID_CAMPANHA = ORIGEM.ID_CAMPANHA
                    WHEN MATCHED THEN UPDATE SET
                        TEMPO_PERGUNTA_SEGUNDOS = ?,
                        PONTOS_ACERTO = ?,
                        BONUS_VELOCIDADE_MAX = ?,
                        EMBARALHAR_PERGUNTAS = ?,
                        EMBARALHAR_ALTERNATIVAS = ?,
                        STATUS = 'PRONTO',
                        UPDATED_AT = SYSDATETIME()
                    WHEN NOT MATCHED THEN INSERT (
                        ID_CAMPANHA, TEMPO_PERGUNTA_SEGUNDOS,
                        PONTOS_ACERTO, BONUS_VELOCIDADE_MAX,
                        EMBARALHAR_PERGUNTAS, EMBARALHAR_ALTERNATIVAS,
                        STATUS
                    ) VALUES (?, ?, ?, ?, ?, ?, 'PRONTO')
                    OUTPUT INSERTED.ID_QUIZ_CONFIG AS id;
                """,
                parametros=(
                    id_campanha,
                    config["tempo_pergunta_segundos"],
                    config["pontos_acerto"],
                    config["bonus_velocidade_max"],
                    config["embaralhar_perguntas"],
                    config["embaralhar_alternativas"],
                    id_campanha,
                    config["tempo_pergunta_segundos"],
                    config["pontos_acerto"],
                    config["bonus_velocidade_max"],
                    config["embaralhar_perguntas"],
                    config["embaralhar_alternativas"],
                ),
            )
            transaction.execute_commit(
                query="""
                    DELETE A
                    FROM dbo.TB_ARENA_QUIZ_ALTERNATIVA A
                    INNER JOIN dbo.TB_ARENA_QUIZ_PERGUNTA P
                        ON P.ID_PERGUNTA = A.ID_PERGUNTA
                    WHERE P.ID_QUIZ_CONFIG = ?
                """,
                parametros=(quiz["id"],),
            )
            transaction.execute_commit(
                query="""
                    DELETE FROM dbo.TB_ARENA_QUIZ_PERGUNTA
                    WHERE ID_QUIZ_CONFIG = ?
                """,
                parametros=(quiz["id"],),
            )
            for ordem, pergunta in enumerate(perguntas, start=1):
                criada = transaction.execute_insert_returning(
                    query="""
                        INSERT INTO dbo.TB_ARENA_QUIZ_PERGUNTA (
                            ID_QUIZ_CONFIG, ENUNCIADO, EXPLICACAO,
                            ORDEM, TEMPO_SEGUNDOS
                        )
                        OUTPUT INSERTED.ID_PERGUNTA AS id
                        VALUES (?, ?, ?, ?, ?)
                    """,
                    parametros=(
                        quiz["id"],
                        pergunta["enunciado"],
                        pergunta.get("explicacao"),
                        ordem,
                        pergunta.get("tempo_segundos"),
                    ),
                )
                for ordem_alternativa, alternativa in enumerate(
                    pergunta["alternativas"],
                    start=1,
                ):
                    transaction.execute_commit(
                        query="""
                            INSERT INTO dbo.TB_ARENA_QUIZ_ALTERNATIVA (
                                ID_PERGUNTA, TEXTO, CORRETA, ORDEM
                            ) VALUES (?, ?, ?, ?)
                        """,
                        parametros=(
                            criada["id"],
                            alternativa["texto"],
                            alternativa["correta"],
                            ordem_alternativa,
                        ),
                    )
            transaction.commit()
            return quiz["id"]
        except Exception:
            transaction.rollback()
            raise
        finally:
            transaction.close()
