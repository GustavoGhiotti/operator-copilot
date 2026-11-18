import re
from src.infrastructure.repositories.sql_ia_repository import *
from src.shared.ia.aurora_prompt import montar_prompt
from src.shared.ia.aurora_base_conhecimento import buscar_conhecimento_relevante,formatar_conhecimento_para_prompt
from src.shared.openai_client import client
from src.shared.storage.conversation_memory import MAX_MESSAGES, conversation_histories
from src.shared.storage.treinamento_session import get_cliente,set_cliente,clear_cliente
from src.infrastructure.repositories.sql_ia_repository import *
from src.shared.ia.treinamento_prompts import avaliador_feedback_prompt, avaliador_prompt, prompt_inicial_cliente, prompt_tom_operador, system_prompt
from src.shared.ia.aurora_avaliador_prompt import prompt_avaliacao,prompt_feedback_final
from src.shared.ia.temas_perguntas import TEMA_PADRAO,lista_temas_para_prompt,temas_permitidos
from src.shared.utils.regras_treinamento import carregar_regras_treinamento,formatar_regras_para_prompt
from src.shared.utils.personalidades import escolher_perfil_cliente, ajustar_humor_atual, gerar_nome_aleatorio
from datetime import date
from src.domain.helpers.insights_helpers import resumir_operador,gerar_insights_batch,calcular_metricas,calcular_comparativos,gerar_resumo_geral_time
from concurrent.futures import ThreadPoolExecutor


import json,random
from src.application.services.simulacao_service import *
# from datetime import datetime
# from src.shared.storage.clientes_sessao import get_cliente,set_cliente,clear_cliente
# from src.shared.ia.treinamento_prompts import (
#     prompt_inicial_cliente,
#     prompt_tom_operador,
#     prompt_cliente_dinamico,
#     prompt_avaliador,
#     prompt_feedback
# )
# from src.shared.simulacao.simulacao_repo import criar_simulacao,salvar_mensagem,finalizar_simulacao
# from src.shared.utils.humor import ajustar_humor_atual
from src.shared.utils.evento_decisao import get_evento_aleatorio




class IADesempenhoService:
    def obter_kpis(self, operador: str):
        alvo = (operador or "").strip()
        if not alvo:
            raise ValueError("OPERADOR é obrigatório")

        return IADesempenhoRepository().buscar_kpis(alvo)

    def executar(
        self,
        operador: str,
        pergunta: str,
        is_admin: bool,
        centro_custo: str | None = None,
        conversa_id: str | None = None
    ):
        ia = IADesempenhoRepository()

        # Antes de salvar a pergunta: `salvar_mensagem_bd` grava a pergunta
        # atual, e ela apareceria duas vezes no prompt (no historico e na
        # mensagem do usuario).
        history = self._historico_da_conversa(operador, conversa_id, ia)

        historico_cliente = self._buscar_historico_cliente(pergunta)

        alvo = self._resolver_alvo(operador,pergunta,is_admin)

        kpis = ia.buscar_kpis(alvo)
        conhecimentos_carteira = buscar_conhecimento_relevante(
            centro_custo=centro_custo,
            pergunta=pergunta
        )

        contexto = {
            "usuario_consultando": operador,
            "is_admin": is_admin,
            "alvo": alvo,
            "kpis": kpis,
            "historico_cliente": historico_cliente,
            "centro_custo": centro_custo,
            # So o rastro do que foi usado. O conteudo do treinamento vai uma
            # unica vez, na mensagem do usuario -- antes ele ia tres vezes
            # (lista, texto formatado e bloco de instrucao), gastando milhares
            # de tokens por chamada em repeticao pura.
            "conhecimentos_usados": [
                {"produto": item["produto"], "score": item.get("score")}
                for item in conhecimentos_carteira
            ]
        }

        system_prompt = montar_prompt()

        ia.salvar_mensagem_bd(
            operador,
            pergunta,
            True,
            conversa_id,
            centro_custo
        )
        analise_pergunta = self._classificar_e_salvar_pergunta(
            operador=operador,
            pergunta=pergunta,
            centro_custo=centro_custo,
            conversa_id=conversa_id
        )

        mensagem_usuario = self._montar_mensagem_usuario(
            operador=operador,
            is_admin=is_admin,
            alvo=alvo,
            centro_custo=centro_custo,
            kpis=kpis,
            historico_cliente=historico_cliente,
            conhecimentos=conhecimentos_carteira,
            pergunta=pergunta
        )

        # O historico entra SEMPRE. Descarta-lo quando havia treinamento
        # quebrava o follow-up mais comum do chat ("e se ele recusar?"): a
        # pergunta seguinte chegava sem nenhum fio da conversa.
        messages = [
            {"role":"system","content":system_prompt},
            *history,
            {"role":"user","content":mensagem_usuario}
        ]

        resposta = client.chat.completions.create(model="gpt-4o-mini",messages=messages,temperature=0.2)

        texto = resposta.choices[0].message.content

        memoria = conversation_histories.get(operador,[])
        memoria.append({"role":"user","content":pergunta})
        memoria.append({"role":"assistant","content":texto})
        resposta_id = ia.salvar_mensagem_bd(
            operador,
            texto,
            False,
            conversa_id,
            centro_custo
        )

        conversation_histories[operador] = memoria[-MAX_MESSAGES:]

        contexto["analise_pergunta"] = analise_pergunta
        contexto["resposta_id"] = resposta_id

        return texto,contexto

    def _historico_da_conversa(self, operador: str, conversa_id: str | None, ia):
        """Ultimas trocas da conversa, preferindo o banco a memoria do processo.

        `conversation_histories` e um dict em memoria: com varios workers
        gunicorn, a proxima pergunta do mesmo operador pode cair em outro
        processo e encontrar historico vazio. O banco ja guarda a conversa
        inteira por CONVERSA_ID, e o frontend ja envia esse id.
        """
        if conversa_id:
            try:
                linhas = ia.buscar_mensagens_conversa(conversa_id) or []
            except Exception:
                linhas = []

            if linhas:
                return [
                    {
                        "role": "user" if linha.get("IS_USER") else "assistant",
                        "content": linha.get("MENSAGEM") or ""
                    }
                    for linha in linhas
                    if linha.get("MENSAGEM")
                ][-10:]

        return conversation_histories.get(operador,[])[-10:]

    def _montar_mensagem_usuario(
        self,
        *,
        operador: str,
        is_admin: bool,
        alvo: str,
        centro_custo: str | None,
        kpis: dict,
        historico_cliente: list,
        conhecimentos: list,
        pergunta: str
    ) -> str:
        """Contexto em markdown rotulado, no lugar do `repr` de dict Python.

        O formato antigo mandava `{'kpis': {'total_pago': 1234.5, ...}}` para o
        modelo, misturando chave de codigo com dado. Secoes com titulo sao lidas
        como informacao, e nao como ruido de serializacao.
        """
        partes = [
            "## CONTEXTO",
            f"Usuario consultando: {operador}",
            f"Perfil: {'supervisor' if is_admin else 'operador'}",
            f"Operador alvo dos KPIs: {alvo}",
            f"Carteira: {centro_custo or 'nao informada'}",
            "",
            "## KPIS DO MES (operador alvo)",
            f"- Total pago: R$ {kpis.get('total_pago', 0):,.2f}",
            f"- Total risco pago: R$ {kpis.get('total_risco_pago', 0):,.2f}",
            f"- Total em acordos: R$ {kpis.get('total_acordo', 0):,.2f}",
            f"- Registros: {kpis.get('qtd_registros', 0)}",
        ]

        if historico_cliente:
            partes.append("")
            partes.append("## HISTORICO DO CLIENTE (ultimos 30 dias)")
            # Um CPF muito acionado tem centenas de linhas; sem o corte, o
            # historico sozinho consumiria a janela de contexto.
            for linha in historico_cliente[:20]:
                partes.append(
                    f"- {linha.get('data')} | {linha.get('acao')} "
                    f"| acordo R$ {linha.get('vl_acordo', 0):,.2f}"
                )
            if len(historico_cliente) > 20:
                partes.append(
                    f"- (+{len(historico_cliente) - 20} acionamentos mais antigos)"
                )

        if conhecimentos:
            partes.append("")
            partes.append("## TREINAMENTO OFICIAL DA CARTEIRA")
            partes.append(formatar_conhecimento_para_prompt(conhecimentos))
            partes.append("")
            partes.append(
                "INSTRUCAO OBRIGATORIA: responda usando esse treinamento oficial "
                "como fonte principal. Nao substitua por um roteiro generico. "
                "Se houver exemplo de fala, inclua o exemplo ou adapte apenas os "
                "campos variaveis."
            )

        partes.append("")
        partes.append("## PERGUNTA")
        partes.append(pergunta)

        return "\n".join(partes)

    def simular(self, *, centro_custo: str, pergunta: str):
        """A resposta que o operador receberia, sem gravar nada.

        Existe para a tela @Treinamentos: quem escreve o treinamento precisa
        ver o texto final, nao so quais fichas foram recuperadas. Recuperar a
        ficha certa e produzir uma resposta boa sao coisas diferentes, e so a
        segunda e o que o operador le.

        Deliberadamente NAO persiste: nao grava em TB_CHAT_MENSAGENS_IA nem
        classifica o topico. Teste de curadoria contaminando a base de analise
        estragaria justamente o dado que diz quais duvidas os operadores tem de
        verdade -- e essa base e o que vai orientar a proxima ficha a escrever.

        Reusa `_montar_mensagem_usuario` de proposito: um prompt paralelo, so
        para teste, divergiria do real com o tempo e a tela passaria a mentir.
        Os KPIs vao zerados porque nao ha operador alvo; a resposta sobre
        treinamento nao depende deles.
        """
        conhecimentos = buscar_conhecimento_relevante(
            centro_custo=centro_custo,
            pergunta=pergunta
        )

        kpis_neutros = {
            "total_pago": 0.0,
            "total_risco_pago": 0.0,
            "total_acordo": 0.0,
            "qtd_registros": 0,
        }

        mensagem_usuario = self._montar_mensagem_usuario(
            operador="(simulacao)",
            is_admin=False,
            alvo="(simulacao)",
            centro_custo=centro_custo,
            kpis=kpis_neutros,
            historico_cliente=[],
            conhecimentos=conhecimentos,
            pergunta=pergunta
        )

        resposta = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": montar_prompt()},
                {"role": "user", "content": mensagem_usuario}
            ],
            temperature=0.2
        )

        return resposta.choices[0].message.content, conhecimentos

    def registrar_feedback_resposta(
        self,
        mensagem_id: int,
        operador: str,
        resposta_util: bool
    ):
        if resposta_util is None:
            raise ValueError("resposta_util e obrigatorio")

        return IADesempenhoRepository().registrar_feedback_resposta(
            mensagem_id=mensagem_id,
            operador=operador,
            resposta_util=bool(resposta_util)
        )

    def _buscar_historico_cliente(self,pergunta: str):
        match = re.search(r"\b\d{11}\b",pergunta)

        if not match:
            return []

        return IADesempenhoRepository().buscar_historico_cliente(match.group(0))

    def _resolver_alvo(self,operador: str,pergunta: str,is_admin: bool):
        if not is_admin:
            return operador

        match = re.search(r"(operador(a)?|colaborador(a)?|agente)\s+([A-Za-zÀ-ÿ\s]+)",pergunta,re.IGNORECASE)

        return match.group(4).strip() if match else operador

    def _classificar_e_salvar_pergunta(
        self,
        operador: str,
        pergunta: str,
        centro_custo: str | None,
        conversa_id: str | None
    ):
        ia = IADesempenhoRepository()
        analise = self._classificar_pergunta(pergunta, centro_custo)
        topico = analise.get("topico") or "Outros"
        justificativa = analise.get("justificativa")

        ia.salvar_analise_pergunta(
            operador=operador,
            carteira=centro_custo,
            conversa_id=conversa_id,
            pergunta=pergunta,
            topico=topico,
            justificativa=justificativa
        )

        return {
            "topico": topico,
            "justificativa": justificativa,
            "carteira": centro_custo,
            "conversa_id": conversa_id
        }

    def _classificar_pergunta(self, pergunta: str, centro_custo: str | None):
        prompt = f"""
        Você é uma IA classificadora de dúvidas de operadores de cobrança.

        Sua tarefa é ler a pergunta do operador e classificá-la em apenas um tópico principal.

        Tópicos permitidos:
{lista_temas_para_prompt()}

        Regras:
        - Responda somente JSON válido.
        - Escolha o tópico mais provável.
        - Considere que a carteira/centro de custo do operador é: "{centro_custo or 'Não informado'}".
        - Seja objetiva na justificativa.

        Formato de saída:
        {{
          "topico": "Nome do tópico",
          "justificativa": "Resumo curto do motivo da classificação"
        }}
        """

        try:
            resposta = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role":"system","content":prompt},
                    {"role":"user","content":pergunta}
                ],
                temperature=0,
                response_format={"type":"json_object"}
            )
            conteudo = (resposta.choices[0].message.content or "").strip()
            analise = json.loads(conteudo)
        except Exception:
            analise = {
                "topico":TEMA_PADRAO,
                "justificativa":"Classificação automática indisponível no momento."
            }

        topico = str(analise.get("topico") or TEMA_PADRAO).strip()
        justificativa = str(analise.get("justificativa") or "").strip() or None

        if topico not in temas_permitidos():
            topico = TEMA_PADRAO

        return {
            "topico": topico,
            "justificativa": justificativa
        }
    
class IATreinamentoService:
    def executar(self,operador: str,mensagem: str,historico: list,centro_custo: str):
        regras = formatar_regras_para_prompt(carregar_regras_treinamento(centro_custo))

        cliente = get_cliente(operador)

        if not cliente and (mensagem == "" or mensagem.lower() == "iniciar"):
            return self._iniciar_sessao(operador,centro_custo,regras)

        return self._continuar_sessao(operador,mensagem,historico,cliente,centro_custo,regras)
    
    def _iniciar_sessao(self,operador: str,centro_custo: str,regras: str):        
        perfil = escolher_perfil_cliente()
        dias_atraso = random.randint(15,120)
        valor_divida = round(random.uniform(500,10000),2)
        valor_pagamento = round(valor_divida*random.uniform(0.1,0.4),2)
        categoria = random.choice([
            "estressado_no_trabalho",
            "mãe_ocupada",
            "idoso_confuso",
            "estudante_apressado",
            "autonomo_com_despesas",
            "recém_desempregado",
            "pessoa_endividada_com_varias_contas",
            "cliente_em_transito",
            "cliente_doente_ou_cansado"
        ])

        prompt = prompt_inicial_cliente(perfil,dias_atraso,valor_divida,valor_pagamento,categoria,regras)

        resposta = client.chat.completions.create(model="gpt-4o-mini",messages=[{"role":"system","content":prompt}],temperature=0.5)
        raw = resposta.choices[0].message.content.replace("```json","").replace("```","").strip()

        try:
            cliente = json.loads(raw)
        except:
            cliente = {}

        cliente.update({
            "perfil":perfil,
            "dias_atraso":dias_atraso,
            "valor_divida":valor_divida,
            "valor_pagamento":valor_pagamento,
            "categoria_dificuldade":categoria
        })

        id_simulacao = SimulacaoService().criar_simulacao(operador,centro_custo)
        cliente["id_simulacao"] = id_simulacao

        set_cliente(operador,cliente)
        IATreinamentoRepository().salvar_mensagem(id_simulacao,"cliente",cliente.get("fala_inicial",""))

        return {
            "resposta":cliente.get("fala_inicial"),
            "cliente":cliente,
            "finalizar":False,
            "feedback":None,
            "resumo":None
        }
    
    def _continuar_sessao(self,operador: str,mensagem: str,historico: list,cliente: dict,centro_custo: str,regras: str):
        tom = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"system","content":prompt_tom_operador(mensagem)}],
            temperature=0
        ).choices[0].message.content.strip().lower()

        cliente["humor"] = ajustar_humor_atual(cliente.get("humor","neutro"),tom)

        resposta_cliente = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role":"system",
                "content":system_prompt(
                    cliente["nome"],
                    cliente["valor_divida"],
                    cliente["dias_atraso"],
                    cliente["valor_pagamento"],
                    cliente["categoria_dificuldade"],
                    cliente["perfil"]
                )
            }],
            temperature=0.5
        )

        texto = resposta_cliente.choices[0].message.content.strip()
        IATreinamentoRepository().salvar_mensagem(cliente["id_simulacao"],"operador",mensagem)
        IATreinamentoRepository().salvar_mensagem(cliente["id_simulacao"],"cliente",texto)

        avaliacao = json.loads(client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role":"system",
                "content":avaliador_prompt(
                    cliente["valor_divida"],
                    cliente["dias_atraso"],
                    cliente["valor_pagamento"],
                    centro_custo,
                    regras,
                    historico,
                    mensagem,
                    cliente.get("ultimo_cliente")
                )
            }],
            temperature=0
        ).choices[0].message.content)

        feedback = json.loads(client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role":"system",
                "content":avaliador_feedback_prompt(
                    centro_custo,
                    regras,
                    historico,
                    mensagem,
                    cliente.get("ultimo_cliente")
                )
            }],
            temperature=0
        ).choices[0].message.content)

        if avaliacao.get("finalizar"):
            IATreinamentoRepository().finalizar_simulacao(cliente["id_simulacao"],feedback)
            clear_cliente(operador)

        return {
            "resposta":texto,
            "chance_acordo":avaliacao.get("chance_acordo"),
            "fase":avaliacao.get("fase"),
            "comentario":avaliacao.get("comentario"),
            "finalizar":avaliacao.get("finalizar",False),
            "resumo":avaliacao.get("resumo"),
            "cliente":cliente,
            "evento":get_evento_aleatorio(),
            "feedback_final":feedback if avaliacao.get("finalizar") else None
        }

class IAInsightsService:
    def executar(self,supervisor: str,centro_custo: str):
        dados = IAInsightsRepository().buscar(centro_custo)

        if not dados:
            return {
                "data_analise":date.today().strftime("%d/%m/%Y"),
                "resumo_geral":f"Nenhum operador encontrado para a carteira {centro_custo}.",
                "operadores":[]
            }

        operadores = {}
        for r in dados:
            nome = r["NM_USUARIO"]
            operadores.setdefault(nome,[]).append({
                "data":str(r["DIA"]),
                "cpc":int(r["QTD_CPC"] or 0),
                "acordos":int(r["QTD_ACORDOS"] or 0),
                "total_pago":float(r["TOTAL_PAGO"] or 0),
                "total_risco_pago":float(r["TOTAL_RISCO_PAGO"] or 0),
                "total_acordo":float(r["TOTAL_ACORDO"] or 0)
            })

        operadores_compactados = [resumir_operador(nome,hist) for nome,hist in operadores.items() if hist]

        tamanho_lote = 20
        subsets = [operadores_compactados[i:i+tamanho_lote] for i in range(0,len(operadores_compactados),tamanho_lote)]

        with ThreadPoolExecutor(max_workers=4) as executor:
            resultados = list(executor.map(lambda subset: gerar_insights_batch(centro_custo,subset),subsets))

        operadores_out = [op for sub in resultados for op in sub]

        for op in operadores_out:
            hist = operadores.get(op["nome"])
            op["metricas"] = calcular_metricas(hist) if hist else {
                "acordos_hoje":0,
                "acordos_ontem":0,
                "valor_total":0,
                "taxa_conversao":0
            }
            op["comparativos"] = calcular_comparativos(hist) if hist else {}

        resumo_geral = gerar_resumo_geral_time(centro_custo,operadores_out)

        return {
            "data_analise":date.today().strftime("%d/%m/%Y"),
            "resumo_geral":resumo_geral,
            "operadores":operadores_out
        }
