from collections import Counter
from datetime import date, datetime, timedelta
import json
from flask import jsonify
from src.infrastructure.repositories.sql_admin_repository import *
from src.infrastructure.repositories.sql_ia_repository import IADesempenhoRepository
from src.shared.storage.audio_storage import salvar_audio_feedback

class BuscarOperadoresService:
    def executar(self):
        rows = OperadoresRepository().listar()

        if not rows:
            return jsonify({"erro":"Nenhum operador encontrado"}),404

        operadores = []

        for row in rows:
            operadores.append({
                "nome_colaborador":row["NM_COLABORADOR"],
                # "usuario":row["USUARIO"],
                "senha":row["SENHA"],
                "cpf":row["CPF_COLABORADOR"]
            })

        return operadores

class AtualizarSenhaService:
    def executar(self,data: dict):
        nome_colaborador = data.get("nome_usuario","").strip()
        nova_senha = data.get("nova_senha","").strip()

        if not nome_colaborador or not nova_senha:
            return jsonify({"erro":"Campos obrigatórios não foram preenchidos"}),400

        resultado = UsuariosRepository().atualizar_senha(nome_colaborador,nova_senha)

        if isinstance(resultado,Exception):
            return jsonify({"erro":"Erro ao atualizar a senha"}),500

        return {
            "mensagem":f"Senha do usuário {nome_colaborador} atualizada com sucesso"
        }

class ListarIdealOperadoresService:
    def executar(self):
        rows = IdealOperadoresRepository().listar()

        if not rows:
            return jsonify({"erro":"Nenhum resultado encontrado"}),404

        operadores = []

        for row in rows:
            operadores.append({
                "NM_COLABORADOR":row["NM_COLABORADOR"],
                "IDEAL_OPERADOR":row["IDEAL_OPERADOR"]
            })

        return operadores

class AtualizarMetaOperadorService:
    def executar(self,*,data: dict,supervisor: str):
        nome_colaborador = data.get("nome_colaborador","").strip()
        nova_meta = data.get("nova_meta")

        if not nome_colaborador or nova_meta is None:
            return jsonify({"erro":"Campos obrigatórios não foram preenchidos"}),400

        repo = MetasRepository()

        ultima_data = repo.buscar_ultima_alteracao(nome_colaborador)

        if ultima_data:
            agora = datetime.now()
            if ultima_data.month == agora.month and ultima_data.year == agora.year:
                return jsonify({"erro":"A meta desse operador já foi alterada este mês."}),403

        resultado_update = repo.atualizar_meta(nome_colaborador,nova_meta)

        if isinstance(resultado_update,Exception):
            return jsonify({"erro":"Erro ao atualizar a meta no banco de dados"}),500

        repo.registrar_historico(nome_colaborador,nova_meta,supervisor)

        return {
            "mensagem":f"Meta de {nome_colaborador} atualizada com sucesso."
        }
    
class SupervisaoOperadoresService:
    def executar(self,data: dict):
        supervisor = data.get("nome_supervisor","").strip()

        if not supervisor:
            return jsonify({"erro":"Supervisor não informado"}),400

        rows = SupervisaoRepository().listar_por_supervisor(supervisor)

        if not rows:
            return jsonify({"erro":"Nenhuma informação encontrada"}),404

        operadores = []

        for row in rows:
            operadores.append({
                "nome_operador":row["NM_COLABORADOR"].strip().title() if row["NM_COLABORADOR"] else "",
                "nome_supervisor":row["SUPERVISOR"].strip().title() if row["SUPERVISOR"] else "",
                "valor_pago":float(row["VALOR_ENTRADA"] or 0),
                "valor_risco":float(row["TOTAL_RISCO"] or 0),
                "valor_entrada":float(row["VALOR_ENTRADA"] or 0),
                "cpc_dia":int(row["CPC_DO_DIA"] or 0),
                "carteira":row["CARTEIRA"].strip() if row["CARTEIRA"] else "",
                "status":"online" if row["IS_LOGADO"] == 1 else "offline",
                "acordos":row["TOTAL_ACORDO"] or 0,
                "clientes_contatados":0,
                "pendentes":0,
                "performance":0,
                "ideal_operador":row["IDEAL_OPERADOR"] or 0,
                "ultima_atividade":
                    row["DT_ULTIMO_ACESSO"].strftime("%d/%m/%Y %H:%M")
                    if row["DT_ULTIMO_ACESSO"] else "Sem registro"
            })

        return operadores

class ResumoOperadorDiaService:
    def executar(self,data: dict):
        nome_supervisor = data.get("nome_supervisor","").strip()

        if not nome_supervisor:
            return jsonify({"erro":"Nome do supervisor não informado"}),400

        rows = ResumoOperadorRepository().listar_por_supervisor(nome_supervisor)

        if not rows:
            return jsonify({"erro":"Nenhum dado encontrado"}),404

        resumo = []

        for row in rows:
            resumo.append({
                "data":
                    row["DATA"].strftime("%Y-%m-%d")
                    if row["DATA"] else "Sem data",
                "nome_operador":
                    row["NM_COLABORADOR"].strip().title()
                    if row["NM_COLABORADOR"] else "",
                "nome_supervisor":
                    row["SUPERVISOR"].strip().title()
                    if row["SUPERVISOR"] else "",
                "total_registros":row["TOTAL_REGISTROS"] or 0,
                "total_pago":float(row["TOTAL_PAGO"] or 0),
                "valor_entrada":float(row["VALOR_ENTRADA"] or 0),
                "risco_pago":float(row["TOTAL_RISCO_PAGO"] or 0)
            })

        return resumo

class TabulacoesOperadorService:
    def executar(self,data: dict):
        nome_supervisor = data.get("nome_supervisor","").strip()

        if not nome_supervisor:
            return jsonify({"erro":"Nome do supervisor não informado"}),400

        rows = TabulacoesRepository().listar_por_supervisor(nome_supervisor)

        if not rows:
            return jsonify({"erro":"Erro ao buscar tabulações ou nenhuma encontrada"}),404

        tabulacoes = []

        for row in rows:
            tabulacoes.append({
                "acao":
                    row["NM_ACAO"].strip().title()
                    if row["NM_ACAO"] else "",
                "quantidade":row["QUANTIDADE"],
                "supervisor":
                    row["SUPERVISOR"].strip().title()
                    if row["SUPERVISOR"] else "Sem registro",
                "operador":
                    row["NM_COLABORADOR"].strip().title()
                    if row["NM_COLABORADOR"] else "Desconhecido"
            })

        return tabulacoes
    
class AtividadeRecenteService:
    def executar(self,data: dict):
        nome_supervisor = data.get("nome_supervisor","").strip()
        nome_operador = data.get("nome_operador","").strip()

        if not nome_supervisor:
            return jsonify({"erro":"Nome do supervisor não informado"}),400

        rows = AtividadeRecenteRepository().listar(
            nome_supervisor=nome_supervisor,
            nome_operador=nome_operador
        )

        if not rows:
            return jsonify({"erro":"Erro ao buscar atividades ou nenhuma encontrada"}),404

        atividades = []

        for row in rows:
            atividades.append({
                "acao":
                    row["NM_ACAO"].strip().title()
                    if row["NM_ACAO"] else "",
                "data_acao":row["DT_ACAO"],
                "data_inicio":row["DT_INICIO_ATENDIMENTO"],
                "supervisor":
                    row["SUPERVISOR"].strip().title()
                    if row["SUPERVISOR"] else "Sem registro",
                "operador":
                    row["NM_COLABORADOR"].strip().title()
                    if row["NM_COLABORADOR"] else "Desconhecido"
            })

        return atividades

class BuscarOperadorService:
    def executar(self,params: dict):
        nome = params.get("nome","").strip()

        if not nome:
            return jsonify({"erro":"Nome não informado"}),400

        rows = OperadoresRepository().buscar_por_nome(nome)

        if not rows:
            return []

        operadores = []

        for row in rows:
            operadores.append({
                "id":row["cpf"],
                "cpf":row["cpf"],
                "nome":row["nome"].strip().title() if row["nome"] else "",
                "centro_custo":row["centro_custo"] or "",
                "carteira":row["carteira"] or ""
            })

        return operadores

class CriarFeedbackService:
    def executar(self,request):
        data = request.form
        audio = request.files.get("audio")

        obrigatorios = [
            "operador","data_hora","id_ligacao",
            "descricao","pontuacao","is_positivo","monitor_nome"
        ]

        for campo in obrigatorios:
            if not data.get(campo):
                return jsonify({"erro":f"Campo obrigatório '{campo}' não enviado"}),400

        try:
            data_hora = datetime.strptime(
                data["data_hora"].replace("T"," "),
                "%Y-%m-%d %H:%M"
            )
        except ValueError:
            return jsonify({"erro":"Formato inválido de data_hora"}),400

        try:
            checklist_snapshot = json.loads(data.get("checklist_json") or "{}")
            checklist_items = json.loads(data.get("checklist_itens") or "[]")
            if not isinstance(checklist_items,list) or not checklist_items:
                raise ValueError

            deduction_score = 0
            penalty_score = 0
            for item in checklist_items:
                item_type = str(item.get("tipo_item") or "").upper()
                status = str(item.get("status_resposta") or "").upper()
                weight = int(item.get("peso") or 0)
                if item_type == "CHECKLIST" and status == "NOK":
                    deduction_score += max(0,weight)
                elif item_type == "NCG" and status == "NCG":
                    penalty_score += weight

            base_score = max(0,100 - deduction_score)
            expected_score = max(0,min(100,base_score + penalty_score))
            snapshot_score = int(checklist_snapshot.get("metrics", {}).get("finalScore"))
            received_score = int(data["pontuacao"])
            if expected_score != received_score or expected_score != snapshot_score:
                return jsonify({"erro":"A pontuação enviada não corresponde ao checklist calculado"}),400
        except (TypeError, ValueError, json.JSONDecodeError):
            return jsonify({"erro":"Checklist ou pontuação inválida"}),400

        canal_id = (data.get("canal_id") or "").strip().lower()
        tempo_ligacao_total = (data.get("tempo_ligacao_total") or "").strip()
        if canal_id == "voz" and not tempo_ligacao_total:
            return jsonify({"erro":"Campo obrigatório 'tempo_ligacao_total' não enviado"}),400

        caminho_audio = salvar_audio_feedback(
            audio=audio,
            operador=data["operador"],
            id_ligacao=data["id_ligacao"]
        )

        FeedbackRepository().inserir(
            operador=data["operador"],
            data_hora=data_hora,
            id_ligacao=data["id_ligacao"],
            call_id=(data.get("call_id") or "").strip() or None,
            descricao=data["descricao"],
            pontos_positivos=data.get("pontos_positivos",""),
            pontos_melhorar=data.get("pontos_melhorar",""),
            pontuacao=expected_score,
            is_positivo=data["is_positivo"],
            monitor_nome=data["monitor_nome"],
            caminho_audio=caminho_audio,
            cpf_operador=data.get("cpf_operador"),
            carteira_id=data.get("carteira_id"),
            carteira_label=data.get("carteira_avaliada"),
            canal_id=data.get("canal_id"),
            canal_label=data.get("canal_avaliado"),
            checklist_id=data.get("checklist_id"),
            checklist_config_id=data.get("checklist_config_id"),
            checklist_version_id=data.get("checklist_version_id"),
            checklist_version=data.get("checklist_version"),
            nota_base=base_score,
            nota_maxima=100,
            penalidade_ncg=penalty_score,
            aderencia_percentual=expected_score,
            quantidade_ncg=data.get("quantidade_ncg"),
            checklist_json=data.get("checklist_json"),
            checklist_itens_json=data.get("checklist_itens"),
            tempo_ligacao_total=tempo_ligacao_total
        )

        return True
    
class DeletarFeedbackService:
    def executar(self,feedback_id,monitor_nome):
        if not feedback_id or not monitor_nome:
            return False

        return FeedbackRepository().deletar_feedback(feedback_id,monitor_nome)

class DetalheFeedbackService:
    def executar(self,feedback_id:int,monitor_nome:str):
        if not feedback_id or not monitor_nome:
            return None

        return FeedbackRepository().buscar_detalhe(feedback_id,monitor_nome)

class ListarFeedbacksOperadorService:
    def executar(self,operador: str):
        if not operador:
            return jsonify({"erro":"Parâmetro 'operador' é obrigatório"}),400

        feedbacks = FeedbacksRepository().listar_por_operador(operador)

        if isinstance(feedbacks,Exception):
            return jsonify({"erro":"Erro ao buscar feedbacks"}),500

        return feedbacks or []
    
class EstatisticasFeedbackMonitorService:
    def executar(self,monitor_nome: str):
        if not monitor_nome:
            return jsonify({"erro":"Parâmetro 'monitor_nome' é obrigatório"}),400

        stats = FeedbacksRepository().estatisticas_por_monitor(monitor_nome)

        if isinstance(stats,Exception):
            return jsonify({"erro":"Erro ao obter estatísticas"}),500

        total_enviados = stats.get("TOTAL_ENVIADOS",0) or 0
        total_lidos = stats.get("TOTAL_LIDOS",0) or 0

        taxa_leitura = round((total_lidos / total_enviados) * 100,2) if total_enviados else 0

        return {
            "total_enviados": total_enviados,
            "total_lidos": total_lidos,
            "total_positivos": stats.get("TOTAL_POSITIVOS",0) or 0,
            "total_negativos": stats.get("TOTAL_NEGATIVOS",0) or 0,
            "taxa_leitura": taxa_leitura
        }

class FeedbacksRecentesMonitorService:
    def executar(self,monitor_nome: str):
        if not monitor_nome:
            return jsonify({"erro":"Parâmetro 'monitor_nome' é obrigatório"}),400

        feedbacks = FeedbacksRepository().listar_recentes_por_monitor(monitor_nome)

        if isinstance(feedbacks,Exception):
            return jsonify({"erro":"Erro ao buscar feedbacks recentes"}),500

        return feedbacks or []

class FeedbackAnalyticsService:
    DAILY_POINTS = 7
    WEEKLY_POINTS = 8
    MONTHLY_POINTS = 12
    QUALITY_ANALYTICS_DATE_FIELD = "DATA_REGISTRO"

    def _parse_datetime(self,value):
        if isinstance(value,datetime):
            return value
        if not value:
            return None

        texto = str(value).strip()
        formatos = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M",
        ]

        for formato in formatos:
            try:
                return datetime.strptime(texto,formato)
            except ValueError:
                continue

        try:
            return datetime.fromisoformat(texto)
        except ValueError:
            return None

    def _normalize_period(self,periodo:str):
        periodo = (periodo or "").strip().lower()
        if periodo not in {"diario","semanal","mensal"}:
            raise ValueError("Período inválido. Use diario, semanal ou mensal.")
        return periodo

    def _parse_date(self,value):
        if not value:
            return None

        texto = str(value).strip()
        for formato in ("%Y-%m-%d","%d/%m/%Y"):
            try:
                return datetime.strptime(texto,formato).date()
            except ValueError:
                continue
        return None

    def _get_period_labels(self,periodo:str):
        now = datetime.now()

        if periodo == "diario":
            datas = [now.date() - timedelta(days=offset) for offset in range(self.DAILY_POINTS - 1,-1,-1)]
            return [(data.isoformat(),data.strftime("%d/%m")) for data in datas]

        if periodo == "semanal":
            labels = []
            inicio_semana_atual = now.date() - timedelta(days=now.weekday())
            for offset in range(self.WEEKLY_POINTS - 1,-1,-1):
                inicio = inicio_semana_atual - timedelta(weeks=offset)
                fim = inicio + timedelta(days=6)
                key = f"{inicio.isoformat()}::{fim.isoformat()}"
                labels.append((key,f"{inicio.strftime('%d/%m')} - {fim.strftime('%d/%m')}"))
            return labels

        labels = []
        ano = now.year
        mes = now.month
        for offset in range(self.MONTHLY_POINTS - 1,-1,-1):
            mes_atual = mes - offset
            ano_atual = ano
            while mes_atual <= 0:
                mes_atual += 12
                ano_atual -= 1
            key = f"{ano_atual:04d}-{mes_atual:02d}"
            labels.append((key,f"{mes_atual:02d}/{ano_atual}"))
        return labels

    def _get_bucket_key(self,data_hora:datetime,periodo:str):
        if periodo == "diario":
            return data_hora.date().isoformat()
        if periodo == "semanal":
            inicio = data_hora.date() - timedelta(days=data_hora.weekday())
            fim = inicio + timedelta(days=6)
            return f"{inicio.isoformat()}::{fim.isoformat()}"
        return f"{data_hora.year:04d}-{data_hora.month:02d}"

    def _build_average_series(self,rows:list[dict],periodo:str):
        labels = self._get_period_labels(periodo)
        buckets = {key: {"sum": 0.0, "count": 0} for key,_ in labels}

        for row in rows:
            data_hora = self._parse_datetime(
                row.get(self.QUALITY_ANALYTICS_DATE_FIELD)
            )
            if not data_hora:
                continue

            key = self._get_bucket_key(data_hora,periodo)
            if key not in buckets:
                continue

            buckets[key]["sum"] += float(row.get("PONTUACAO") or 0)
            buckets[key]["count"] += 1

        series = []
        for key,label in labels:
            bucket = buckets[key]
            media = round(bucket["sum"] / bucket["count"],2) if bucket["count"] else 0
            series.append({
                "key": key,
                "label": label,
                "media": media,
                "total_feedbacks": bucket["count"]
            })
        return series

    def _filter_rows_by_date_range(
        self,
        rows:list[dict],
        start_date=None,
        end_date=None,
        field_name:str | None = None,
    ):
        # As linhas de qualidade trazem DATA_REGISTRO, mas as perguntas da IA
        # trazem DATA_PERGUNTA/DATA_MENSAGEM. Assumir a constante descartava
        # todas as linhas da IA em silencio, e o comparativo zerava sempre.
        campo = field_name or self.QUALITY_ANALYTICS_DATE_FIELD
        filtered = []

        for row in rows:
            data_hora = self._parse_datetime(row.get(campo))
            if not data_hora:
                continue

            data = data_hora.date()
            if start_date and data < start_date:
                continue
            if end_date and data > end_date:
                continue
            filtered.append(row)

        return filtered

    def _filter_rows_by_visible_period(self,rows:list[dict],periodo:str,field_name:str):
        keys_validos = {key for key,_ in self._get_period_labels(periodo)}
        filtrados = []

        for row in rows:
            data_hora = self._parse_datetime(row.get(field_name))
            if not data_hora:
                continue

            if self._get_bucket_key(data_hora,periodo) in keys_validos:
                filtrados.append(row)

        return filtrados

    def _get_default_window(self,periodo:str):
        hoje = datetime.now().date()

        if periodo == "diario":
            return hoje,hoje
        if periodo == "semanal":
            inicio = hoje - timedelta(days=hoje.weekday())
            return inicio,inicio + timedelta(days=6)

        inicio = date(hoje.year,hoje.month,1)
        if hoje.month == 12:
            proximo_mes = date(hoje.year + 1,1,1)
        else:
            proximo_mes = date(hoje.year,hoje.month + 1,1)
        fim = proximo_mes - timedelta(days=1)
        return inicio,fim

    def _format_window_label(self,start_date,end_date):
        if start_date == end_date:
            return start_date.strftime("%d/%m/%Y")
        return f"{start_date.strftime('%d/%m/%Y')} até {end_date.strftime('%d/%m/%Y')}"

    def _resolve_comparison_windows(
        self,
        periodo:str,
        start_date_raw:str="",
        end_date_raw:str="",
        compare_start_raw:str="",
        compare_end_raw:str="",
    ):
        current_start = self._parse_date(start_date_raw)
        current_end = self._parse_date(end_date_raw)

        if bool(current_start) ^ bool(current_end):
            raise ValueError("Informe start_date e end_date juntos.")

        if current_start and current_end:
            if current_end < current_start:
                raise ValueError("end_date deve ser maior ou igual a start_date.")
        else:
            current_start,current_end = self._get_default_window(periodo)

        compare_start = self._parse_date(compare_start_raw)
        compare_end = self._parse_date(compare_end_raw)

        if bool(compare_start) ^ bool(compare_end):
            raise ValueError("Informe compare_start_date e compare_end_date juntos.")

        if compare_start and compare_end:
            if compare_end < compare_start:
                raise ValueError("compare_end_date deve ser maior ou igual a compare_start_date.")
        else:
            intervalo_dias = (current_end - current_start).days + 1
            compare_end = current_start - timedelta(days=1)
            compare_start = compare_end - timedelta(days=intervalo_dias - 1)

        return {
            "current_start": current_start,
            "current_end": current_end,
            "compare_start": compare_start,
            "compare_end": compare_end,
            "current_label": self._format_window_label(current_start,current_end),
            "compare_label": self._format_window_label(compare_start,compare_end),
        }

    def _build_metric_comparison(self,current_value,previous_value,higher_is_better=True,metric_label=""):
        current_value = round(float(current_value or 0),2)
        previous_value = round(float(previous_value or 0),2)
        delta_value = round(current_value - previous_value,2)

        if previous_value == 0:
            delta_percent = 0 if current_value == 0 else 100
        else:
            delta_percent = round((delta_value / previous_value) * 100,2)

        if delta_value == 0:
            trend = "estavel"
        elif higher_is_better:
            trend = "melhorou" if delta_value > 0 else "piorou"
        else:
            trend = "melhorou" if delta_value < 0 else "piorou"

        return {
            "metric_label": metric_label,
            "current_value": current_value,
            "previous_value": previous_value,
            "delta_value": delta_value,
            "delta_percent": delta_percent,
            "trend": trend,
        }

    def _normalize_text(self,valor):
        return str(valor or "").strip().lower()

    def _filter_ia_question_rows(
        self,
        rows:list[dict],
        *,
        wallet_id:str="",
        centro_custo:str="",
        topico:str=""
    ):
        filtrados = []
        wallet_id = self._normalize_text(wallet_id)
        centro_custo = self._normalize_text(centro_custo)
        topico = self._normalize_text(topico)

        for row in rows:
            carteira = row.get("CARTEIRA")
            row_topico = self._normalize_text(row.get("TOPICO"))

            if not self._normalize_text(carteira):
                continue

            if centro_custo and centro_custo not in self._normalize_text(carteira):
                continue

            if topico and row_topico != topico:
                continue

            filtrados.append(row)

        return filtrados

    def _build_ia_centros_custo(self,rows:list[dict]):
        centros = sorted({
            str(row.get("CARTEIRA") or "").strip()
            for row in rows
            if str(row.get("CARTEIRA") or "").strip()
        })
        return centros

    def _ia_analysis_key(self,operador,conversa_id,pergunta):
        return (
            self._normalize_text(operador),
            self._normalize_text(conversa_id),
            self._normalize_text(pergunta),
        )

    def _build_ia_questions_from_messages(
        self,
        message_rows:list[dict],
        analysis_rows:list[dict]
    ):
        analysis_by_key = {}
        for row in analysis_rows:
            key = self._ia_analysis_key(
                row.get("OPERADOR"),
                row.get("CONVERSA_ID"),
                row.get("PERGUNTA")
            )
            if key not in analysis_by_key:
                analysis_by_key[key] = row

        questions = []
        for row in message_rows:
            if not bool(row.get("IS_USER")):
                continue

            centro_custo = str(row.get("CENTRO_CUSTO") or "").strip()
            if not centro_custo:
                continue

            pergunta = row.get("MENSAGEM") or ""
            analysis = analysis_by_key.get(
                self._ia_analysis_key(
                    row.get("OPERADOR"),
                    row.get("CONVERSA_ID"),
                    pergunta
                )
            ) or {}

            questions.append({
                "OPERADOR": row.get("OPERADOR"),
                "CARTEIRA": centro_custo,
                "CONVERSA_ID": row.get("CONVERSA_ID"),
                "PERGUNTA": pergunta,
                "TOPICO": analysis.get("TOPICO") or "Outros",
                "JUSTIFICATIVA": analysis.get("JUSTIFICATIVA"),
                "DATA_PERGUNTA": row.get("DATA_MENSAGEM"),
            })

        return questions

    def _build_ia_volume_series(self,rows:list[dict],periodo:str):
        labels = self._get_period_labels(periodo)
        buckets = {key: {"total": 0} for key,_ in labels}

        for row in rows:
            data_hora = self._parse_datetime(row.get("DATA_PERGUNTA"))
            if not data_hora:
                continue

            key = self._get_bucket_key(data_hora,periodo)
            if key not in buckets:
                continue

            buckets[key]["total"] += 1

        return [
            {
                "key": key,
                "label": label,
                "total": buckets[key]["total"]
            }
            for key,label in labels
        ]

    def _build_ia_topic_distribution(self,rows:list[dict]):
        total = len(rows)
        counter = Counter(
            str(row.get("TOPICO") or "Outros").strip() or "Outros"
            for row in rows
        )
        return [
            {
                "topico": topico,
                "total": quantidade,
                "percentual": round((quantidade / total) * 100,2) if total else 0
            }
            for topico,quantidade in counter.most_common()
        ]

    def _build_ia_operator_ranking(self,rows:list[dict],limite:int | None = 10):
        agrupado = {}

        for row in rows:
            operador = str(row.get("OPERADOR") or "Sem operador").strip() or "Sem operador"
            info = agrupado.setdefault(operador,{
                "operador": operador,
                "total_perguntas": 0,
                "topicos": Counter(),
                "ultima_pergunta_em": None
            })
            info["total_perguntas"] += 1
            info["topicos"][str(row.get("TOPICO") or "Outros").strip() or "Outros"] += 1

            data_hora = self._parse_datetime(row.get("DATA_PERGUNTA"))
            if data_hora and (
                not info["ultima_pergunta_em"] or data_hora > info["ultima_pergunta_em"]
            ):
                info["ultima_pergunta_em"] = data_hora

        ranking = []
        for info in agrupado.values():
            topico_principal = info["topicos"].most_common(1)[0][0] if info["topicos"] else "Outros"
            ranking.append({
                "operador": info["operador"],
                "total_perguntas": info["total_perguntas"],
                "topico_principal": topico_principal,
                "ultima_pergunta_em": info["ultima_pergunta_em"].isoformat() if info["ultima_pergunta_em"] else None
            })

        ranking.sort(key=lambda item: (-item["total_perguntas"],item["operador"]))
        if limite is None:
            return ranking
        return ranking[:limite]

    def _filter_ia_message_rows(
        self,
        rows:list[dict],
        *,
        centro_custo:str="",
        is_user:bool | None = None
    ):
        filtrados = []
        centro_custo = self._normalize_text(centro_custo)

        for row in rows:
            if is_user is not None and bool(row.get("IS_USER")) != is_user:
                continue

            row_centro = self._normalize_text(row.get("CENTRO_CUSTO"))
            if not row_centro:
                continue

            if centro_custo and centro_custo not in row_centro:
                continue

            filtrados.append(row)

        return filtrados

    def _build_ia_centros_custo_mensagens(self,rows:list[dict]):
        centros = sorted({
            str(row.get("CENTRO_CUSTO") or "").strip()
            for row in rows
            if str(row.get("CENTRO_CUSTO") or "").strip()
        })
        return centros

    def _build_ia_centro_custo_distribution(self,rows:list[dict]):
        total = len(rows)
        counter = Counter(
            str(row.get("CENTRO_CUSTO") or "Sem centro de custo").strip() or "Sem centro de custo"
            for row in rows
        )
        return [
            {
                "centro_custo": centro_custo,
                "total_perguntas": quantidade,
                "percentual": round((quantidade / total) * 100,2) if total else 0
            }
            for centro_custo,quantidade in counter.most_common()
        ]

    def _build_ia_feedback_summary(self,rows:list[dict]):
        respostas_com_feedback = [
            row for row in rows
            if row.get("RESPOSTA_UTIL") is not None
        ]
        uteis = sum(1 for row in respostas_com_feedback if bool(row.get("RESPOSTA_UTIL")))
        nao_uteis = sum(1 for row in respostas_com_feedback if not bool(row.get("RESPOSTA_UTIL")))
        sem_feedback = len(rows) - len(respostas_com_feedback)
        total_feedbacks = len(respostas_com_feedback)

        return {
            "total_respostas": len(rows),
            "total_feedbacks": total_feedbacks,
            "uteis": uteis,
            "nao_uteis": nao_uteis,
            "sem_feedback": sem_feedback,
            "taxa_utilidade": round((uteis / total_feedbacks) * 100,2) if total_feedbacks else 0,
            "taxa_feedback": round((total_feedbacks / len(rows)) * 100,2) if rows else 0,
        }

    def _build_ia_feedback_distribution(self,rows:list[dict]):
        summary = self._build_ia_feedback_summary(rows)
        total = summary["total_respostas"]
        items = [
            ("Úteis", summary["uteis"]),
            ("Não úteis", summary["nao_uteis"]),
            ("Sem feedback", summary["sem_feedback"]),
        ]
        return [
            {
                "status": status,
                "total": quantidade,
                "percentual": round((quantidade / total) * 100,2) if total else 0
            }
            for status,quantidade in items
        ]

    def _build_ia_feedback_timeline(self,rows:list[dict],periodo:str):
        labels = self._get_period_labels(periodo)
        buckets = {
            key: {"uteis": 0, "nao_uteis": 0, "sem_feedback": 0, "total_respostas": 0}
            for key,_ in labels
        }

        for row in rows:
            data_hora = self._parse_datetime(row.get("DATA_MENSAGEM"))
            if not data_hora:
                continue

            key = self._get_bucket_key(data_hora,periodo)
            if key not in buckets:
                continue

            buckets[key]["total_respostas"] += 1
            resposta_util = row.get("RESPOSTA_UTIL")
            if resposta_util is None:
                buckets[key]["sem_feedback"] += 1
            elif bool(resposta_util):
                buckets[key]["uteis"] += 1
            else:
                buckets[key]["nao_uteis"] += 1

        return [
            {
                "key": key,
                "label": label,
                **buckets[key]
            }
            for key,label in labels
        ]

    def _build_ia_recent_questions(self,rows:list[dict],limite:int=12):
        recentes = []

        for row in sorted(
            rows,
            key=lambda item: self._parse_datetime(item.get("DATA_PERGUNTA")) or datetime.min,
            reverse=True
        )[:limite]:
            data_hora = self._parse_datetime(row.get("DATA_PERGUNTA"))
            recentes.append({
                "operador": row.get("OPERADOR"),
                "carteira": row.get("CARTEIRA"),
                "conversa_id": row.get("CONVERSA_ID"),
                "topico": row.get("TOPICO") or "Outros",
                "pergunta": row.get("PERGUNTA") or "",
                "justificativa": row.get("JUSTIFICATIVA"),
                "data_pergunta": data_hora.isoformat() if data_hora else None
            })

        return recentes

    def detalhar_conversa_ia(self,conversa_id:str):
        conversa_id = (conversa_id or "").strip()
        if not conversa_id:
            return jsonify({"erro":"conversa_id é obrigatório"}),400

        mensagens = IADesempenhoRepository().buscar_mensagens_conversa(conversa_id)
        if not mensagens:
            return jsonify({"erro":"Conversa não encontrada"}),404

        itens = []
        operador = ""
        inicio = None
        fim = None

        for row in mensagens:
            data_hora = self._parse_datetime(row.get("DATA_MENSAGEM"))
            if not operador:
                operador = str(row.get("OPERADOR") or "").strip()
            if data_hora and (not inicio or data_hora < inicio):
                inicio = data_hora
            if data_hora and (not fim or data_hora > fim):
                fim = data_hora

            itens.append({
                "operador": row.get("OPERADOR"),
                "centro_custo": row.get("CENTRO_CUSTO"),
                "mensagem": row.get("MENSAGEM") or "",
                "is_user": bool(row.get("IS_USER")),
                "data_mensagem": data_hora.isoformat() if data_hora else None,
            })

        return {
            "conversa_id": conversa_id,
            "operador": operador,
            "data_inicio": inicio.isoformat() if inicio else None,
            "data_fim": fim.isoformat() if fim else None,
            "mensagens": itens,
        }

    def detalhar_operador_ia(self,operador:str):
        operador = str(operador or "").strip()
        if not operador:
            return jsonify({"erro":"operador é obrigatório"}),400

        repo = IADesempenhoRepository()
        rows = self._build_ia_questions_from_messages(
            repo.listar_mensagens_ia(),
            repo.listar_analises_perguntas()
        )
        operador_normalizado = self._normalize_text(operador)
        perguntas = []

        for row in rows:
            nome_row = str(row.get("OPERADOR") or "").strip()
            if self._normalize_text(nome_row) != operador_normalizado:
                continue

            data_hora = self._parse_datetime(row.get("DATA_PERGUNTA"))
            perguntas.append({
                "operador": nome_row,
                "carteira": row.get("CARTEIRA"),
                "conversa_id": row.get("CONVERSA_ID"),
                "topico": row.get("TOPICO") or "Outros",
                "pergunta": row.get("PERGUNTA") or "",
                "justificativa": row.get("JUSTIFICATIVA"),
                "data_pergunta": data_hora.isoformat() if data_hora else None,
            })

        if not perguntas:
            return jsonify({"erro":"Nenhuma pergunta encontrada para esse operador"}),404

        perguntas.sort(
            key=lambda item: self._parse_datetime(item.get("data_pergunta")) or datetime.min,
            reverse=True
        )

        topicos_counter = Counter(item["topico"] for item in perguntas)
        topicos = [
            {"topico": topico, "total": total}
            for topico,total in topicos_counter.most_common()
        ]

        return {
            "operador": operador,
            "total_perguntas": len(perguntas),
            "topico_principal": topicos[0]["topico"] if topicos else "Outros",
            "topicos": topicos,
            "perguntas": perguntas,
        }

    def _calculate_average_summary(self,rows:list[dict]):
        total_feedbacks = len(rows)
        media_geral = round(
            sum(float(row.get("PONTUACAO") or 0) for row in rows) / total_feedbacks,
            2
        ) if total_feedbacks else 0
        operadores = {
            (row.get("CPF_OPERADOR") or row.get("OPERADOR") or "").strip()
            for row in rows
            if (row.get("CPF_OPERADOR") or row.get("OPERADOR"))
        }

        return {
            "media_geral": media_geral,
            "total_feedbacks": total_feedbacks,
            "operadores_avaliados": len(operadores)
        }

    def _calculate_offender_success(self,rows:list[dict]):
        total_done = 0
        total_not_done = 0
        total_ncg = 0

        for row in rows:
            raw_json = row.get("CHECKLIST_JSON")
            if not raw_json:
                continue

            try:
                checklist = json.loads(raw_json)
            except (TypeError, json.JSONDecodeError):
                continue

            total_done += len(checklist.get("done",[]) or [])
            total_not_done += len(checklist.get("notDone",[]) or [])
            total_ncg += len(checklist.get("ncg",[]) or [])

        total_itens = total_done + total_not_done + total_ncg
        taxa_sucesso = round((total_done / total_itens) * 100,2) if total_itens else 0
        ocorrencias_por_feedback = round((total_not_done + total_ncg) / len(rows),2) if rows else 0

        return {
            "taxa_sucesso": taxa_sucesso,
            "ocorrencias_por_feedback": ocorrencias_por_feedback,
        }

    def _extract_offenders(self,rows:list[dict]):
        counter = Counter()
        total_feedbacks = len(rows)

        for row in rows:
            raw_json = row.get("CHECKLIST_JSON")
            if not raw_json:
                continue

            try:
                checklist = json.loads(raw_json)
            except (TypeError, json.JSONDecodeError):
                continue

            for item in checklist.get("notDone",[]) or []:
                block_title = str(item.get("blockTitle") or "").strip()
                item_title = str(item.get("itemTitle") or "").strip()
                if not item_title:
                    continue
                label = f"{block_title} • {item_title}" if block_title else item_title
                counter[label] += 1

            for item in checklist.get("ncg",[]) or []:
                block_title = str(item.get("blockTitle") or "").strip()
                item_title = str(item.get("itemTitle") or "").strip()
                if not item_title:
                    continue
                label = f"{block_title} • {item_title}" if block_title else item_title
                counter[label] += 1

        return [
            {
                "label": label,
                "total": total,
                "percentual": round((total / total_feedbacks) * 100,2) if total_feedbacks else 0
            }
            for label,total in counter.most_common(10)
        ]

    def _extract_offender_distribution(self,rows:list[dict]):
        counter = Counter()
        total_feedbacks = len(rows)

        for row in rows:
            raw_json = row.get("CHECKLIST_JSON")
            if not raw_json:
                continue

            try:
                checklist = json.loads(raw_json)
            except (TypeError, json.JSONDecodeError):
                continue

            for collection_name in ("notDone","ncg"):
                for item in checklist.get(collection_name,[]) or []:
                    block_title = str(item.get("blockTitle") or "").strip()
                    item_title = str(item.get("itemTitle") or "").strip()
                    if not item_title:
                        continue

                    label = f"{block_title} • {item_title}" if block_title else item_title
                    counter[label] += 1

        distribution = {}
        for label,total in counter.items():
            distribution[label] = {
                "total": total,
                "percentual": round((total / total_feedbacks) * 100,2) if total_feedbacks else 0
            }

        return distribution

    def _extract_offender_group_distribution(self,rows:list[dict]):
        counter = Counter()
        total_feedbacks = len(rows)

        for row in rows:
            raw_json = row.get("CHECKLIST_JSON")
            if not raw_json:
                continue

            try:
                checklist = json.loads(raw_json)
            except (TypeError, json.JSONDecodeError):
                continue

            for collection_name in ("notDone","ncg"):
                for item in checklist.get(collection_name,[]) or []:
                    block_title = str(item.get("blockTitle") or "").strip() or "Outros"
                    counter[block_title] += 1

        distribution = {}
        for label,total in counter.items():
            distribution[label] = {
                "total": total,
                "percentual": round((total / total_feedbacks) * 100,2) if total_feedbacks else 0
            }

        return distribution

    def monitores_teleatendimento(self):
        rows = FeedbacksRepository().listar_analytics_monitores_teleatendimento()
        now = datetime.now()
        inicio_semana = datetime.combine(
            (now - timedelta(days=now.weekday())).date(),
            datetime.min.time()
        )
        inicio_mes = datetime(now.year,now.month,1)

        monitores: dict[str,dict] = {}
        feedbacks_semana: list[float] = []
        feedbacks_mes: list[float] = []

        for row in rows:
            monitor_nome = (row.get("MONITOR_NOME") or "").strip()
            if not monitor_nome:
                continue

            monitor = monitores.setdefault(monitor_nome,{
                "monitor_nome": monitor_nome,
                "total_monitorias": 0,
                "monitorias_dia": 0,
                "monitorias_semana": 0,
                "monitorias_mes": 0,
                "soma_geral": 0.0,
                "soma_semana": 0.0,
                "soma_mes": 0.0,
                "positivas": 0,
                "negativas": 0,
                "soma_positivas": 0.0,
                "soma_negativas": 0.0,
            })

            if not row.get("ID_FEEDBACK"):
                continue

            pontuacao = float(row.get("PONTUACAO") or 0)
            data_hora = self._parse_datetime(
                row.get(self.QUALITY_ANALYTICS_DATE_FIELD)
            )

            monitor["total_monitorias"] += 1
            monitor["soma_geral"] += pontuacao

            if row.get("IS_POSITIVO"):
                monitor["positivas"] += 1
                monitor["soma_positivas"] += pontuacao
            else:
                monitor["negativas"] += 1
                monitor["soma_negativas"] += pontuacao

            if not data_hora:
                continue

            if data_hora.date() == now.date():
                monitor["monitorias_dia"] += 1

            if data_hora >= inicio_semana:
                monitor["monitorias_semana"] += 1
                monitor["soma_semana"] += pontuacao
                feedbacks_semana.append(pontuacao)

            if data_hora >= inicio_mes:
                monitor["monitorias_mes"] += 1
                monitor["soma_mes"] += pontuacao
                feedbacks_mes.append(pontuacao)

        items = []
        for monitor in monitores.values():
            total_monitorias = monitor["total_monitorias"]
            positivas = monitor["positivas"]
            negativas = monitor["negativas"]
            media_geral = round(monitor["soma_geral"] / total_monitorias,2) if total_monitorias else 0
            media_semanal = round(monitor["soma_semana"] / monitor["monitorias_semana"],2) if monitor["monitorias_semana"] else 0
            media_mensal = round(monitor["soma_mes"] / monitor["monitorias_mes"],2) if monitor["monitorias_mes"] else 0
            media_positivas = round(monitor["soma_positivas"] / positivas,2) if positivas else 0
            media_negativas = round(monitor["soma_negativas"] / negativas,2) if negativas else 0

            items.append({
                "monitor_nome": monitor["monitor_nome"],
                "total_monitorias": total_monitorias,
                "monitorias_dia": monitor["monitorias_dia"],
                "monitorias_semana": monitor["monitorias_semana"],
                "monitorias_mes": monitor["monitorias_mes"],
                "media_geral": media_geral,
                "media_semanal": media_semanal,
                "media_mensal": media_mensal,
                "positivas": positivas,
                "negativas": negativas,
                "media_positivas": media_positivas,
                "media_negativas": media_negativas,
            })

        items.sort(
            key=lambda item: (
                -item["monitorias_mes"],
                -item["media_mensal"],
                item["monitor_nome"]
            )
        )

        return {
            "monitores": items,
            "resumo": {
                "total_monitores": len(items),
                "monitorias_dia": sum(item["monitorias_dia"] for item in items),
                "monitorias_semana": sum(item["monitorias_semana"] for item in items),
                "monitorias_mes": sum(item["monitorias_mes"] for item in items),
                "media_semanal_geral": round(sum(feedbacks_semana) / len(feedbacks_semana),2) if feedbacks_semana else 0,
                "media_mensal_geral": round(sum(feedbacks_mes) / len(feedbacks_mes),2) if feedbacks_mes else 0,
                "positivas": sum(item["positivas"] for item in items),
                "negativas": sum(item["negativas"] for item in items),
            }
        }

    def analytics_perguntas_ia(
        self,
        wallet_id:str="",
        periodo:str="diario",
        centro_custo:str="",
        topico:str="",
        start_date:str="",
        end_date:str="",
        compare_start_date:str="",
        compare_end_date:str="",
    ):
        try:
            periodo = self._normalize_period(periodo)
            windows = self._resolve_comparison_windows(
                periodo,
                start_date,
                end_date,
                compare_start_date,
                compare_end_date
            )
        except ValueError as exc:
            return jsonify({"erro":str(exc)}),400

        repo_ia = IADesempenhoRepository()
        analysis_rows = repo_ia.listar_analises_perguntas()
        message_rows = repo_ia.listar_mensagens_ia()
        rows = self._build_ia_questions_from_messages(
            message_rows,
            analysis_rows
        )
        user_message_rows = self._filter_ia_message_rows(
            message_rows,
            centro_custo=centro_custo,
            is_user=True
        )
        answer_message_rows = self._filter_ia_message_rows(
            message_rows,
            centro_custo=centro_custo,
            is_user=False
        )
        centros_custo_disponiveis = self._build_ia_centros_custo_mensagens(message_rows)
        rows = self._filter_ia_question_rows(
            rows,
            wallet_id=wallet_id,
            centro_custo=centro_custo,
            topico=topico
        )
        # Os cartoes e as distribuicoes descrevem o periodo escolhido: diario e
        # hoje, semanal e a semana corrente, mensal e o mes corrente — o mesmo
        # recorte do e-mail. So as series temporais seguem olhando o historico
        # inteiro, que e o que o grafico precisa desenhar.
        current_rows = self._filter_rows_by_date_range(
            rows,
            windows["current_start"],
            windows["current_end"],
            field_name="DATA_PERGUNTA"
        )
        compare_rows = self._filter_rows_by_date_range(
            rows,
            windows["compare_start"],
            windows["compare_end"],
            field_name="DATA_PERGUNTA"
        )
        visible_rows = current_rows
        visible_user_message_rows = self._filter_rows_by_date_range(
            user_message_rows,
            windows["current_start"],
            windows["current_end"],
            field_name="DATA_MENSAGEM"
        )
        visible_answer_message_rows = self._filter_rows_by_date_range(
            answer_message_rows,
            windows["current_start"],
            windows["current_end"],
            field_name="DATA_MENSAGEM"
        )

        topic_distribution = self._build_ia_topic_distribution(visible_rows)
        topico_lider = topic_distribution[0]["topico"] if topic_distribution else "Sem dados"
        topico_lider_total = topic_distribution[0]["total"] if topic_distribution else 0

        operadores_all = self._build_ia_operator_ranking(visible_rows,limite=None)
        operadores_top = operadores_all[:10]
        centro_custo_distribution = self._build_ia_centro_custo_distribution(visible_user_message_rows)
        centro_custo_lider = centro_custo_distribution[0]["centro_custo"] if centro_custo_distribution else "Sem dados"
        centro_custo_lider_total = centro_custo_distribution[0]["total_perguntas"] if centro_custo_distribution else 0
        feedback_summary = self._build_ia_feedback_summary(visible_answer_message_rows)

        return {
            "summary": {
                "total_perguntas": len(visible_rows),
                "operadores_unicos": len({
                    self._normalize_text(row.get("OPERADOR"))
                    for row in visible_rows
                    if self._normalize_text(row.get("OPERADOR"))
                }),
                "topico_lider": topico_lider,
                "topico_lider_total": topico_lider_total,
                "centro_custo_lider": centro_custo_lider,
                "centro_custo_lider_total": centro_custo_lider_total,
                "taxa_utilidade_respostas": feedback_summary["taxa_utilidade"],
                "total_feedbacks_respostas": feedback_summary["total_feedbacks"],
            },
            "comparativo": {
                **self._build_metric_comparison(
                    len(current_rows),
                    len(compare_rows),
                    True,
                    "Volume de perguntas"
                ),
                "current_label": windows["current_label"],
                "previous_label": windows["compare_label"],
            },
            "topic_distribution": topic_distribution,
            "timeline": self._build_ia_volume_series(rows,periodo),
            "operators": operadores_top,
            "operators_top": operadores_top,
            "operators_all": operadores_all,
            "recent_questions": self._build_ia_recent_questions(visible_rows),
            "available_centros_custo": centros_custo_disponiveis,
            "centro_custo_distribution": centro_custo_distribution,
            "feedback_summary": feedback_summary,
            "feedback_distribution": self._build_ia_feedback_distribution(visible_answer_message_rows),
            "feedback_timeline": self._build_ia_feedback_timeline(answer_message_rows,periodo),
        }

    def media_carteira(
        self,
        wallet_id:str,
        periodo:str,
        canal_id:str="",
        start_date:str="",
        end_date:str="",
        compare_start_date:str="",
        compare_end_date:str="",
    ):
        if not wallet_id:
            return jsonify({"erro":"wallet_id é obrigatório"}),400

        try:
            periodo = self._normalize_period(periodo)
            windows = self._resolve_comparison_windows(
                periodo,
                start_date,
                end_date,
                compare_start_date,
                compare_end_date
            )
        except ValueError as exc:
            return jsonify({"erro":str(exc)}),400

        rows = FeedbacksRepository().listar_analytics_wallet(wallet_id,canal_id)
        series = self._build_average_series(rows,periodo)
        current_rows = self._filter_rows_by_date_range(
            rows,
            windows["current_start"],
            windows["current_end"]
        )
        compare_rows = self._filter_rows_by_date_range(
            rows,
            windows["compare_start"],
            windows["compare_end"]
        )
        resumo = self._calculate_average_summary(current_rows)
        resumo_compare = self._calculate_average_summary(compare_rows)

        return {
            "series": series,
            "resumo": resumo,
            "comparativo": {
                **self._build_metric_comparison(
                    resumo["media_geral"],
                    resumo_compare["media_geral"],
                    True,
                    "Média de monitoria"
                ),
                "current_label": windows["current_label"],
                "previous_label": windows["compare_label"],
                "current_total_feedbacks": resumo["total_feedbacks"],
                "previous_total_feedbacks": resumo_compare["total_feedbacks"],
            }
        }

    def ofensores_carteira(
        self,
        wallet_id:str,
        periodo:str,
        canal_id:str="",
        start_date:str="",
        end_date:str="",
        compare_start_date:str="",
        compare_end_date:str="",
    ):
        if not wallet_id:
            return jsonify({"erro":"wallet_id é obrigatório"}),400

        try:
            periodo = self._normalize_period(periodo)
            windows = self._resolve_comparison_windows(
                periodo,
                start_date,
                end_date,
                compare_start_date,
                compare_end_date
            )
        except ValueError as exc:
            return jsonify({"erro":str(exc)}),400

        rows = FeedbacksRepository().listar_analytics_wallet(wallet_id,canal_id)
        current_rows = self._filter_rows_by_date_range(
            rows,
            windows["current_start"],
            windows["current_end"]
        )
        compare_rows = self._filter_rows_by_date_range(
            rows,
            windows["compare_start"],
            windows["compare_end"]
        )
        series = self._extract_offenders(current_rows)
        current_success = self._calculate_offender_success(current_rows)
        compare_success = self._calculate_offender_success(compare_rows)
        current_distribution = self._extract_offender_distribution(current_rows)
        compare_distribution = self._extract_offender_distribution(compare_rows)
        current_group_distribution = self._extract_offender_group_distribution(current_rows)
        compare_group_distribution = self._extract_offender_group_distribution(compare_rows)

        offender_labels = sorted(set(current_distribution.keys()) | set(compare_distribution.keys()))
        offender_comparison = []

        for label in offender_labels:
            current_item = current_distribution.get(label,{
                "total": 0,
                "percentual": 0
            })
            previous_item = compare_distribution.get(label,{
                "total": 0,
                "percentual": 0
            })
            metric_comparison = self._build_metric_comparison(
                current_item["percentual"],
                previous_item["percentual"],
                False,
                label
            )

            offender_comparison.append({
                "label": label,
                "current_total": current_item["total"],
                "previous_total": previous_item["total"],
                "current_percentual": current_item["percentual"],
                "previous_percentual": previous_item["percentual"],
                "delta_percentual": metric_comparison["delta_value"],
                "delta_percent": metric_comparison["delta_percent"],
                "trend": metric_comparison["trend"],
            })

        group_labels = sorted(
            set(current_group_distribution.keys()) | set(compare_group_distribution.keys())
        )
        offender_group_comparison = []

        for label in group_labels:
            current_item = current_group_distribution.get(label,{
                "total": 0,
                "percentual": 0
            })
            previous_item = compare_group_distribution.get(label,{
                "total": 0,
                "percentual": 0
            })
            metric_comparison = self._build_metric_comparison(
                current_item["percentual"],
                previous_item["percentual"],
                False,
                label
            )

            offender_group_comparison.append({
                "label": label,
                "current_total": current_item["total"],
                "previous_total": previous_item["total"],
                "current_percentual": current_item["percentual"],
                "previous_percentual": previous_item["percentual"],
                "delta_percentual": metric_comparison["delta_value"],
                "delta_percent": metric_comparison["delta_percent"],
                "trend": metric_comparison["trend"],
            })

        offender_comparison.sort(
            key=lambda item: (
                -max(item["current_percentual"],item["previous_percentual"]),
                item["label"]
            )
        )
        offender_group_comparison.sort(
            key=lambda item: (
                -max(item["current_percentual"],item["previous_percentual"]),
                item["label"]
            )
        )

        return {
            "series": series,
            "resumo": {
                "total_ocorrencias": sum(item["total"] for item in series),
                "total_feedbacks": len(current_rows),
                "taxa_sucesso": current_success["taxa_sucesso"],
                "ocorrencias_por_feedback": current_success["ocorrencias_por_feedback"],
            },
            "comparativo": {
                **self._build_metric_comparison(
                    current_success["taxa_sucesso"],
                    compare_success["taxa_sucesso"],
                    True,
                    "Taxa de sucesso do checklist"
                ),
                "current_label": windows["current_label"],
                "previous_label": windows["compare_label"],
                "current_total_feedbacks": len(current_rows),
                "previous_total_feedbacks": len(compare_rows),
                "current_occurrences_per_feedback": current_success["ocorrencias_por_feedback"],
                "previous_occurrences_per_feedback": compare_success["ocorrencias_por_feedback"],
            },
            "itens_comparativo": offender_comparison[:12],
            "grupos_comparativo": offender_group_comparison
        }

    def operadores_carteira(self,wallet_id:str,canal_id:str=""):
        if not wallet_id:
            return jsonify({"erro":"wallet_id é obrigatório"}),400

        rows = FeedbacksRepository().listar_operadores_analytics_wallet(wallet_id,canal_id)
        return {
            "operadores": [
                {
                    "cpf": row.get("CPF_OPERADOR"),
                    "nome": row.get("OPERADOR"),
                    "total_feedbacks": int(row.get("TOTAL_FEEDBACKS") or 0),
                    "media_pontuacao": round(float(row.get("MEDIA_PONTUACAO") or 0),2)
                }
                for row in rows
            ]
        }

    def media_operador(
        self,
        wallet_id:str,
        cpf_operador:str,
        periodo:str,
        canal_id:str="",
        start_date:str="",
        end_date:str="",
        compare_start_date:str="",
        compare_end_date:str="",
    ):
        if not wallet_id or not cpf_operador:
            return jsonify({"erro":"wallet_id e cpf_operador são obrigatórios"}),400

        try:
            periodo = self._normalize_period(periodo)
            windows = self._resolve_comparison_windows(
                periodo,
                start_date,
                end_date,
                compare_start_date,
                compare_end_date
            )
        except ValueError as exc:
            return jsonify({"erro":str(exc)}),400

        rows = FeedbacksRepository().listar_analytics_operador(wallet_id,cpf_operador,canal_id)
        series = self._build_average_series(rows,periodo)
        current_rows = self._filter_rows_by_date_range(
            rows,
            windows["current_start"],
            windows["current_end"]
        )
        compare_rows = self._filter_rows_by_date_range(
            rows,
            windows["compare_start"],
            windows["compare_end"]
        )
        resumo = self._calculate_average_summary(current_rows)
        resumo_compare = self._calculate_average_summary(compare_rows)

        return {
            "series": series,
            "resumo": {
                "media_geral": resumo["media_geral"],
                "total_feedbacks": resumo["total_feedbacks"],
                "nome_operador": rows[0].get("OPERADOR") if rows else ""
            },
            "comparativo": {
                **self._build_metric_comparison(
                    resumo["media_geral"],
                    resumo_compare["media_geral"],
                    True,
                    "Média do operador"
                ),
                "current_label": windows["current_label"],
                "previous_label": windows["compare_label"],
                "current_total_feedbacks": resumo["total_feedbacks"],
                "previous_total_feedbacks": resumo_compare["total_feedbacks"],
            }
        }
