"""Base de conhecimento da Aurora em banco, no lugar do JSON versionado.

Ate aqui o material de treinamento vivia em `aurora_base_conhecimento.json`,
o que amarrava cada correcao de script a um commit e um deploy -- justamente
quem conhece a carteira (supervisao e monitoria) era quem nao conseguia mexer.

As leituras usadas pelo cache abrem transacao em vez de `execute_fetch` porque
o `execute_fetch` da conexao engole `pyodbc.Error` e devolve `None`: uma falha
de banco viraria "base vazia" silenciosa, e a Aurora passaria a responder sem
treinamento nenhum sem ninguem perceber.
"""

from src.infrastructure.database.sql_server_connection import SQLServerConnection
from src.shared.utils.env_load import DB_HOST_66


class IAConhecimentoRepository:
    def __init__(self):
        self.db = SQLServerConnection(DB_HOST_66, "DB_COPILOT_ACME")

    def ensure_schema(self):
        query = """
        IF OBJECT_ID('dbo.TB_IA_BASE_CONHECIMENTO', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.TB_IA_BASE_CONHECIMENTO (
                ID_CONHECIMENTO INT IDENTITY(1,1) PRIMARY KEY,
                CARTEIRA NVARCHAR(120) NOT NULL,
                PRODUTO NVARCHAR(160) NOT NULL,
                CATEGORIA NVARCHAR(120) NULL,
                DESCRICAO NVARCHAR(500) NULL,
                TEXTO NVARCHAR(MAX) NOT NULL,
                SINONIMOS NVARCHAR(MAX) NULL,
                ATIVO BIT NOT NULL DEFAULT 1,
                ORIGEM VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
                EMBEDDING NVARCHAR(MAX) NULL,
                EMBEDDING_MODELO VARCHAR(60) NULL,
                EMBEDDING_HASH CHAR(64) NULL,
                EMBEDDING_EM DATETIME2 NULL,
                CRIADO_POR NVARCHAR(180) NULL,
                CRIADO_EM DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
                ATUALIZADO_POR NVARCHAR(180) NULL,
                ATUALIZADO_EM DATETIME2 NOT NULL DEFAULT SYSDATETIME()
            );
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_IA_BASE_CONHECIMENTO_CARTEIRA'
              AND object_id = OBJECT_ID('dbo.TB_IA_BASE_CONHECIMENTO')
        )
        BEGIN
            CREATE INDEX IX_IA_BASE_CONHECIMENTO_CARTEIRA
                ON dbo.TB_IA_BASE_CONHECIMENTO (CARTEIRA, ATIVO)
                INCLUDE (PRODUTO, CATEGORIA);
        END;

        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_IA_BASE_CONHECIMENTO_ATUALIZADO'
              AND object_id = OBJECT_ID('dbo.TB_IA_BASE_CONHECIMENTO')
        )
        BEGIN
            CREATE INDEX IX_IA_BASE_CONHECIMENTO_ATUALIZADO
                ON dbo.TB_IA_BASE_CONHECIMENTO (ATUALIZADO_EM DESC);
        END;
        """
        self.db.execute_commit(query=query, parametros=())

    # ------------------------------------------------------------------ #
    # Leituras do cache -- propagam erro de banco em vez de devolver vazio
    # ------------------------------------------------------------------ #

    def versao(self) -> dict:
        """Sonda barata para o cache saber se vale recarregar os vetores.

        `COUNT` cobre insercao e exclusao fisica; `MAX(ATUALIZADO_EM)` cobre
        edicao e desativacao. Custa quase nada com o indice por ATUALIZADO_EM,
        e evita puxar ~2,5 MB de vetores a cada expiracao do TTL.
        """
        tx = self.db.begin_transaction()
        try:
            linha = tx.execute_fetch(query="""
                SELECT COUNT(*) AS QT, MAX(ATUALIZADO_EM) AS ULTIMA
                FROM dbo.TB_IA_BASE_CONHECIMENTO WITH (NOLOCK)
            """, parametros=(), one=True) or {}
            return {
                "quantidade": int(linha.get("QT") or 0),
                "ultima": str(linha.get("ULTIMA") or ""),
            }
        finally:
            tx.close()

    def listar_todos(self, incluir_inativos: bool = False) -> list[dict]:
        filtro = "" if incluir_inativos else "WHERE ATIVO = 1"
        tx = self.db.begin_transaction()
        try:
            return tx.execute_fetch(query=f"""
                SELECT ID_CONHECIMENTO, CARTEIRA, PRODUTO, CATEGORIA, DESCRICAO,
                       TEXTO, SINONIMOS, ATIVO, EMBEDDING, EMBEDDING_MODELO,
                       EMBEDDING_HASH
                FROM dbo.TB_IA_BASE_CONHECIMENTO WITH (NOLOCK)
                {filtro}
                ORDER BY CARTEIRA, PRODUTO
            """, parametros=(), one=False) or []
        finally:
            tx.close()

    # ------------------------------------------------------------------ #
    # Leituras da tela
    # ------------------------------------------------------------------ #

    def listar_paginado(
        self,
        *,
        carteira=None,
        busca=None,
        incluir_inativos=False,
        offset=0,
        limite=25,
    ) -> list[dict]:
        condicoes = []
        parametros = []

        if not incluir_inativos:
            condicoes.append("ATIVO = 1")
        if carteira:
            condicoes.append("CARTEIRA = ?")
            parametros.append(carteira)
        if busca:
            condicoes.append(
                "(PRODUTO LIKE ? OR DESCRICAO LIKE ? OR TEXTO LIKE ? OR CARTEIRA LIKE ?)"
            )
            parametros.extend([f"%{busca}%"] * 4)

        where = f"WHERE {' AND '.join(condicoes)}" if condicoes else ""

        return self.db.execute_fetch(query=f"""
            SELECT ID_CONHECIMENTO, CARTEIRA, PRODUTO, CATEGORIA, DESCRICAO,
                   TEXTO, SINONIMOS, ATIVO, ORIGEM,
                   CASE WHEN EMBEDDING IS NULL THEN 0 ELSE 1 END AS INDEXADO,
                   ATUALIZADO_POR, ATUALIZADO_EM,
                   COUNT(*) OVER () AS QT_TOTAL
            FROM dbo.TB_IA_BASE_CONHECIMENTO WITH (NOLOCK)
            {where}
            ORDER BY CARTEIRA, PRODUTO
            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """, parametros=tuple(parametros) + (offset, limite), one=False) or []

    def listar_carteiras(self) -> list[str]:
        linhas = self.db.execute_fetch(query="""
            SELECT DISTINCT CARTEIRA
            FROM dbo.TB_IA_BASE_CONHECIMENTO WITH (NOLOCK)
            WHERE ATIVO = 1
            ORDER BY CARTEIRA
        """, parametros=(), one=False) or []
        return [linha["CARTEIRA"] for linha in linhas]

    def obter(self, id_conhecimento: int) -> dict | None:
        return self.db.execute_fetch(query="""
            SELECT ID_CONHECIMENTO, CARTEIRA, PRODUTO, CATEGORIA, DESCRICAO,
                   TEXTO, SINONIMOS, ATIVO, ORIGEM,
                   CASE WHEN EMBEDDING IS NULL THEN 0 ELSE 1 END AS INDEXADO,
                   EMBEDDING_MODELO, EMBEDDING_HASH, EMBEDDING_EM,
                   CRIADO_POR, CRIADO_EM, ATUALIZADO_POR, ATUALIZADO_EM
            FROM dbo.TB_IA_BASE_CONHECIMENTO WITH (NOLOCK)
            WHERE ID_CONHECIMENTO = ?
        """, parametros=(id_conhecimento,), one=True)

    def listar_pendentes_embedding(self, modelo: str) -> list[dict]:
        """Sem vetor, ou com vetor de outro modelo.

        Vetor gerado por outro modelo nao e comparavel com o da pergunta: o
        ranking sairia silenciosamente errado. Reindexar e o unico caminho.
        """
        return self.db.execute_fetch(query="""
            SELECT ID_CONHECIMENTO, CARTEIRA, PRODUTO, CATEGORIA, DESCRICAO,
                   TEXTO, SINONIMOS, EMBEDDING_HASH
            FROM dbo.TB_IA_BASE_CONHECIMENTO WITH (NOLOCK)
            WHERE ATIVO = 1
              AND (EMBEDDING IS NULL OR EMBEDDING_MODELO IS NULL OR EMBEDDING_MODELO <> ?)
            ORDER BY ID_CONHECIMENTO
        """, parametros=(modelo,), one=False) or []

    def tabela_existe(self) -> bool:
        linha = self.db.execute_fetch(query="""
            SELECT CASE WHEN OBJECT_ID('dbo.TB_IA_BASE_CONHECIMENTO', 'U') IS NULL
                        THEN 0 ELSE 1 END AS EXISTE
        """, parametros=(), one=True) or {}
        return bool(linha.get("EXISTE"))

    def contar(self) -> int:
        linha = self.db.execute_fetch(query="""
            SELECT COUNT(*) AS QT FROM dbo.TB_IA_BASE_CONHECIMENTO WITH (NOLOCK)
        """, parametros=(), one=True) or {}
        return int(linha.get("QT") or 0)

    # ------------------------------------------------------------------ #
    # Escritas
    # ------------------------------------------------------------------ #

    def inserir(
        self,
        *,
        carteira,
        produto,
        categoria,
        descricao,
        texto,
        sinonimos,
        origem="MANUAL",
        embedding=None,
        embedding_modelo=None,
        embedding_hash=None,
        criado_por=None,
    ) -> int:
        criado = self.db.execute_insert_returning(query="""
            INSERT INTO dbo.TB_IA_BASE_CONHECIMENTO (
                CARTEIRA, PRODUTO, CATEGORIA, DESCRICAO, TEXTO, SINONIMOS,
                ORIGEM, EMBEDDING, EMBEDDING_MODELO, EMBEDDING_HASH, EMBEDDING_EM,
                CRIADO_POR, ATUALIZADO_POR
            ) OUTPUT INSERTED.ID_CONHECIMENTO AS ID_CONHECIMENTO
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    CASE WHEN ? IS NULL THEN NULL ELSE SYSDATETIME() END, ?, ?)
        """, parametros=(
            carteira, produto, categoria, descricao, texto, sinonimos,
            origem, embedding, embedding_modelo, embedding_hash, embedding_hash,
            criado_por, criado_por,
        ))
        return int(criado["ID_CONHECIMENTO"])

    def atualizar(
        self,
        *,
        id_conhecimento,
        carteira,
        produto,
        categoria,
        descricao,
        texto,
        sinonimos,
        atualizado_por,
    ) -> int:
        return self.db.execute_commit(query="""
            UPDATE dbo.TB_IA_BASE_CONHECIMENTO
            SET CARTEIRA = ?, PRODUTO = ?, CATEGORIA = ?, DESCRICAO = ?,
                TEXTO = ?, SINONIMOS = ?,
                ATUALIZADO_POR = ?, ATUALIZADO_EM = SYSDATETIME()
            WHERE ID_CONHECIMENTO = ?
        """, parametros=(
            carteira, produto, categoria, descricao, texto, sinonimos,
            atualizado_por, id_conhecimento,
        ), return_rowcount=True)

    def definir_ativo(self, *, id_conhecimento, ativo, atualizado_por) -> int:
        return self.db.execute_commit(query="""
            UPDATE dbo.TB_IA_BASE_CONHECIMENTO
            SET ATIVO = ?, ATUALIZADO_POR = ?, ATUALIZADO_EM = SYSDATETIME()
            WHERE ID_CONHECIMENTO = ?
        """, parametros=(
            1 if ativo else 0, atualizado_por, id_conhecimento,
        ), return_rowcount=True)

    def gravar_embedding(
        self, *, id_conhecimento, embedding, embedding_modelo, embedding_hash
    ) -> int:
        """So o vetor -- nao mexe em ATUALIZADO_POR.

        Reindexar nao e edicao de conteudo: marcar o operador da reindexacao
        como autor apagaria o rastro de quem realmente escreveu o treinamento.
        ATUALIZADO_EM avanca de proposito, para o cache dos outros workers
        perceber que ha vetor novo.
        """
        return self.db.execute_commit(query="""
            UPDATE dbo.TB_IA_BASE_CONHECIMENTO
            SET EMBEDDING = ?, EMBEDDING_MODELO = ?, EMBEDDING_HASH = ?,
                EMBEDDING_EM = SYSDATETIME(), ATUALIZADO_EM = SYSDATETIME()
            WHERE ID_CONHECIMENTO = ?
        """, parametros=(
            embedding, embedding_modelo, embedding_hash, id_conhecimento,
        ), return_rowcount=True)

    def limpar_embedding(self, id_conhecimento: int) -> int:
        """Usado quando o texto muda e o vetor novo nao pode ser gerado.

        Deixar o vetor velho seria pior que nao ter nenhum: ele continuaria
        recuperando o registro pelo conteudo antigo, ja apagado.
        """
        return self.db.execute_commit(query="""
            UPDATE dbo.TB_IA_BASE_CONHECIMENTO
            SET EMBEDDING = NULL, EMBEDDING_MODELO = NULL,
                EMBEDDING_HASH = NULL, EMBEDDING_EM = NULL
            WHERE ID_CONHECIMENTO = ?
        """, parametros=(id_conhecimento,), return_rowcount=True)
