"""Regras da base de conhecimento da Aurora: validacao, indexacao e cache.

Decisao que atravessa o arquivo inteiro: falha ao gerar o embedding NUNCA
impede a gravacao. Perder o texto que o supervisor acabou de escrever porque a
OpenAI oscilou seria pior do que o registro ficar temporariamente so no modo
lexical -- que e exatamente o comportamento que a Aurora ja tinha antes.
"""

import json
import traceback

from src.infrastructure.repositories.sql_ia_conhecimento_repository import (
    IAConhecimentoRepository,
)
from src.shared.ia import aurora_conhecimento_cache as cache
from src.shared.ia.embeddings import (
    MODELO_EMBEDDING,
    gerar_embedding,
    gerar_embeddings,
    hash_conteudo,
    serializar,
    texto_para_embedding,
)
from src.shared.ia.aurora_retrieval import diagnosticar

TAMANHO_MAXIMO_TEXTO = 8000


class ConhecimentoError(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


class IAConhecimentoService:
    def __init__(self, repo=None):
        self.repo = repo or IAConhecimentoRepository()
        self.repo.ensure_schema()

    # ------------------------------------------------------------------ #
    # Leitura
    # ------------------------------------------------------------------ #

    def listar(self, filtros) -> dict:
        pagina = max(1, self._inteiro(filtros.get("pagina"), 1))
        tamanho = min(100, max(1, self._inteiro(filtros.get("tamanho"), 25)))
        incluir_inativos = self._verdadeiro(filtros.get("incluir_inativos"))

        linhas = self.repo.listar_paginado(
            carteira=(filtros.get("carteira") or "").strip() or None,
            busca=(filtros.get("busca") or "").strip() or None,
            incluir_inativos=incluir_inativos,
            offset=(pagina - 1) * tamanho,
            limite=tamanho,
        )

        return {
            "pagina": pagina,
            "tamanho": tamanho,
            "total": int(linhas[0].get("QT_TOTAL") or 0) if linhas else 0,
            "itens": [self._mapear(linha) for linha in linhas],
        }

    def listar_carteiras(self) -> list[str]:
        return self.repo.listar_carteiras()

    def obter(self, id_conhecimento) -> dict:
        linha = self.repo.obter(id_conhecimento)
        if not linha:
            raise ConhecimentoError("Treinamento nao encontrado.", 404)
        return self._mapear(linha)

    def testar(self, carteira, pergunta) -> dict:
        self._validar_teste(carteira, pergunta)
        return diagnosticar(centro_custo=carteira, pergunta=pergunta)

    def simular_resposta(self, carteira, pergunta) -> dict:
        """A resposta final da Aurora, para conferir o texto que o operador le.

        Separado de `testar` porque custa uma chamada ao modelo: a busca e
        instantanea e pode rodar a cada ajuste do texto, enquanto a resposta so
        faz sentido pedir quando a ficha certa ja esta sendo recuperada.
        """
        self._validar_teste(carteira, pergunta)

        # Import tardio: `ia_services` carrega meio projeto (simulacao, insights,
        # personalidades). Importar no topo faria a tela de curadoria pagar isso
        # em toda requisicao, inclusive nas de listagem.
        from src.application.services.ia_services import IADesempenhoService

        try:
            resposta, conhecimentos = IADesempenhoService().simular(
                centro_custo=carteira, pergunta=pergunta
            )
        except Exception as erro:
            raise ConhecimentoError(
                "Nao foi possivel gerar a resposta de teste agora. "
                "A busca acima continua valendo.",
                503,
            ) from erro

        return {
            "resposta": resposta,
            "usou_treinamento": bool(conhecimentos),
            "itens": [
                {
                    "id": item.get("id"),
                    "produto": item.get("produto"),
                    "descricao": item.get("descricao"),
                    "score": item.get("score"),
                }
                for item in conhecimentos
            ],
        }

    @staticmethod
    def _validar_teste(carteira, pergunta) -> None:
        if not (carteira or "").strip():
            raise ConhecimentoError("Informe a carteira.")
        if not (pergunta or "").strip():
            raise ConhecimentoError("Informe a pergunta.")

    # ------------------------------------------------------------------ #
    # Escrita
    # ------------------------------------------------------------------ #

    def criar(self, dados, autor) -> dict:
        limpo = self._validar(dados)
        texto_indexavel = texto_para_embedding(limpo)
        vetor = gerar_embedding(texto_indexavel)

        id_conhecimento = self.repo.inserir(
            carteira=limpo["carteira"],
            produto=limpo["produto"],
            categoria=limpo["categoria"],
            descricao=limpo["descricao"],
            texto=limpo["texto"],
            sinonimos=json.dumps(limpo["sinonimos"], ensure_ascii=False),
            origem="MANUAL",
            embedding=serializar(vetor) if vetor else None,
            embedding_modelo=MODELO_EMBEDDING if vetor else None,
            embedding_hash=hash_conteudo(texto_indexavel) if vetor else None,
            criado_por=autor,
        )
        cache.invalidar()

        resultado = self.obter(id_conhecimento)
        if not vetor:
            resultado["aviso"] = self._AVISO_SEM_INDICE
        return resultado

    def atualizar(self, id_conhecimento, dados, autor) -> dict:
        atual = self.repo.obter(id_conhecimento)
        if not atual:
            raise ConhecimentoError("Treinamento nao encontrado.", 404)

        limpo = self._validar(dados)
        texto_indexavel = texto_para_embedding(limpo)
        hash_novo = hash_conteudo(texto_indexavel)

        self.repo.atualizar(
            id_conhecimento=id_conhecimento,
            carteira=limpo["carteira"],
            produto=limpo["produto"],
            categoria=limpo["categoria"],
            descricao=limpo["descricao"],
            texto=limpo["texto"],
            sinonimos=json.dumps(limpo["sinonimos"], ensure_ascii=False),
            atualizado_por=autor,
        )

        indexado = True
        precisa_reindexar = (
            atual.get("EMBEDDING_HASH") != hash_novo
            or atual.get("EMBEDDING_MODELO") != MODELO_EMBEDDING
        )
        if precisa_reindexar:
            vetor = gerar_embedding(texto_indexavel)
            if vetor:
                self.repo.gravar_embedding(
                    id_conhecimento=id_conhecimento,
                    embedding=serializar(vetor),
                    embedding_modelo=MODELO_EMBEDDING,
                    embedding_hash=hash_novo,
                )
            else:
                # O vetor antigo descreve um texto que nao existe mais: mante-lo
                # faria o registro ser recuperado pelo conteudo ja apagado.
                self.repo.limpar_embedding(id_conhecimento)
                indexado = False

        cache.invalidar()

        resultado = self.obter(id_conhecimento)
        if not indexado:
            resultado["aviso"] = self._AVISO_SEM_INDICE
        return resultado

    def definir_ativo(self, id_conhecimento, ativo, autor) -> dict:
        if not self.repo.obter(id_conhecimento):
            raise ConhecimentoError("Treinamento nao encontrado.", 404)

        self.repo.definir_ativo(
            id_conhecimento=id_conhecimento, ativo=ativo, atualizado_por=autor
        )
        cache.invalidar()
        return self.obter(id_conhecimento)

    def reindexar(self, id_conhecimento=None) -> dict:
        """Um registro, ou todos os que estao sem vetor / com vetor de outro modelo.

        Nao reindexa o que ja esta em dia -- clicar duas vezes no botao nao
        deve custar uma nova rodada de API.
        """
        if id_conhecimento is not None:
            linha = self.repo.obter(id_conhecimento)
            if not linha:
                raise ConhecimentoError("Treinamento nao encontrado.", 404)
            alvos = [linha]
        else:
            alvos = self.repo.listar_pendentes_embedding(MODELO_EMBEDDING)

        if not alvos:
            return {"indexados": 0, "pendentes": 0, "total": 0}

        textos = [texto_para_embedding(linha) for linha in alvos]
        vetores = gerar_embeddings(textos)
        if vetores is None:
            raise ConhecimentoError(
                "A indexacao semantica esta indisponivel no momento. Tente novamente.",
                503,
            )

        indexados = 0
        for linha, texto, vetor in zip(alvos, textos, vetores):
            try:
                self.repo.gravar_embedding(
                    id_conhecimento=linha["ID_CONHECIMENTO"],
                    embedding=serializar(vetor),
                    embedding_modelo=MODELO_EMBEDDING,
                    embedding_hash=hash_conteudo(texto),
                )
                indexados += 1
            except Exception:
                traceback.print_exc()

        cache.invalidar()
        pendentes = len(self.repo.listar_pendentes_embedding(MODELO_EMBEDDING))
        return {"indexados": indexados, "pendentes": pendentes, "total": len(alvos)}

    # ------------------------------------------------------------------ #
    # Apoio
    # ------------------------------------------------------------------ #

    _AVISO_SEM_INDICE = (
        "Treinamento salvo, mas a indexacao semantica falhou. "
        "Ele ainda sera encontrado por palavras-chave; use Reindexar para completar."
    )

    def _validar(self, dados) -> dict:
        carteira = str(dados.get("carteira") or "").strip()
        produto = str(dados.get("produto") or "").strip()
        texto = str(dados.get("texto") or "").strip()

        if not carteira:
            raise ConhecimentoError("Informe a carteira.")
        if not produto:
            raise ConhecimentoError("Informe o produto.")
        if not texto:
            raise ConhecimentoError("Informe o conteudo do treinamento.")
        if len(texto) > TAMANHO_MAXIMO_TEXTO:
            raise ConhecimentoError(
                f"O conteudo passa de {TAMANHO_MAXIMO_TEXTO} caracteres. "
                "Quebre em treinamentos menores -- trechos curtos sao recuperados "
                "com mais precisao."
            )

        sinonimos = dados.get("sinonimos") or []
        if isinstance(sinonimos, str):
            sinonimos = [parte.strip() for parte in sinonimos.split(",")]
        sinonimos = [str(item).strip() for item in sinonimos if str(item).strip()]

        return {
            "carteira": carteira.upper(),
            "produto": produto,
            "categoria": str(dados.get("categoria") or "").strip() or None,
            "descricao": str(dados.get("descricao") or "").strip() or None,
            "texto": texto,
            "sinonimos": sinonimos,
        }

    @staticmethod
    def _mapear(linha) -> dict:
        sinonimos = linha.get("SINONIMOS")
        try:
            sinonimos = json.loads(sinonimos) if sinonimos else []
        except (ValueError, TypeError):
            sinonimos = []

        atualizado_em = linha.get("ATUALIZADO_EM")
        return {
            "id": linha.get("ID_CONHECIMENTO"),
            "carteira": linha.get("CARTEIRA"),
            "produto": linha.get("PRODUTO"),
            "categoria": linha.get("CATEGORIA") or "",
            "descricao": linha.get("DESCRICAO") or "",
            "texto": linha.get("TEXTO") or "",
            "sinonimos": sinonimos if isinstance(sinonimos, list) else [],
            "ativo": bool(linha.get("ATIVO")),
            "origem": linha.get("ORIGEM"),
            "indexado": bool(linha.get("INDEXADO")),
            "atualizado_por": linha.get("ATUALIZADO_POR"),
            "atualizado_em": (
                atualizado_em.isoformat()
                if hasattr(atualizado_em, "isoformat")
                else (str(atualizado_em) if atualizado_em else None)
            ),
        }

    @staticmethod
    def _inteiro(valor, padrao):
        try:
            return int(valor)
        except (TypeError, ValueError):
            return padrao

    @staticmethod
    def _verdadeiro(valor, padrao=False):
        if valor is None:
            return padrao
        return str(valor).strip().lower() in {"1", "true", "sim", "on", "yes"}
