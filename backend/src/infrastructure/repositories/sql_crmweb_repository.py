import hashlib
import json

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class CrmwebRepository:

    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def criar(self, contrato, periodoAte, dataPagto, tipoPagto, usuario, buscarCoobrigado):
        chave_pedido = "\x1f".join(
            str(valor) if valor is not None else "<null>"
            for valor in (
                contrato,
                periodoAte,
                dataPagto,
                tipoPagto,
                usuario,
                buscarCoobrigado,
            )
        )
        recurso_lock = "crmweb:" + hashlib.sha256(
            chave_pedido.encode("utf-8")
        ).hexdigest()

        transacao = self.db.begin_transaction()

        try:
            lock = transacao.execute_fetch(
                query="""
                    SET NOCOUNT ON;
                    DECLARE @resultado INT;
                    EXEC @resultado = sys.sp_getapplock
                        @Resource = ?,
                        @LockMode = 'Exclusive',
                        @LockOwner = 'Transaction',
                        @LockTimeout = 10000;
                    SELECT @resultado AS LOCK_RESULT;
                """,
                parametros=(recurso_lock,),
                one=True,
            )

            if not lock or lock["LOCK_RESULT"] < 0:
                raise RuntimeError("Nao foi possivel reservar a criacao da consulta CRMWEB")

            existente = transacao.execute_fetch(
                query="""
                    SELECT TOP (1) ID_BUSCA
                    FROM dbo.TB_CONSULTA_CRMWEB WITH (UPDLOCK, HOLDLOCK)
                    WHERE CONTRATO = ?
                      AND PERIODO_ATE = ?
                      AND (DATA_PAGTO = ? OR (DATA_PAGTO IS NULL AND ? IS NULL))
                      AND TIPO_PAGTO = ?
                      AND (USUARIO = ? OR (USUARIO IS NULL AND ? IS NULL))
                      AND (
                          BUSCAR_COOBRIGADO = ?
                          OR (BUSCAR_COOBRIGADO IS NULL AND ? IS NULL)
                      )
                      AND STATUS IN ('pendente', 'buscando', 'resolvido')
                      AND DT_CRIACAO >= DATEADD(MINUTE, -2, GETDATE())
                    ORDER BY DT_CRIACAO DESC, ID_BUSCA DESC
                """,
                parametros=(
                    contrato,
                    periodoAte,
                    dataPagto,
                    dataPagto,
                    tipoPagto,
                    usuario,
                    usuario,
                    buscarCoobrigado,
                    buscarCoobrigado,
                ),
                one=True,
            )

            if existente:
                transacao.commit()
                return existente["ID_BUSCA"]

            resultado = transacao.execute_insert_returning(
                query="""
                    INSERT INTO dbo.TB_CONSULTA_CRMWEB
                    (
                        STATUS,
                        CONTRATO,
                        PERIODO_ATE,
                        DATA_PAGTO,
                        TIPO_PAGTO,
                        USUARIO,
                        BUSCAR_COOBRIGADO
                    )
                    OUTPUT INSERTED.ID_BUSCA
                    VALUES
                    (
                        'pendente',
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                """,
                parametros=(
                    contrato,
                    periodoAte,
                    dataPagto,
                    tipoPagto,
                    usuario,
                    buscarCoobrigado,
                ),
            )

            if not resultado:
                raise RuntimeError("Banco nao retornou o ID da consulta CRMWEB")

            transacao.commit()
            return resultado["ID_BUSCA"]
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()

    def criar_d9(
        self,
        contrato,
        periodoAte,
        tipoPagto,
        usuario,
        buscarCoobrigado,
        datas,
    ):
        pedidos = [
            {
                "marco": marco,
                "data_pagto": data_pagto,
                "status": "pendente1" if marco == "base" else "pendente2",
            }
            for marco, data_pagto in datas.items()
        ]

        recursos_lock = set()
        for pedido in pedidos:
            chave_pedido = "\x1f".join(
                str(valor) if valor is not None else "<null>"
                for valor in (
                    contrato,
                    periodoAte,
                    pedido["data_pagto"],
                    tipoPagto,
                    buscarCoobrigado,
                )
            )
            recursos_lock.add(
                "crmweb:" + hashlib.sha256(chave_pedido.encode("utf-8")).hexdigest()
            )

        transacao = self.db.begin_transaction()

        try:
            # A ordenacao evita deadlock entre dois lotes concorrentes que
            # contenham algumas das mesmas datas.
            for recurso_lock in sorted(recursos_lock):
                lock = transacao.execute_fetch(
                    query="""
                        SET NOCOUNT ON;
                        DECLARE @resultado INT;
                        EXEC @resultado = sys.sp_getapplock
                            @Resource = ?,
                            @LockMode = 'Exclusive',
                            @LockOwner = 'Transaction',
                            @LockTimeout = 10000;
                        SELECT @resultado AS LOCK_RESULT;
                    """,
                    parametros=(recurso_lock,),
                    one=True,
                )

                if not lock or lock["LOCK_RESULT"] < 0:
                    raise RuntimeError("Nao foi possivel reservar a criacao do lote D+9")

            resultado_pedidos = []

            for pedido in pedidos:
                # Resultados concluidos funcionam como cache compartilhado. Nao
                # ha limite de tempo nem filtro por usuario: se os parametros da
                # consulta sao iguais, nao e necessario solicitar a data de novo.
                existente = transacao.execute_fetch(
                    query="""
                        SELECT TOP (1) ID_BUSCA
                        FROM dbo.TB_CONSULTA_CRMWEB WITH (UPDLOCK, HOLDLOCK)
                        WHERE CONTRATO = ?
                          AND PERIODO_ATE = ?
                          AND DATA_PAGTO = ?
                          AND TIPO_PAGTO = ?
                          AND STATUS = 'resolvido'
                          AND (? = 0 OR BUSCAR_COOBRIGADO = 1)
                        ORDER BY DT_CRIACAO DESC, ID_BUSCA DESC
                    """,
                    parametros=(
                        contrato,
                        periodoAte,
                        pedido["data_pagto"],
                        tipoPagto,
                        buscarCoobrigado,
                    ),
                    one=True,
                )

                incluir_segunda_classe = pedido["status"] == "pendente2"
                statuses = (
                    "('pendente', 'pendente1', 'pendente2', 'buscando')"
                    if incluir_segunda_classe
                    else "('pendente', 'pendente1', 'buscando')"
                )

                # Se ainda nao existe resultado, tambem reutiliza um pedido
                # recente em andamento para evitar filas duplicadas.
                if not existente:
                    existente = transacao.execute_fetch(
                        query=f"""
                            SELECT TOP (1) ID_BUSCA
                            FROM dbo.TB_CONSULTA_CRMWEB WITH (UPDLOCK, HOLDLOCK)
                            WHERE CONTRATO = ?
                              AND PERIODO_ATE = ?
                              AND DATA_PAGTO = ?
                              AND TIPO_PAGTO = ?
                              AND (? = 0 OR BUSCAR_COOBRIGADO = 1)
                              AND STATUS IN {statuses}
                              AND DT_CRIACAO >= DATEADD(MINUTE, -2, GETDATE())
                            ORDER BY DT_CRIACAO DESC, ID_BUSCA DESC
                        """,
                        parametros=(
                            contrato,
                            periodoAte,
                            pedido["data_pagto"],
                            tipoPagto,
                            buscarCoobrigado,
                        ),
                        one=True,
                    )

                if existente:
                    id_busca = existente["ID_BUSCA"]
                else:
                    inserido = transacao.execute_insert_returning(
                        query="""
                            INSERT INTO dbo.TB_CONSULTA_CRMWEB
                            (
                                STATUS,
                                CONTRATO,
                                PERIODO_ATE,
                                DATA_PAGTO,
                                TIPO_PAGTO,
                                USUARIO,
                                BUSCAR_COOBRIGADO
                            )
                            OUTPUT INSERTED.ID_BUSCA
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        parametros=(
                            pedido["status"],
                            contrato,
                            periodoAte,
                            pedido["data_pagto"],
                            tipoPagto,
                            usuario,
                            buscarCoobrigado,
                        ),
                    )

                    if not inserido:
                        raise RuntimeError("Banco nao retornou o ID de uma consulta D+9")

                    id_busca = inserido["ID_BUSCA"]

                resultado_pedidos.append(
                    {
                        "marco": pedido["marco"],
                        "data_pagto": pedido["data_pagto"],
                        "status": pedido["status"],
                        "id_busca": id_busca,
                    }
                )

            transacao.commit()
            return resultado_pedidos
        except Exception:
            transacao.rollback()
            raise
        finally:
            transacao.close()

    def buscar_cache(self, contrato, periodoAte, dataPagto, tipoPagto, buscarCoobrigado):


        if buscarCoobrigado == 0:
            query = """
            SELECT * FROM dbo.TB_CONSULTA_CRMWEB WITH(NOLOCK)
            WHERE CONTRATO = ? AND
                PERIODO_ATE = ? AND
                DATA_PAGTO = ? AND
                TIPO_PAGTO = ? AND
                STATUS = 'resolvido'
                ORDER BY DT_CRIACAO DESC
            """

            resultado = self.db.execute_fetch(
                query=query,
                parametros=(
                    contrato,
                    periodoAte,
                    dataPagto,
                    tipoPagto
                )
            )
            
        else:
            query = """
            SELECT * FROM dbo.TB_CONSULTA_CRMWEB WITH(NOLOCK)
            WHERE CONTRATO = ? AND
                PERIODO_ATE = ? AND
                DATA_PAGTO = ? AND
                TIPO_PAGTO = ? AND
                BUSCAR_COOBRIGADO = ? AND
                STATUS = 'resolvido'
                ORDER BY DT_CRIACAO DESC
            """

            resultado = self.db.execute_fetch(
                query=query,
                parametros=(
                    contrato,
                    periodoAte,
                    dataPagto,
                    tipoPagto,
                    buscarCoobrigado
                )
            )

        if not resultado:
            return None

        status = resultado[0]["STATUS"]

        if status == "resolvido":

            resultado_json = resultado[0]["RESULTADO_BUSCA"]

            # converte a string JSON
            try:
                dados = json.loads(resultado_json)
            except Exception:
                return {
                    "status": "falha na busca",
                    "erro": "Erro ao converter resultado"
                }

            return {
                "status": "resolvido",
                "id_busca": str(resultado[0]["ID_BUSCA"]),
                "dados": dados
            }
        else:
            return None
    
    def buscar_dados(self, id_busca):

        query = """
            SELECT STATUS, RESULTADO_BUSCA
            FROM dbo.TB_CONSULTA_CRMWEB WITH(NOLOCK)
            WHERE ID_BUSCA = ?
        """

        resultado = self.db.execute_fetch(
            query=query,
            parametros=(id_busca,)
        )

        if not resultado:
            return {
                "status": "falha na busca",
                "erro": "Busca não encontrada"
            }

        status = resultado[0]["STATUS"]

        if status in ("pendente", "pendente1", "pendente2"):
            return {
                "status": status
            }

        if status == "buscando":
            return {
                "status": "buscando"
            }

        if status == "resolvido":

            resultado_json = resultado[0]["RESULTADO_BUSCA"]

            # converte a string JSON
            try:
                dados = json.loads(resultado_json)
            except Exception:
                return {
                    "status": "falha na busca",
                    "erro": "Erro ao converter resultado"
                }

            return {
                "status": "resolvido",
                "dados": dados
            }
        
        if status == "falha":
            
            msgErro = resultado[0]["RESULTADO_BUSCA"]

            return {
                "status": "falha",
                "dados": msgErro
            }

        return {
            "status": "falha na busca"
        }
