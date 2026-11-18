from os import name

from flask import jsonify
from src.infrastructure.repositories.sql_dados_operadores_repository import *
from src.infrastructure.repositories.sql_admin_repository import FeedbacksRepository
from src.infrastructure.repositories.sql_login_repository import LoginRepository
from src.infrastructure.repositories.sql_ia_repository import IADesempenhoRepository
from src.shared.errors.dados_operadores_exceptions import *
from datetime import date, datetime, timedelta
from collections import defaultdict

class DadosOperadoresService:

    def __init__(self):
        self.repo = DadosOperadoresRepository()

    def obter_dados(self, nome_usuario: str):
        if not nome_usuario:
            raise ValueError("Nome do usuário é obrigatório")

        nome_like = f"%{nome_usuario.strip()}%"

        linhas = self.repo.buscar_dados_operadores(nome_like)

        if not linhas:
            return []

        operadores = []
        for row in linhas:
            operadores.append({
                "dia": row["DIA"],
                "semana": row["SEMANA"],
                "mes": row["MES"],
                "carteira": row["CARTEIRA"],
                "operador": row["OPERADOR"],
                "quantidade": row["QUANTIDADE"],
                "valor_entrada": float(row["VALOR_ENTRADA"] or 0),
                "valor_parcela": float(row["VALOR_PARCELA"] or 0),
            })


        return operadores
    
    def obter_carteira_atualizada(self, id_olos_cx: str, id_olos_cob: str):
        try:
            # str(None) vira "None", que passaria pelo teste de vazio e iria
            # para a SP como texto. Normalizar para None de verdade.
            id_olos_cx = str(id_olos_cx or "").strip() or None
            id_olos_cob = str(id_olos_cob or "").strip() or None

            # A SP resolve com um id so: operadores que atuam apenas em cobranca
            # nao tem ID_OLOS_CX, e exigir os dois reprovava justamente eles.
            if not id_olos_cx and not id_olos_cob:
                raise ValueError("Informe ao menos um ID OLOS do usuário")

            obj = self.repo.obter_carteira_atualizada(id_olos_cx, id_olos_cob)

            if not obj:
                return None

            return (obj[0].get("NAME") or "").strip() or None

        except Exception as e:
            print(f"Erro ao obter carteira atualizada: {e}")
            return None

    def obter_carteira_do_operador(
        self,
        operador: str,
        id_olos_cx: str,
        id_olos_cob: str,
    ):
        """Carteira do momento, com a ultima conhecida como rede de seguranca.

        A SP le o estado ao vivo do discador: quando o operador nao esta ativo
        no OLOS na hora da pergunta ela volta vazia, e a pergunta era gravada
        sem carteira e sumia dos relatorios. Nesse caso herdamos a ultima
        carteira que o proprio operador teve, que e a mesma grandeza — o
        CENTRO_CUSTO do cadastro nao serve, discorda do OLOS na maior parte
        dos casos.
        """
        carteira = self.obter_carteira_atualizada(id_olos_cx, id_olos_cob)
        if carteira:
            return carteira

        return IADesempenhoRepository().ultima_carteira_conhecida(operador)

class EstatisticasOperadorService:
    def executar(self,usuario: str):
        resultado = EstatisticasOperadorRepository().buscar(usuario)

        if not resultado:
            return None

        acessos = []

        for row in resultado:
            data_raw = row.get("DATA_LOGIN")
            hora_raw = row.get("HORA_LOGIN")

            if not data_raw or not hora_raw:
                continue

            if isinstance(hora_raw,str):
                hora = datetime.strptime(hora_raw,"%H:%M:%S").time()
            else:
                hora = hora_raw

            acessos.append(datetime.combine(data_raw,hora))

        if not acessos:
            return None

        primeiro_acesso = min(acessos)
        ultimo_acesso = max(acessos)

        acessos_por_dia = {}
        for ac in acessos:
            acessos_por_dia.setdefault(ac.date(),[]).append(ac)

        hoje = datetime.now().date()

        dias_acessados_mes = len([d for d in acessos_por_dia if d.month == hoje.month and d.year == hoje.year])
        dias_acessados_semana = len([d for d in acessos_por_dia if d.isocalendar()[1] == hoje.isocalendar()[1]])

        dias_ordenados = sorted(acessos_por_dia.keys(),reverse=True)
        streak = 1

        for i in range(1,len(dias_ordenados)):
            if (dias_ordenados[i-1] - dias_ordenados[i]).days == 1:
                streak += 1
            else:
                break

        dias_semana_map = ["Seg","Ter","Qua","Qui","Sex","Sab","Dom"]
        acessos_freq = {d:0 for d in dias_semana_map}

        for dia in acessos_por_dia:
            acessos_freq[dias_semana_map[dia.weekday()]] += 1

        return {
            "usuario": usuario,
            "dias_acessados_mes": dias_acessados_mes,
            "dias_acessados_semana": dias_acessados_semana,
            "dias_consecutivos": streak,
            "primeiro_acesso": primeiro_acesso.isoformat(),
            "ultimo_acesso": ultimo_acesso.isoformat(),
            "acessos_total": len(acessos),
            "dias_distintos": len(acessos_por_dia),
            "frequencia_por_dia_semana": [{"dia":k,"frequencia":v} for k,v in acessos_freq.items()]
        }


class ResultadoCPCService:

    def __init__(self):
        self.repo = ResultadoCPCRepository()

    @staticmethod
    def _to_int(value):
        return int(value or 0)

    def obter(self, cpf_operador: str):
        if not cpf_operador:
            raise ValueError("CPF do operador é obrigatório")

        linhas = self.repo.buscar(cpf_operador.strip())

        if not linhas:
            return []

        dados = []
        for row in linhas:
            dados.append({
                "total_cpc": self._to_int(row.get("total_cpc", row.get("CPC_DO_DIA"))),
                "ce_do_dia": self._to_int(row.get("ce_do_dia", row.get("CE_DO_DIA"))),
                "acionamento": self._to_int(row.get("acionamento", row.get("ACIONAMENTO"))),
            })

        return dados
    
class FeedbackResultadoService:
    def executar(self,centro_custo: str,operador_data: dict):
        operador_nome = operador_data.get("name")
        hoje = date.today()
        repo = FeedbackResultadoRepository()

        feedback_cache = repo.buscar_feedback_cache(operador_nome,hoje)

        if feedback_cache:
            return {"feedback":feedback_cache,"cached":True},200

        efetividade = repo.buscar_efetividade_carteira(centro_custo)

        if not efetividade:
            return {"erro":"Nenhum dado encontrado para o centro de custo informado"},404

        medias = self._calcular_medias(efetividade)
        operador_metrics = self._calcular_operador(operador_data,medias)
        prompt = self._montar_prompt(operador_data,operador_metrics,medias)

        feedback = gerar_feedback_ia(prompt)

        repo.salvar_feedback(operador_nome,centro_custo,hoje,feedback)

        return {
            "feedback":feedback,
            "efetividade_operador":operador_metrics["efetividade"],
            "media_acordos_por_op":medias["media_acordos"],
            "media_valor_pago_por_op":medias["media_pago"],
            "media_valor_fechado_por_op":medias["media_fechado"],
            "comparacoes":operador_metrics["comparacoes"],
            "dados":operador_data,
            "cached":False
        },200
    
    def _calcular_medias(self,resultado):
        qtd_acordos = self._numero(resultado.get("QTD_ACORDOS"))
        qtd_ops = self._numero(resultado.get("QTD_OPERADORES"), 1)
        total_fechado = self._numero(resultado.get("TOTAL_FECHADO"))
        total_pago = self._numero(resultado.get("TOTAL_PAGO"))
        qtd_ops = qtd_ops or 1

        return {
            "media_acordos":qtd_acordos / qtd_ops,
            "media_pago":total_pago / qtd_ops,
            "media_fechado":total_fechado / qtd_ops
        }

    def _numero(self, valor, padrao: float = 0.0) -> float:
        try:
            return float(valor)
        except (TypeError, ValueError):
            return padrao

    def _calcular_operador(self,data: dict,medias: dict):
        acordos = data["metrics"]["agreements"]["month"]
        pago = data["metrics"]["payments"]["month"]
        fechado = data["metrics"]["values"]["month"]

        efetividade = (pago / fechado * 100) if fechado > 0 else 0

        return {
            "efetividade":round(efetividade,2),
            "comparacoes":{
                "acordos":"acima da média" if acordos > medias["media_acordos"] else "abaixo da média",
                "valor_pago":"acima da média" if pago > medias["media_pago"] else "abaixo da média",
                "valor_fechado":"acima da média" if fechado > medias["media_fechado"] else "abaixo da média"
            }
        }

    def _montar_prompt(self,data: dict,operador: dict,medias: dict):
        return f"""
        Você é a Aurora IA, assistente de call center.
        Gere um feedback profissional e motivador para o operador {data.get("name")}.

        Carteira: {data.get("role")}
        Efetividade: {operador["efetividade"]:.2f}%

        Médias da carteira:
        - Acordos: {medias["media_acordos"]:.2f} ({operador["comparacoes"]["acordos"]})
        - Valor pago: R$ {medias["media_pago"]:.2f} ({operador["comparacoes"]["valor_pago"]})
        - Valor fechado: R$ {medias["media_fechado"]:.2f} ({operador["comparacoes"]["valor_fechado"]})

        Resultados do operador:
        - Acordos: {data["metrics"]["agreements"]["month"]}
        - Valor pago: R$ {data["metrics"]["payments"]["month"]:.2f}
        - Valor fechado: R$ {data["metrics"]["values"]["month"]:.2f}

        Estruture:
        1. Cumprimento
        2. Pontos fortes
        3. Comparação com a média
        4. Melhorias práticas
        5. Estratégias
        6. Fechamento motivacional
        """

class ResultadoService:
    def executar(self,cpf_operador: str,filtro: str,data: dict):

        filtro_agrupamento = self._montar_filtro(filtro, data)

        resultado = ResultadoRepository().buscar(cpf_operador, filtro_agrupamento)

        if not resultado:
            return None
        
        colunas = {
            "agrupamento": "agrupamento",
            "data": "data_registro",
            "hora": "hora_registro",
            "horario": "horario_atendimento",
            "turno": "turno_atendimento",
            "id_cedente": "codigo_cedente",
            "carteira": "nome_carteira",
            "grupo": "grupo_carteira",
            "sub_grupo": "subgrupo_carteira",
            "produto": "produto",
            "sub_produto": "subproduto",
            "faixa_contratante": "faixa_contratante",
            "id_cliente": "codigo_cliente",
            "id_acordo": "codigo_acordo",
            "id_contrato": "codigo_contrato",
            "cpf_cnpj_int": "cpf_cnpj_interno",
            "id_equipe": "codigo_equipe",
            "id_usuario": "codigo_usuario",
            "tp_status": "tipo_status",
            "nu_plano": "numero_plano",
            "nu_parcela": "numero_parcela",
            "dt_vencimento": "data_vencimento",
            "vl_entrada": "valor_entrada",
            "vl_parcela": "valor_parcela",
            "vl_acordo": "valor_total_acordo",
            "vl_risco": "valor_risco",
            "vl_desconto_principal": "valor_desconto_principal",
            "vl_receita": "valor_receita",
            "vl_repasse": "valor_repasse",
            "vl_divida": "valor_divida_original",
            "dt_cancelamento": "data_cancelamento",
            "atraso": "dias_em_atraso",
            "nm_equipe": "nome_equipe",
            "tp_equipe": "tipo_equipe",
            "nu_ip_conexao": "ip_conexao",
            "tp_conexao": "tipo_conexao",
            "tp_turno_operador": "turno_operador",
            "nm_usuario": "nome_usuario",
            "linha_digitavel": "linha_digitavel_boleto",
            "pix": "chave_pix",
            "dt_atualizacao": "data_atualizacao",
            "dt_hr_atualizacao": "data_hora_atualizacao",
            "mes": "mes_referencia",
            "ano": "ano_referencia",
            "data_pago": "data_pagamento",
            "parcela_paga": "numero_parcela_paga",
            "vl_pago": "valor_pago",
            "vl_risco_pago": "valor_risco_pago",
            "vl_ho": "valor_hoje"
        }

        dados_renomeados = [
                {
                    colunas.get(chave.lower(), chave): valor
                    for chave, valor in registro.items()
                }
                for registro in resultado
        ]
        return dados_renomeados

    def _montar_filtro(self,filtro: str,data: dict) -> str:
       
        if filtro == "dia":
            return "CONVERT(VARCHAR(10),A.DATA,120)"

        elif filtro == "semana":
            return "DATEPART(WEEK,A.DATA)"

        elif filtro == "mes":
            return "LEFT(CONVERT(VARCHAR(7),A.DATA,120),7)"

        return ResultadoExcepiton("Filtro inválido. Use 'dia', 'semana', 'mes' ou 'periodo'")


class MarcarFeedbackLidoService:
    def executar(self,feedback_id,operador):
        if not feedback_id or not operador:
            return jsonify({"erro":"Campos 'feedback_id' e 'operador' são obrigatórios"}),400

        try:
            feedback_id = int(feedback_id)
            operador = operador.strip()
        except Exception:
            return jsonify({"erro":"Dados inválidos"}),400

        resultado = FeedbacksRepository().marcar_como_lido(feedback_id,operador)

        if resultado is None:
            return jsonify({"erro":"Erro ao atualizar status do feedback"}),500

        if resultado == 0:
            return jsonify({"erro":"Feedback não encontrado para este operador"}),404

        return True

class RegistrarCienciaFeedbackService:
    def executar(self,feedback_id,cpf_operador,senha):
        if not feedback_id or not cpf_operador or not senha:
            return jsonify({"erro":"Campos 'feedback_id', 'cpf_operador' e 'senha' são obrigatórios"}),400

        try:
            feedback_id = int(feedback_id)
            cpf_operador = str(cpf_operador).strip()
            senha = str(senha)
        except Exception:
            return jsonify({"erro":"Dados inválidos"}),400

        usuario = LoginRepository(cpf_operador).login()

        if not usuario:
            return jsonify({"erro":"Operador não encontrado"}),404

        if senha != usuario.get("SENHA"):
            return jsonify({"erro":"Senha inválida"}),401

        operador = str(usuario.get("NM_COLABORADOR") or "").strip().upper()

        resultado = FeedbacksRepository().registrar_ciencia(
            feedback_id,
            operador,
            cpf_operador
        )

        if resultado is None:
            return jsonify({"erro":"Erro ao registrar ciência do feedback"}),500

        if resultado == 0:
            return jsonify({"erro":"Feedback não encontrado para este operador"}),404

        return True
