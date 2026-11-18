import unicodedata
import uuid

from src.infrastructure.repositories.sql_roteiro_repository import RoteiroRepository


TABULACAO_FLUXO_ID = "F2D0138C-DE94-408B-9DA6-F2620E4CA12C"
SITUACOES_FLUXO_ID = "61EBDDA3-2C8F-4F09-8C88-C24F04F49BBA"

# Fluxos que alimentam as abas fixas do roteiro do operador.
#
# Eles nao sao roteiros de atendimento: sao o conteudo das abas Tabulacoes,
# Outras Situacoes, Banco de Argumentacao e Canais de Atendimento. Apagar um
# deles deixa a aba correspondente em branco para todo mundo, e renomear tem o
# mesmo efeito -- a aba encontra o fluxo pelo nome. Por isso os dois caminhos
# ficam bloqueados aqui, no servidor, e nao so escondidos na tela.
#
# A chave e o nome normalizado; o valor e como a aba se chama. "Situacoes
# Adversas" e "outras_situacoes" apontam para o mesmo rotulo porque o cadastro
# usa o primeiro e a tela nasceu falando o segundo.
FLUXOS_FIXOS = {
    "tabulacoes": "Tabulações",
    "situacoes_adversas": "Outras Situações",
    "outras_situacoes": "Outras Situações",
    "banco_de_argumentacao": "Banco de Argumentação",
    "canais_de_atendimento": "Canais de Atendimento",
}


def validar_nomes_do_fluxo(tipo_ligacao, tipo_cliente, produto):
    """Erro (corpo, status) se algum nome estiver em branco; None se estiver ok.

    As tres colunas sao NOT NULL, mas string vazia passa -- e passava mesmo. O
    resultado sao fluxos sem nome nenhum: eles somem dos combos (que filtram
    vazio), continuam ocupando a lista do builder como uma linha em branco e
    nenhuma aba consegue encontra-los, apesar de terem conteudo dentro.

    Vale tanto na criacao quanto na atualizacao: o autosave do builder reenvia
    os tres nomes a cada edicao de mensagem, entao um campo apagado na tela
    apagaria o nome no banco.
    """
    faltando = [
        rotulo
        for rotulo, valor in (
            ("tipo de ligação", tipo_ligacao),
            ("tipo de cliente", tipo_cliente),
            ("produto", produto),
        )
        if not str(valor or "").strip()
    ]

    if not faltando:
        return None

    return {
        "erro": (
            "Um fluxo precisa de "
            + ", ".join(faltando)
            + ". Sem isso ele fica invisível para os operadores."
        )
    }, 400


def chave_do_fluxo(tipo_ligacao, tipo_cliente, produto):
    """A identidade de um fluxo: os tres nomes, normalizados."""
    return (
        normalizar_nome_fluxo(tipo_ligacao),
        normalizar_nome_fluxo(tipo_cliente),
        normalizar_nome_fluxo(produto),
    )


def conflito_de_nome(repo, tipo_ligacao, tipo_cliente, produto, ignorar_id=None):
    """Erro (corpo, status) se outro fluxo ja usa essa combinacao.

    O trio produto + tipo de cliente + tipo de ligacao e o que o operador
    escolhe nos filtros: repetido, dois roteiros diferentes viram a mesma opcao
    e nao ha como saber qual vai abrir. Foi assim que tres fluxos distintos --
    incluindo o das Outras Situacoes -- acabaram todos como "Habitacional /
    Fisica / Ativa".

    `ignorar_id` deixa o proprio fluxo de fora: salvar sem mudar o nome nao
    pode virar conflito consigo mesmo.
    """
    alvo = chave_do_fluxo(tipo_ligacao, tipo_cliente, produto)

    for linha in repo.listar_fluxos() or []:
        if ignorar_id and str(linha.get("ID_FLUXO")) == str(ignorar_id):
            continue

        atual = chave_do_fluxo(
            linha.get("TIPO_LIGACAO"),
            linha.get("TIPO_CLIENTE"),
            linha.get("PRODUTO"),
        )
        if atual == alvo:
            return {
                "erro": (
                    f"Já existe um fluxo com produto \"{produto}\", cliente "
                    f"\"{tipo_cliente}\" e ligação \"{tipo_ligacao}\". Use uma "
                    "combinação diferente: é ela que o operador escolhe nos "
                    "filtros."
                )
            }, 409

    return None


def normalizar_nome_fluxo(valor):
    """Minusculo, sem acento e com espaco virando "_" -- igual ao frontend."""
    texto = unicodedata.normalize("NFD", str(valor or "").lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return "_".join(texto.split())


def rotulo_fluxo_fixo(*valores):
    """Rotulo da aba se algum dos valores nomeia um fluxo fixo; senao, None."""
    for valor in valores:
        rotulo = FLUXOS_FIXOS.get(normalizar_nome_fluxo(valor))
        if rotulo:
            return rotulo
    return None


def rotulo_fixo_da_linha(linha):
    return rotulo_fluxo_fixo(
        linha.get("PRODUTO"),
        linha.get("TIPO_CLIENTE"),
        linha.get("TIPO_LIGACAO"),
    )


def rotulo_fixo_por_id(repo, id_fluxo):
    """Rotulo da aba do fluxo com este id, ou None se ele nao for fixo."""
    for linha in repo.listar_fluxos() or []:
        if str(linha.get("ID_FLUXO")) == str(id_fluxo):
            return rotulo_fixo_da_linha(linha)
    return None


def normalizar_identificador_fluxo(valor):
    if valor is None:
        return None

    texto = " ".join(str(valor).split()).strip()
    if not texto:
        return ""

    return texto.title()


class ListarTiposLigacaoService:
    def executar(self):
        rows = RoteiroRepository().listar_tipos_ligacao() or []
        return self._formatar_select(rows, "tipo_ligacao")

    @staticmethod
    def _formatar_select(rows, campo):
        data = []
        vistos = set()

        for row in rows:
            valor = row.get(campo)
            if not valor:
                continue

            valor = str(valor).strip()
            if not valor:
                continue

            chave = valor.casefold()
            if chave in vistos:
                continue

            vistos.add(chave)
            data.append({"id": valor, "nome": valor})

        return data


class ListarProdutosService:
    def executar(self):
        rows = RoteiroRepository().listar_produtos() or []
        return ListarTiposLigacaoService._formatar_select(rows, "produto")


class ListarTiposClienteService:
    def executar(self):
        rows = RoteiroRepository().listar_tipos_cliente() or []
        return ListarTiposLigacaoService._formatar_select(rows, "tipo_cliente")


class ListarFluxosService:
    def executar(self, tipo_ligacao=None, produto=None, tipo_cliente=None):
        rows = RoteiroRepository().listar_fluxos(
            tipo_ligacao=tipo_ligacao,
            produto=produto,
            tipo_cliente=tipo_cliente,
        ) or []

        return [
            {
                "id_fluxo": row.get("ID_FLUXO"),
                "tipo_ligacao": row.get("TIPO_LIGACAO") or "",
                "tipo_cliente": row.get("TIPO_CLIENTE") or "",
                "produto": row.get("PRODUTO") or "",
                # A tela usa isto para nao oferecer "excluir" nem deixar
                # renomear. A regra mora aqui para nao virar uma copia da
                # lista de nomes no frontend.
                "fixo": rotulo_fixo_da_linha(row) is not None,
                "rotulo_fixo": rotulo_fixo_da_linha(row),
            }
            for row in rows
            if row.get("ID_FLUXO")
        ]


#: As abas do roteiro do operador, na ordem em que aparecem.
#:
#: `nomes` sao os apelidos historicos usados para achar o fluxo pelo nome.
#: Continuam valendo como fallback: enquanto ninguem vincular a aba na tela --
#: ou enquanto a tabela de vinculo nao existir no ambiente -- a resolucao e a
#: mesma de antes, e nada muda de comportamento.
ABAS_ROTEIRO = [
    {"aba": "tabulacoes", "rotulo": "Tabulações", "nomes": ["Tabulações"]},
    {
        "aba": "outras_situacoes",
        "rotulo": "Outras Situações",
        "nomes": ["Situaçoes Adversas", "Situações Adversas", "Outras Situações"],
    },
    {
        "aba": "banco_de_argumentacao",
        "rotulo": "Banco de Argumentação",
        "nomes": ["Banco de Argumentação"],
    },
    {
        "aba": "canais_de_atendimento",
        "rotulo": "Canais de Atendimento",
        "nomes": ["Canais de Atendimento"],
    },
]


class ListarAbasRoteiroService:
    """Qual fluxo alimenta cada aba, e de onde veio essa decisao.

    `origem` diz se o vinculo foi escolhido na tela ("vinculo") ou deduzido do
    nome do fluxo ("nome"). A tela mostra isso para o gestor saber se aquilo
    esta preso de proposito ou so por coincidencia de nome.
    """

    def executar(self):
        repo = RoteiroRepository()

        fluxos = repo.listar_fluxos() or []
        por_id = {str(linha.get("ID_FLUXO")): linha for linha in fluxos}

        vinculos = {
            str(linha.get("ABA") or ""): str(linha.get("ID_FLUXO") or "")
            for linha in repo.listar_abas()
        }

        resultado = []
        for definicao in ABAS_ROTEIRO:
            id_vinculado = vinculos.get(definicao["aba"]) or ""
            fluxo = por_id.get(id_vinculado)
            origem = "vinculo" if fluxo else None

            if not fluxo:
                aceitos = {normalizar_nome_fluxo(n) for n in definicao["nomes"]}
                fluxo = next(
                    (
                        linha
                        for linha in fluxos
                        if aceitos
                        & {
                            normalizar_nome_fluxo(linha.get("PRODUTO")),
                            normalizar_nome_fluxo(linha.get("TIPO_CLIENTE")),
                            normalizar_nome_fluxo(linha.get("TIPO_LIGACAO")),
                        }
                    ),
                    None,
                )
                origem = "nome" if fluxo else "sem-fluxo"

            resultado.append(
                {
                    "aba": definicao["aba"],
                    "rotulo": definicao["rotulo"],
                    "id_fluxo": str(fluxo.get("ID_FLUXO")) if fluxo else None,
                    "produto": (fluxo or {}).get("PRODUTO") or "",
                    "origem": origem,
                    "editavel": repo.estrutura_aba_disponivel(),
                }
            )

        return resultado


class DefinirAbaRoteiroService:
    def executar(self, aba, id_fluxo, definido_por=""):
        chave = str(aba or "").strip()
        if chave not in {item["aba"] for item in ABAS_ROTEIRO}:
            return {"erro": "Aba desconhecida."}, 400

        repo = RoteiroRepository()

        if not repo.estrutura_aba_disponivel():
            return {
                "erro": (
                    "A tabela de vínculo das abas ainda não existe neste "
                    "ambiente. Rode backend/scripts/roteiro_abas.sql."
                )
            }, 409

        id_limpo = str(id_fluxo or "").strip() or None

        if id_limpo and not repo.fluxo_existe(id_limpo):
            return {"erro": "Fluxo não encontrado."}, 404

        repo.definir_aba(chave, id_limpo, str(definido_por or "")[:20])
        return {"aba": chave, "id_fluxo": id_limpo, "status": "Aba vinculada!"}


class BuscarFluxoInicialService:
    @staticmethod
    def _montar_fluxo(rows, tipo_ligacao, produto, tipo_cliente):
        if not rows:
            return None

        mensagens = {}
        id_fluxo_encontrado = None

        for row in rows:
            id_fluxo = row["ID_FLUXO"]
            id_mensagem = row["ID_MENSAGEM"]
            id_fluxo_encontrado = id_fluxo

            if id_mensagem not in mensagens:
                mensagens[id_mensagem] = {
                    "id_fluxo": id_fluxo,
                    "id_mensagem": id_mensagem,
                    "titulo": row.get("TITULO"),
                    "tipo_mensagem": row.get("TIPO_MENSAGEM"),
                    "ordem_exibicao": row.get("ORDEM_EXIBICAO"),
                    "mensagem": row.get("MENSAGEM"),
                    "opcoes": [],
                }

            if row.get("ID_OPCAO"):
                mensagens[id_mensagem]["opcoes"].append(
                    {
                        "id_opcao": row["ID_OPCAO"],
                        "texto_opcao": row.get("TEXTO_OPCAO"),
                        "proxima_mensagem_id": row.get("PROXIMA_MENSAGEM_ID"),
                        "acao_especial": row.get("ACAO_ESPECIAL"),
                        "ordem_opcao": row.get("ORDEM_OPCAO") or 0,
                    }
                )

        mensagens_ordenadas = sorted(
            mensagens.values(),
            key=lambda mensagem: mensagem["ordem_exibicao"] or 0,
        )

        for mensagem in mensagens_ordenadas:
            mensagem["opcoes"].sort(key=lambda opcao: opcao["ordem_opcao"])

        primeiro_id_fluxo = (
            mensagens_ordenadas[0]["id_fluxo"]
            if mensagens_ordenadas
            else id_fluxo_encontrado
        )

        return {
            "status": "ok",
            "fluxo": {
                "id_fluxo": primeiro_id_fluxo,
                "tipo_ligacao": tipo_ligacao,
                "tipo_cliente": tipo_cliente,
                "produto": produto,
                "mensagens": mensagens_ordenadas,
            },
        }

    def executar(self, tipo_ligacao, produto, tipo_cliente):
        fluxo = RoteiroRepository().buscar_fluxo(tipo_ligacao, produto, tipo_cliente)
        return self._montar_fluxo(fluxo, tipo_ligacao, produto, tipo_cliente)


class BuscarFluxoPorIdService:
    def executar(self, id_fluxo):
        rows = RoteiroRepository().buscar_fluxo_por_id(id_fluxo)
        if not rows:
            return None

        primeira_linha = rows[0]
        return BuscarFluxoInicialService._montar_fluxo(
            rows,
            primeira_linha.get("TIPO_LIGACAO"),
            primeira_linha.get("PRODUTO"),
            primeira_linha.get("TIPO_CLIENTE"),
        )


class BuscarMensagemService:
    def executar(self, id_mensagem):
        repo = RoteiroRepository()
        mensagem = repo.buscar_mensagem(id_mensagem)

        if not mensagem:
            return None

        opcoes = repo.listar_opcoes_mensagem(id_mensagem) or []

        return {
            "id": mensagem["ID_MENSAGEM"],
            "id_fluxo": mensagem["ID_FLUXO"],
            "ordem_exibicao": mensagem["ORDEM_EXIBICAO"],
            "titulo": mensagem["TITULO"],
            "mensagem": mensagem["MENSAGEM"],
            "opcoes": [
                {
                    "id": opcao["ID_OPCAO"],
                    "texto": opcao["TEXTO_OPCAO"],
                    "proxima_mensagem_id": opcao["PROXIMA_MENSAGEM_ID"],
                }
                for opcao in opcoes
            ],
        }


class AtualizarMensagemService:
    def executar(self, payload):
        repo = RoteiroRepository()

        id_mensagem = payload.get("id") or payload.get("id_mensagem")
        id_fluxo = payload.get("id_fluxo")
        titulo = payload.get("titulo")
        texto_mensagem = (payload.get("mensagem" )) or "nova mensagem "
        opcoes = payload.get("opcoes", [])
        ordem_exibicao = payload.get("ordem_exibicao", 1)

        if not id_mensagem:
            return {"erro": "ID da mensagem não informado"}, 400

        repo.atualizar_mensagem(titulo, texto_mensagem, id_mensagem)

        opcoes_atualizadas = 0
        opcoes_criadas = 0
        mensagens_criadas = 0

        for ordem_atual, opcao in enumerate(opcoes, start=1):
            texto_opcao = opcao.get("texto") or opcao.get("texto_opcao")
            proxima_mensagem_id = opcao.get("proxima_mensagem_id")
            id_opcao = opcao.get("id") or opcao.get("id_opcao")

            if proxima_mensagem_id in (None, "false", "False", "nada"):
                if id_opcao:
                    repo.atualizar_opcao(texto_opcao, None, ordem_atual, id_opcao)
                    opcoes_atualizadas += 1
                else:
                    repo.criar_opcao(
                        str(uuid.uuid4()).upper(),
                        texto_opcao,
                        None,
                        id_mensagem,
                        ordem_atual,
                    )
                    opcoes_criadas += 1
                continue

            if str(proxima_mensagem_id).strip() == "":
                proxima_mensagem_id = str(uuid.uuid4()).upper()
                repo.criar_mensagem(
                    proxima_mensagem_id,
                    id_fluxo,
                    ordem_exibicao + mensagens_criadas + 1,
                    "Nova mensagem",
                    "Nova mensagem criada automaticamente",
                )
                mensagens_criadas += 1

            if id_opcao:
                repo.atualizar_opcao(
                    texto_opcao,
                    proxima_mensagem_id,
                    ordem_atual,
                    id_opcao,
                )
                opcoes_atualizadas += 1
            else:
                repo.criar_opcao(
                    str(uuid.uuid4()).upper(),
                    texto_opcao,
                    proxima_mensagem_id,
                    id_mensagem,
                    ordem_atual,
                )
                opcoes_criadas += 1

        return {
            "id_mensagem": id_mensagem,
            "titulo": titulo,
            "mensagem": texto_mensagem,
            "opcoes_atualizadas": opcoes_atualizadas,
            "opcoes_criadas": opcoes_criadas,
            "mensagens_criadas": mensagens_criadas,
            "status": "Mensagem e opções atualizadas com sucesso!",
        }


class ExcluirOpcaoService:
    def executar(self, id_opcao):
        if not id_opcao:
            return {"erro": "ID da opção não informado"}, 400

        linhas_afetadas = RoteiroRepository().deletar_opcao(id_opcao)
        if not linhas_afetadas:
            return {"erro": "Opção não encontrada"}, 404

        return {"id": id_opcao, "status": "Opção removida com sucesso!"}


class ExcluirMensagemService:
    def executar(self, id_mensagem):
        if not id_mensagem:
            return {"erro": "ID da mensagem não informado"}, 400

        repo = RoteiroRepository()

        # Antes de apagar: as opcoes de OUTRAS mensagens que apontam para esta
        # viram "final do caminho". A FK cuida das opcoes desta mensagem, mas
        # nao pode cuidar dos destinos -- ver o repositorio.
        repo.soltar_referencias_para_mensagem(id_mensagem)

        linhas_afetadas = repo.deletar_mensagem(id_mensagem)
        if not linhas_afetadas:
            return {"erro": "Mensagem não encontrada"}, 404

        return {"id": id_mensagem, "status": "Mensagem removida com sucesso!"}


class ExcluirFluxoService:
    def executar(self, id_fluxo):
        if not id_fluxo:
            return {"erro": "ID do fluxo não informado"}, 400

        repo = RoteiroRepository()

        rotulo = rotulo_fixo_por_id(repo, id_fluxo)
        if rotulo:
            return {
                "erro": (
                    f'O fluxo "{rotulo}" é fixo e não pode ser excluído: ele é '
                    "o conteúdo dessa aba no roteiro do operador. Para esvaziar "
                    "a aba, apague as mensagens dele."
                )
            }, 409

        linhas_afetadas = repo.deletar_fluxo(id_fluxo)
        if not linhas_afetadas:
            return {"erro": "Fluxo não encontrado"}, 404

        return {"id": id_fluxo, "status": "Fluxo removido com sucesso!"}


class AtualizarFluxoService:
    def executar(self, id_fluxo, payload):
        if not id_fluxo:
            return {"erro": "ID do fluxo não informado"}, 400

        tipo_ligacao = normalizar_identificador_fluxo(payload.get("tipo_ligacao"))
        tipo_cliente = normalizar_identificador_fluxo(payload.get("tipo_cliente"))
        produto = normalizar_identificador_fluxo(payload.get("produto"))

        invalido = validar_nomes_do_fluxo(tipo_ligacao, tipo_cliente, produto)
        if invalido:
            return invalido

        repo = RoteiroRepository()

        # Renomear um fluxo fixo apaga a aba tao bem quanto excluir: ela procura
        # o fluxo pelo nome. Trocar entre nomes que continuam apontando para a
        # mesma aba segue permitido ("Situaçoes Adversas" -> "Outras Situações").
        rotulo_atual = rotulo_fixo_por_id(repo, id_fluxo)
        if rotulo_atual:
            rotulo_novo = rotulo_fluxo_fixo(tipo_ligacao, tipo_cliente, produto)
            if rotulo_novo != rotulo_atual:
                return {
                    "erro": (
                        f'O fluxo "{rotulo_atual}" é fixo: renomeá-lo deixaria a '
                        "aba do operador em branco. Mantenha o nome ou peça a "
                        "remoção da aba primeiro."
                    )
                }, 409

        # Só barra quando o nome de fato muda. Os fluxos que já nasceram com o
        # trio repetido continuam salváveis -- senão o autosave do builder
        # travaria justamente neles, que são os que precisam ser arrumados.
        atual = next(
            (
                linha
                for linha in repo.listar_fluxos() or []
                if str(linha.get("ID_FLUXO")) == str(id_fluxo)
            ),
            None,
        )
        mudou = atual is None or chave_do_fluxo(
            atual.get("TIPO_LIGACAO"), atual.get("TIPO_CLIENTE"), atual.get("PRODUTO")
        ) != chave_do_fluxo(tipo_ligacao, tipo_cliente, produto)

        if mudou:
            conflito = conflito_de_nome(
                repo, tipo_ligacao, tipo_cliente, produto, ignorar_id=id_fluxo
            )
            if conflito:
                return conflito

        linhas_afetadas = repo.atualizar_fluxo(
            tipo_ligacao,
            tipo_cliente,
            produto,
            id_fluxo,
        )

        if linhas_afetadas == 0 and not repo.fluxo_existe(id_fluxo):
            return {"erro": "Fluxo não encontrado"}, 404

        return {
            "id_fluxo": id_fluxo,
            "tipo_ligacao": tipo_ligacao,
            "tipo_cliente": tipo_cliente,
            "produto": produto,
            "status": "Fluxo atualizado com sucesso!",
        }


class CriarFluxoService:
    def executar(self, payload):
        tipo_ligacao = normalizar_identificador_fluxo(payload.get("tipo_ligacao"))
        tipo_cliente = normalizar_identificador_fluxo(payload.get("tipo_cliente"))
        produto = normalizar_identificador_fluxo(payload.get("produto"))

        invalido = validar_nomes_do_fluxo(tipo_ligacao, tipo_cliente, produto)
        if invalido:
            return invalido

        repo_conflito = RoteiroRepository()
        conflito = conflito_de_nome(repo_conflito, tipo_ligacao, tipo_cliente, produto)
        if conflito:
            return conflito

        id_fluxo = str(uuid.uuid4()).upper()
        id_mensagem = str(uuid.uuid4()).upper()

        repo = RoteiroRepository()
        repo.criar_fluxo(id_fluxo, tipo_ligacao, tipo_cliente, produto)
        repo.criar_mensagem(
            id_mensagem,
            id_fluxo,
            1,
            "NOVO FLUXO!!!",
            "Esta é a mensagem inicial, modifique para atender suas necessidades.",
        )

        return {
            "status": "Fluxo e mensagem inicial criados com sucesso!",
            "id_fluxo": id_fluxo,
            "id_mensagem_inicial": id_mensagem,
            "tipo_ligacao": tipo_ligacao,
            "tipo_cliente": tipo_cliente,
            "produto": produto,
        }


class CriarMensagemNoFluxoService:
    def executar(self, id_fluxo, payload):
        if not id_fluxo:
            return {"erro": "ID do fluxo não informado"}, 400

        repo = RoteiroRepository()
        ultima_ordem = repo.buscar_ultima_ordem_fluxo(id_fluxo) or {}
        ordem_exibicao = (ultima_ordem.get("ULTIMA_ORDEM") or 0) + 1
        id_mensagem = str(uuid.uuid4()).upper()
        titulo = payload.get("titulo") or "Nova mensagem"
        mensagem = payload.get("mensagem") or "Nova mensagem criada no fluxo."

        repo.criar_mensagem(
            id_mensagem,
            id_fluxo,
            ordem_exibicao,
            titulo,
            mensagem,
        )

        return {
            "status": "Mensagem criada com sucesso!",
            "id_fluxo": id_fluxo,
            "id_mensagem": id_mensagem,
            "ordem_exibicao": ordem_exibicao,
            "titulo": titulo,
            "mensagem": mensagem,
            "opcoes": [],
        }


class CriarMensagemEmFluxoFixoService:
    def executar(self, fluxo_id, titulo, mensagem):
        id_mensagem = str(uuid.uuid4()).upper()

        RoteiroRepository().criar_mensagem(
            id_mensagem,
            fluxo_id,
            1,
            titulo,
            mensagem,
        )

        return {
            "id_mensagem": id_mensagem,
            "id_fluxo": fluxo_id,
            "ordem_exibicao": 1,
            "titulo": titulo,
            "mensagem": mensagem,
            "opcoes": [],
        }


class CriarTabulacaoService:
    def executar(self, titulo, mensagem):
        return CriarMensagemEmFluxoFixoService().executar(
            TABULACAO_FLUXO_ID,
            titulo,
            mensagem,
        )


class CriarSituacaoService:
    def executar(self, titulo, mensagem):
        return CriarMensagemEmFluxoFixoService().executar(
            SITUACOES_FLUXO_ID,
            titulo,
            mensagem,
        )
