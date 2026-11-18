from src.application.services.permissao_service import PermissaoService
from src.infrastructure.repositories.sql_tarefas_kanban_repository import (
    TarefasKanbanRepository,
)
from src.infrastructure.repositories.sql_academia_repository import (
    AcademiaRepository,
)
from src.infrastructure.repositories.sql_arena_repository import (
    ArenaRepository,
)
from src.shared.utils.monitoria_permissoes import normalizar_texto
from datetime import date, datetime, time, timedelta
import calendar


class TarefasKanbanError(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


class TarefasKanbanService:
    STATUS = {
        "caixa_entrada",
        "para_hoje",
        "em_andamento",
        "aguardando",
        "concluido",
    }
    PRIORIDADES = {"baixa", "media", "alta", "urgente"}
    RECORRENCIAS = {"diaria", "semanal", "mensal"}
    LISTAS_PADRAO = (
        ("Caixa de entrada", "#94a3b8", "caixa_entrada"),
        ("Para hoje", "#f59e0b", "para_hoje"),
        ("Em andamento", "#38bdf8", "em_andamento"),
        ("Aguardando", "#a78bfa", "aguardando"),
        ("Concluído", "#34d399", "concluido"),
    )

    PAPEIS_QUADRO = {"DONO", "EDITOR", "LEITOR"}
    PAPEIS_EDICAO = {"DONO", "EDITOR"}

    # Funções que não abrem quadros nem equipes (FUNCAO_COLABORADOR).
    #
    # A comparação é por trecho, sobre o texto normalizado, porque a coluna
    # traz variações do mesmo cargo:
    #   "NEGOCIADOR" e "NEGOCIADOR |"
    #   "OMNICHANNEL" e "APRENDIZ OMNICHANNEL"
    #   "OPERADOR(A) COBRADOR(A)" e "APRENDIZ OPERADOR(A) COBRADOR"
    # além de espaços de preenchimento da coluna.
    FUNCOES_SEM_ABERTURA = (
        "operador(a) cobrador",
        "negociador",
        "omnichannel",
        "estagiario",
    )

    def __init__(self, permissoes=None):
        self.repo = TarefasKanbanRepository()
        self.permissoes = permissoes or PermissaoService()
        self._papeis_ok = None

    def _papeis_disponiveis(self):
        """A migration de papéis é opcional: sem ela o módulo segue com o
        modelo antigo, baseado só em cargo."""
        if self._papeis_ok is None:
            self._papeis_ok = self.repo.estrutura_papeis_disponivel()
        return self._papeis_ok

    def _papel_no_quadro(self, cpf, quadro):
        """Papel efetivo de alguém num quadro.

        Cargo na empresa não entra aqui — quem manda é a relação com o
        quadro. `MEMBRO_EQUIPE` é acesso de acompanhamento, sem edição,
        e preserva o comportamento anterior de quadro de equipe.
        """
        if str(cpf) in {
            str(quadro.get("CPF_CRIADOR") or ""),
            str(quadro.get("SUPERVISOR_CPF") or ""),
        }:
            return "DONO"

        if self._papeis_disponiveis():
            papel = self.repo.obter_papel_no_quadro(quadro["ID"], cpf)
            if papel:
                return papel

        equipe_id = quadro.get("ID_EQUIPE")
        if equipe_id and self.repo.usuario_eh_membro_aceito(equipe_id, cpf):
            return "MEMBRO_EQUIPE"
        return None

    @staticmethod
    def _eh_supervisor(usuario):
        funcao = normalizar_texto(usuario.get("FUNCAO"))
        return any(
            termo in funcao
            for termo in ("supervisor", "coordenador", "gerente", "admin")
        )

    def _usuario(self, cpf):
        usuario = self.repo.obter_usuario(str(cpf))
        if not usuario:
            raise TarefasKanbanError(
                "Usuário não encontrado ou inativo.",
                403
            )
        return usuario

    @classmethod
    def _pode_abrir_espacos(cls, usuario):
        """Quem pode abrir quadros novos e equipes.

        A linha de frente fica de fora — segue com o quadro pessoal e
        recebendo tarefas, mas sem abrir espaços que acabariam virando
        canal de conversa. Todo o restante da empresa pode.

        Função em branco também não abre: uma lacuna no cadastro não deve
        virar permissão.
        """
        funcao = normalizar_texto(usuario.get("FUNCAO"))
        if not funcao:
            return False
        return not any(
            termo in funcao for termo in cls.FUNCOES_SEM_ABERTURA
        )

    def _exigir_permissao_de_abertura(self, usuario):
        if not self._pode_abrir_espacos(usuario):
            raise TarefasKanbanError(
                "Sua função não abre quadros e equipes. Seu quadro "
                "pessoal e as tarefas atribuídas continuam disponíveis.",
                403
            )

    def _eh_gerencia_operacional(self, usuario):
        """Quem enxerga a Central de Gestao.

        Era CENTRO_CUSTO == 'gerencia operacional'. Agora e a area
        'gerencia.gestao' em TB_PERMISSAO_VISAO, porque a gerencia de TI e o
        especialista de recuperacao respondem pela mesma visao sem estarem
        lotados naquele centro de custo. O nome do metodo ficou para nao
        espalhar renomeacao pelos dois pontos que o chamam.
        """
        return "gerencia.gestao" in self.permissoes.areas_para(
            funcao=usuario.get("FUNCAO"),
            centro_custo=usuario.get("CENTRO_CUSTO"),
            cpf=usuario.get("CPF"),
        )

    @staticmethod
    def _iso(valor):
        if not valor:
            return None
        if hasattr(valor, "isoformat"):
            return valor.isoformat()
        return str(valor)

    @staticmethod
    def _status_legado(status):
        if status == "pendente":
            return "caixa_entrada"
        return status or "caixa_entrada"

    def _map_tarefa(self, row, checklists=None):
        """`checklists` é o mapa pré-carregado do quadro inteiro. Sem ele,
        cai na consulta individual (caminhos de tarefa única)."""
        checklist = (
            checklists.get(row["ID"], [])
            if checklists is not None
            else self.repo.listar_checklist(row["ID"])
        )
        return {
            "id": row["ID"],
            "titulo": row["TITULO"],
            "descricao": row.get("DESCRICAO") or "",
            "categoria": row.get("CATEGORIA") or "Geral",
            "prioridade": row.get("PRIORIDADE") or "media",
            "status": self._status_legado(row.get("STATUS")),
            "data_vencimento": self._iso(row.get("DATA_VENCIMENTO")),
            "hora_vencimento": self._iso(row.get("HORA_VENCIMENTO")),
            "data_criacao": self._iso(row.get("DATA_CRIACAO")),
            "data_atualizacao": self._iso(row.get("DATA_ATUALIZACAO")),
            "cpf_criador": str(row.get("CPF_CRIADOR") or ""),
            "cpf_responsavel": str(row.get("CPF_RESPONSAVEL") or ""),
            "criador_nome": row.get("CRIADOR_NOME") or "",
            "responsavel_nome": row.get("RESPONSAVEL_NOME") or "",
            "origem": row.get("ORIGEM") or "PESSOAL",
            "ordem": row.get("ORDEM_KANBAN") or 0,
            "equipe_id": row.get("ID_EQUIPE"),
            "equipe_nome": row.get("EQUIPE_NOME"),
            "quadro_id": row.get("ID_QUADRO"),
            "lista_id": row.get("ID_LISTA"),
            "lista_nome": row.get("LISTA_NOME"),
            "lista_cor": row.get("LISTA_COR") or "#94a3b8",
            "comentarios_total": row.get("COMENTARIOS_TOTAL") or 0,
            "anexos_total": row.get("ANEXOS_TOTAL") or 0,
            "sugerir_finalizacao": bool(
                row.get("SUGERIR_FINALIZACAO", True)
            ),
            "recorrencia_tipo": row.get("RECORRENCIA_TIPO"),
            "recorrencia_intervalo": (
                row.get("RECORRENCIA_INTERVALO") or 1
            ),
            "recorrencia_ate": self._iso(row.get("RECORRENCIA_ATE")),
            "lembrete_minutos": row.get("LEMBRETE_MINUTOS"),
            "id_tarefa_origem": row.get("ID_TAREFA_ORIGEM"),
            "id_proxima_ocorrencia": row.get("ID_PROXIMA_OCORRENCIA"),
            "checklist_total": row.get("CHECKLIST_TOTAL") or 0,
            "checklist_concluido": row.get("CHECKLIST_CONCLUIDO") or 0,
            "checklist": [
                {
                    "id": item["ID"],
                    "texto": item["TEXTO"],
                    "concluido": bool(item["CONCLUIDO"]),
                    "ordem": item["ORDEM"],
                }
                for item in checklist
            ],
        }

    def _config_recorrencia(self, data):
        tipo = str(data.get("recorrencia_tipo") or "").strip().lower()
        if not tipo or tipo == "nenhuma":
            return None, None, None
        if tipo not in self.RECORRENCIAS:
            raise TarefasKanbanError("Recorrência inválida.")
        if not data.get("data_vencimento"):
            raise TarefasKanbanError(
                "Tarefas recorrentes precisam de uma data inicial."
            )
        try:
            intervalo = max(
                1,
                min(30, int(data.get("recorrencia_intervalo") or 1))
            )
        except (TypeError, ValueError) as erro:
            raise TarefasKanbanError(
                "Intervalo de recorrência inválido."
            ) from erro
        recorrencia_ate = data.get("recorrencia_ate") or None
        if recorrencia_ate:
            try:
                recorrencia_ate = date.fromisoformat(
                    str(recorrencia_ate)
                ).isoformat()
            except ValueError as erro:
                raise TarefasKanbanError(
                    "Data final da recorrência inválida."
                ) from erro
        return tipo, intervalo, recorrencia_ate

    @staticmethod
    def _lembrete_minutos(data):
        valor = data.get("lembrete_minutos")
        if valor in (None, "", 0, "0"):
            return None
        try:
            minutos = int(valor)
        except (TypeError, ValueError) as erro:
            raise TarefasKanbanError("Lembrete inválido.") from erro
        permitidos = {15, 30, 60, 120, 1440, 2880, 10080}
        if minutos not in permitidos:
            raise TarefasKanbanError("Período de lembrete inválido.")
        return minutos

    @staticmethod
    def _proxima_data(data_atual, tipo, intervalo):
        if tipo == "diaria":
            return data_atual + timedelta(days=intervalo)
        if tipo == "semanal":
            return data_atual + timedelta(days=7 * intervalo)
        total_meses = data_atual.year * 12 + data_atual.month - 1 + intervalo
        ano, indice_mes = divmod(total_meses, 12)
        mes = indice_mes + 1
        dia = min(data_atual.day, calendar.monthrange(ano, mes)[1])
        return date(ano, mes, dia)

    @staticmethod
    def _map_quadro(row):
        return {
            "id": row["ID"],
            "nome": row["NOME"],
            "tipo": row["TIPO"],
            "cor": row.get("COR") or "#38bdf8",
            "favorito": bool(row.get("FAVORITO")),
            "equipe_id": row.get("ID_EQUIPE"),
            "pode_editar": bool(row.get("PODE_EDITAR")),
        }

    @staticmethod
    def _map_lista(row):
        return {
            "id": row["ID"],
            "nome": row["NOME"],
            "cor": row["COR"],
            "ordem": row["ORDEM"],
            "status_base": row.get("STATUS_BASE"),
        }

    def _criar_listas_padrao(self, quadro_id):
        existentes = self.repo.listar_listas(quadro_id)
        if existentes:
            return existentes
        for ordem, (nome, cor, status) in enumerate(self.LISTAS_PADRAO):
            self.repo.criar_lista(
                quadro_id,
                nome,
                cor,
                ordem,
                status
            )
        return self.repo.listar_listas(quadro_id)

    def _garantir_quadro_pessoal(self, cpf):
        quadros = self.repo.listar_quadros(cpf)
        pessoal = next(
            (
                quadro for quadro in quadros
                if quadro.get("TIPO") == "PESSOAL"
                and quadro.get("NOME") == "Meu planejamento"
            ),
            None
        )
        if not pessoal:
            criado = self.repo.criar_quadro(
                "Meu planejamento",
                "PESSOAL",
                cpf,
                "#8b5cf6"
            )
            pessoal = self.repo.obter_quadro(criado["ID"])
        self._criar_listas_padrao(pessoal["ID"])
        self.repo.vincular_tarefas_quadro(pessoal["ID"], cpf=cpf)
        self.repo.vincular_listas_padrao(pessoal["ID"])
        return pessoal

    def _garantir_quadro_equipe(self, equipe, cpf):
        existente = self.repo.obter_quadro_equipe(equipe["ID"])
        if existente:
            self._criar_listas_padrao(existente["ID"])
            self.repo.vincular_tarefas_quadro(
                existente["ID"],
                equipe_id=equipe["ID"]
            )
            self.repo.vincular_listas_padrao(existente["ID"])
            return existente
        criado = self.repo.criar_quadro(
            equipe["NOME"],
            "EQUIPE",
            equipe.get("SUPERVISOR_CPF") or cpf,
            "#0ea5e9",
            equipe["ID"]
        )
        self._criar_listas_padrao(criado["ID"])
        self.repo.vincular_tarefas_quadro(
            criado["ID"],
            equipe_id=equipe["ID"]
        )
        self.repo.vincular_listas_padrao(criado["ID"])
        return criado

    def _pode_acessar_quadro(self, cpf, quadro):
        return self._papel_no_quadro(cpf, quadro) is not None

    def _pode_editar_quadro(self, cpf, quadro):
        return self._papel_no_quadro(cpf, quadro) in self.PAPEIS_EDICAO

    def _pode_atribuir_no_quadro(self, cpf, quadro_id, responsavel_cpf):
        """Atribuição entre pares: quem edita o quadro pode passar uma
        tarefa a qualquer outro participante dele, sem precisar de cargo."""
        if not quadro_id or not self._papeis_disponiveis():
            return False
        quadro = self.repo.obter_quadro(quadro_id)
        if not quadro or not self._pode_editar_quadro(cpf, quadro):
            return False
        return self._papel_no_quadro(responsavel_cpf, quadro) is not None

    def _pode_acessar_tarefa(self, cpf, tarefa):
        if str(cpf) in {
            str(tarefa.get("CPF_CRIADOR") or ""),
            str(tarefa.get("CPF_RESPONSAVEL") or ""),
        }:
            return True
        usuario = self._usuario(cpf)
        return (
            self._eh_supervisor(usuario)
            and self.repo.supervisor_possui_tarefa(
                tarefa["ID_TODO"],
                cpf
            )
        )

    @staticmethod
    def _map_equipe(row):
        return {
            "id": row["ID"],
            "nome": row["NOME"],
            "centro_custo": row.get("CENTRO_CUSTO_REFERENCIA"),
            "membros": row.get("MEMBROS") or 0,
            "pendentes": row.get("PENDENTES") or 0,
            "status_convite": row.get("STATUS_CONVITE"),
            "supervisor_cpf": str(row.get("SUPERVISOR_CPF") or ""),
        }

    def carregar_quadro(
        self,
        cpf,
        visao="pessoal",
        equipe_id=None,
        quadro_id=None,
    ):
        usuario = self._usuario(cpf)
        supervisor = self._eh_supervisor(usuario)
        visoes = {"pessoal", "atribuidas", "equipe", "todas", "quadro"}
        if visao not in visoes:
            raise TarefasKanbanError("Visão de tarefas inválida.")

        if visao == "todas" and not supervisor:
            raise TarefasKanbanError(
                "A visão da equipe é restrita à supervisão.",
                403
            )

        if visao == "equipe":
            if not equipe_id:
                raise TarefasKanbanError("Selecione uma equipe.")
            pode_acessar = (
                self.repo.obter_equipe_supervisor(equipe_id, cpf)
                if supervisor
                else self.repo.usuario_eh_membro_aceito(equipe_id, cpf)
            )
            if not pode_acessar:
                raise TarefasKanbanError(
                    "Você não possui acesso a esta equipe.",
                    403
                )

        equipes_rows = (
            self.repo.listar_equipes_supervisor(cpf)
            if supervisor
            else self.repo.listar_equipes_membro(cpf)
        )
        quadro_pessoal = self._garantir_quadro_pessoal(cpf)
        for equipe in equipes_rows:
            self._garantir_quadro_equipe(equipe, cpf)

        quadro_ativo = None
        if visao == "quadro":
            if not quadro_id:
                raise TarefasKanbanError("Selecione um quadro.")
            quadro_ativo = self.repo.obter_quadro(quadro_id)
            if not quadro_ativo or not self._pode_acessar_quadro(
                cpf,
                quadro_ativo
            ):
                raise TarefasKanbanError(
                    "Você não possui acesso a este quadro.",
                    403
                )
            visao_repositorio = (
                "quadro"
                if self._pode_editar_quadro(cpf, quadro_ativo)
                else "quadro_membro"
            )
            rows = self.repo.listar_tarefas(
                cpf,
                visao_repositorio,
                quadro_id
            )
        else:
            visao_repositorio = (
                "equipe_membro"
                if visao == "equipe" and not supervisor
                else visao
            )
            rows = self.repo.listar_tarefas(
                cpf,
                visao_repositorio,
                equipe_id
            )
            if visao == "pessoal":
                quadro_ativo = self.repo.obter_quadro(
                    quadro_pessoal["ID"]
                )

        checklists = self.repo.listar_checklists_em_lote(
            [row["ID"] for row in rows]
        )
        quadros = self.repo.listar_quadros(cpf)
        listas = (
            self.repo.listar_listas(quadro_ativo["ID"])
            if quadro_ativo
            else []
        )
        if quadro_ativo:
            quadro_ativo = dict(quadro_ativo)
            quadro_ativo["PODE_EDITAR"] = self._pode_editar_quadro(
                cpf,
                quadro_ativo
            )
        return {
            "usuario": {
                "cpf": str(usuario["CPF"]),
                "nome": usuario["NOME"],
                "funcao": usuario["FUNCAO"],
                "centro_custo": usuario["CENTRO_CUSTO"],
                "supervisor": supervisor,
            },
            "tarefas": [
                self._map_tarefa(row, checklists) for row in rows
            ],
            "equipes": [self._map_equipe(row) for row in equipes_rows],
            "quadros": [self._map_quadro(row) for row in quadros],
            "quadro_ativo": (
                self._map_quadro(quadro_ativo)
                if quadro_ativo
                else None
            ),
            "listas": [self._map_lista(row) for row in listas],
            "convites": [
                {
                    "equipe_id": row["ID_EQUIPE"],
                    "equipe_nome": row["EQUIPE_NOME"],
                    "supervisor_nome": row.get("SUPERVISOR_NOME")
                    or "Supervisão",
                    "convidado_em": self._iso(row.get("CONVIDADO_EM")),
                }
                for row in self.repo.listar_convites(cpf)
            ],
        }

    def obter_central_gerencial(self, cpf, periodo=30, centro_custo=None):
        usuario = self._usuario(cpf)
        if not self._eh_gerencia_operacional(usuario):
            raise TarefasKanbanError(
                "A Central de Gestao e exclusiva da Gerencia Operacional.",
                403
            )

        try:
            periodo_dias = int(periodo)
        except (TypeError, ValueError):
            periodo_dias = 30
        if periodo_dias not in {7, 30, 90}:
            periodo_dias = 30
        centro_custo = str(centro_custo or "").strip() or None

        resumo_row = self.repo.obter_resumo_gerencial()
        total = int(resumo_row.get("TOTAL_TAREFAS") or 0)
        concluidas = int(resumo_row.get("CONCLUIDAS") or 0)

        def map_area(row):
            area_total = int(row.get("TOTAL_TAREFAS") or 0)
            area_concluidas = int(row.get("CONCLUIDAS") or 0)
            return {
                "centro_custo": row.get("CENTRO_CUSTO"),
                "equipes": int(row.get("EQUIPES") or 0),
                "colaboradores": int(row.get("COLABORADORES") or 0),
                "total_tarefas": area_total,
                "concluidas": area_concluidas,
                "em_andamento": int(row.get("EM_ANDAMENTO") or 0),
                "atrasadas": int(row.get("ATRASADAS") or 0),
                "taxa_conclusao": round(
                    (area_concluidas / area_total) * 100, 1
                ) if area_total else 0,
            }

        academia_dados = AcademiaRepository().obter_dashboard_admin()
        arena_dados = ArenaRepository().obter_dashboard_gerencial()

        academia_resumo = academia_dados.get("resumo") or {}
        academia_desempenho = academia_dados.get("desempenho") or []
        academia_abandonos = academia_dados.get("abandonos") or []
        academia_centros = {}
        for aluno in academia_dados.get("alunos") or []:
            centro = aluno.get("centro_custo") or "Nao informado"
            item = academia_centros.setdefault(centro, {
                "centro_custo": centro,
                "matriculas": 0,
                "concluidos": 0,
                "em_risco": 0,
                "interrompidos": 0,
                "progresso_total": 0.0,
            })
            item["matriculas"] += 1
            item["concluidos"] += int(
                aluno.get("status_matricula") == "CONCLUIDO"
            )
            item["em_risco"] += int(aluno.get("situacao") == "EM_RISCO")
            item["interrompidos"] += int(
                aluno.get("situacao") == "INTERROMPIDO"
            )
            item["progresso_total"] += float(aluno.get("progresso") or 0)

        academia_por_centro = []
        for item in academia_centros.values():
            matriculas = item["matriculas"]
            academia_por_centro.append({
                "centro_custo": item["centro_custo"],
                "matriculas": matriculas,
                "concluidos": item["concluidos"],
                "em_risco": item["em_risco"],
                "interrompidos": item["interrompidos"],
                "progresso_medio": round(
                    item["progresso_total"] / matriculas, 1
                ) if matriculas else 0,
            })
        academia_por_centro.sort(
            key=lambda item: (
                -(item["em_risco"] + item["interrompidos"]),
                -item["matriculas"],
            )
        )

        arena_resumo = arena_dados.get("resumo") or {}
        equipes_rows = self.repo.listar_equipes_gerenciais()
        areas_rows = self.repo.listar_resumo_gerencial_areas()
        atencoes_rows = self.repo.listar_atencoes_gerenciais()
        qualidade_dados = self.repo.obter_qualidade_gerencial(
            periodo_dias, centro_custo
        )
        uso_dados = self.repo.obter_uso_copilot_gerencial(
            periodo_dias, centro_custo
        )
        qualidade_resumo = qualidade_dados.get("resumo") or {}
        uso_resumo = uso_dados.get("resumo") or {}

        centros_disponiveis = sorted({
            str(item).strip()
            for item in (
                [row.get("centro_custo") for row in self.repo.listar_centros_custo_gerenciais()]
                + [row.get("CENTRO_CUSTO") for row in areas_rows]
                + [row.get("centro_custo") for row in equipes_rows]
                + [row.get("centro_custo") for row in academia_por_centro]
                + [row.get("centro_custo") for row in arena_dados.get("centros") or []]
                + [row.get("centro_custo") for row in uso_dados.get("centros") or []]
            )
            if item and str(item).strip()
        })

        if centro_custo:
            centro_normalizado = normalizar_texto(centro_custo)

            def mesmo_centro(valor):
                return normalizar_texto(str(valor or "")) == centro_normalizado

            areas_rows = [
                row for row in areas_rows
                if mesmo_centro(row.get("CENTRO_CUSTO"))
            ]
            atencoes_rows = [
                row for row in atencoes_rows
                if mesmo_centro(row.get("CENTRO_CUSTO"))
            ]
            equipes_rows = [
                row for row in equipes_rows
                if mesmo_centro(row.get("centro_custo"))
            ]
            academia_por_centro = [
                row for row in academia_por_centro
                if mesmo_centro(row.get("centro_custo"))
            ]
            alunos_centro = [
                aluno for aluno in academia_dados.get("alunos") or []
                if mesmo_centro(aluno.get("centro_custo"))
            ]
            cursos_centro = {}
            for aluno in alunos_centro:
                curso_id = aluno.get("curso_id")
                curso = cursos_centro.setdefault(curso_id, {
                    "curso_id": curso_id,
                    "titulo": aluno.get("curso_titulo"),
                    "matriculas": 0,
                    "concluidos": 0,
                    "progresso_total": 0.0,
                })
                curso["matriculas"] += 1
                curso["concluidos"] += int(
                    aluno.get("status_matricula") == "CONCLUIDO"
                )
                curso["progresso_total"] += float(
                    aluno.get("progresso") or 0
                )
            academia_desempenho = []
            for curso in cursos_centro.values():
                matriculas = curso["matriculas"]
                concluidos_curso = curso["concluidos"]
                academia_desempenho.append({
                    "curso_id": curso["curso_id"],
                    "titulo": curso["titulo"],
                    "matriculas": matriculas,
                    "concluidos": concluidos_curso,
                    "taxa_conclusao": round(
                        concluidos_curso / matriculas * 100, 1
                    ) if matriculas else 0,
                    "progresso_medio": round(
                        curso["progresso_total"] / matriculas, 1
                    ) if matriculas else 0,
                })
            academia_abandonos = []
            arena_dados = {
                **arena_dados,
                "centros": [
                    row for row in arena_dados.get("centros") or []
                    if mesmo_centro(row.get("centro_custo"))
                ],
                "campanhas": [
                    row for row in arena_dados.get("campanhas") or []
                    if mesmo_centro(row.get("centro_custo"))
                ],
            }

            if academia_por_centro:
                centro_academia = academia_por_centro[0]
                academia_resumo = {
                    **academia_resumo,
                    "total_matriculas": centro_academia["matriculas"],
                    "total_concluidos": centro_academia["concluidos"],
                    "alunos_em_risco": centro_academia["em_risco"],
                    "alunos_interrompidos": centro_academia["interrompidos"],
                    "conclusao_media": centro_academia["progresso_medio"],
                    "alunos_ativos": len({
                        aluno.get("cpf") for aluno in alunos_centro
                        if aluno.get("status_matricula") == "EM_ANDAMENTO"
                    }),
                    "total_iniciaram": sum(
                        int(aluno.get("aulas_iniciadas") or 0) > 0
                        for aluno in alunos_centro
                    ),
                }
            else:
                academia_resumo = {
                    **academia_resumo,
                    "total_matriculas": 0,
                    "total_concluidos": 0,
                    "alunos_em_risco": 0,
                    "alunos_interrompidos": 0,
                    "conclusao_media": 0,
                    "alunos_ativos": 0,
                    "total_iniciaram": 0,
                }

            arena_centros = arena_dados.get("centros") or []
            if arena_centros:
                centro_arena = arena_centros[0]
                campanhas_centro = arena_dados.get("campanhas") or []
                arena_resumo = {
                    **arena_resumo,
                    "campanhas": int(centro_arena.get("campanhas") or 0),
                    "participantes": int(centro_arena.get("participantes") or 0),
                    "convites": int(centro_arena.get("convites") or 0),
                    "confirmacoes": int(centro_arena.get("confirmacoes") or 0),
                    "xp_distribuido": int(centro_arena.get("xp") or 0),
                    "campanhas_ativas": sum(
                        normalizar_texto(item.get("status"))
                        in {"publicada", "sala_aberta", "em_andamento"}
                        for item in campanhas_centro
                    ),
                    "finalizadas": sum(
                        normalizar_texto(item.get("status")) == "finalizada"
                        for item in campanhas_centro
                    ),
                }
            else:
                arena_resumo = {
                    **arena_resumo,
                    "campanhas": 0,
                    "participantes": 0,
                    "convites": 0,
                    "confirmacoes": 0,
                    "xp_distribuido": 0,
                    "campanhas_ativas": 0,
                    "finalizadas": 0,
                }

            total = sum(int(row.get("TOTAL_TAREFAS") or 0) for row in areas_rows)
            concluidas = sum(int(row.get("CONCLUIDAS") or 0) for row in areas_rows)
            resumo_row = {
                "TOTAL_TAREFAS": total,
                "CONCLUIDAS": concluidas,
                "EM_ANDAMENTO": sum(int(row.get("EM_ANDAMENTO") or 0) for row in areas_rows),
                "ATRASADAS": sum(int(row.get("ATRASADAS") or 0) for row in areas_rows),
                "EQUIPES_COM_TAREFAS": sum(int(row.get("EQUIPES") or 0) for row in areas_rows),
                "AREAS": len(areas_rows),
            }

        return {
            "atualizado_em": datetime.now().isoformat(),
            "gestor": {
                "nome": usuario.get("NOME"),
                "centro_custo": usuario.get("CENTRO_CUSTO"),
            },
            "filtros": {
                "periodo_dias": periodo_dias,
                "centro_custo": centro_custo,
                "centros_disponiveis": centros_disponiveis,
            },
            "resumo": {
                "total_tarefas": total,
                "concluidas": concluidas,
                "em_andamento": int(resumo_row.get("EM_ANDAMENTO") or 0),
                "atrasadas": int(resumo_row.get("ATRASADAS") or 0),
                "equipes": int(resumo_row.get("EQUIPES_COM_TAREFAS") or 0),
                "areas": int(resumo_row.get("AREAS") or 0),
                "taxa_conclusao": round(
                    (concluidas / total) * 100, 1
                ) if total else 0,
            },
            "areas": [
                map_area(row)
                for row in areas_rows
            ],
            "atencoes": [
                {
                    "id": row.get("ID"),
                    "titulo": row.get("TITULO"),
                    "prioridade": row.get("PRIORIDADE") or "media",
                    "status": self._status_legado(row.get("STATUS")),
                    "data_vencimento": self._iso(
                        row.get("DATA_VENCIMENTO")
                    ),
                    "responsavel": row.get("RESPONSAVEL") or "Sem responsavel",
                    "equipe": row.get("EQUIPE") or "Tarefa pessoal",
                    "centro_custo": row.get("CENTRO_CUSTO"),
                    "dias_atraso": int(row.get("DIAS_ATRASO") or 0),
                }
                for row in atencoes_rows
            ],
            "evolucao": [
                {
                    "mes": row.get("MES_CHAVE"),
                    "criadas": int(row.get("CRIADAS") or 0),
                    "concluidas": int(row.get("CONCLUIDAS") or 0),
                }
                for row in self.repo.listar_evolucao_gerencial(centro_custo)
            ],
            "academia": {
                "resumo": {
                    "cursos_publicados": int(
                        academia_resumo.get("cursos_publicados") or 0
                    ),
                    "alunos_ativos": int(
                        academia_resumo.get("alunos_ativos") or 0
                    ),
                    "total_matriculas": int(
                        academia_resumo.get("total_matriculas") or 0
                    ),
                    "total_iniciaram": int(
                        academia_resumo.get("total_iniciaram") or 0
                    ),
                    "total_concluidos": int(
                        academia_resumo.get("total_concluidos") or 0
                    ),
                    "alunos_em_risco": int(
                        academia_resumo.get("alunos_em_risco") or 0
                    ),
                    "alunos_interrompidos": int(
                        academia_resumo.get("alunos_interrompidos") or 0
                    ),
                    "conclusao_media": float(
                        academia_resumo.get("conclusao_media") or 0
                    ),
                },
                "desempenho": [
                    {
                        "curso_id": row.get("curso_id"),
                        "titulo": row.get("titulo"),
                        "matriculas": int(row.get("matriculas") or 0),
                        "concluidos": int(row.get("concluidos") or 0),
                        "taxa_conclusao": float(
                            row.get("taxa_conclusao") or 0
                        ),
                        "progresso_medio": float(
                            row.get("progresso_medio") or 0
                        ),
                    }
                    for row in academia_desempenho
                ],
                "abandonos": [
                    {
                        "aula_titulo": row.get("aula_titulo"),
                        "curso_titulo": row.get("curso_titulo"),
                        "abandonos": int(row.get("abandonos") or 0),
                        "taxa_abandono": float(
                            row.get("taxa_abandono") or 0
                        ),
                    }
                    for row in academia_abandonos
                ],
                "centros": academia_por_centro,
            },
            "arena": {
                "resumo": {
                    "campanhas": int(arena_resumo.get("campanhas") or 0),
                    "campanhas_ativas": int(
                        arena_resumo.get("campanhas_ativas") or 0
                    ),
                    "finalizadas": int(
                        arena_resumo.get("finalizadas") or 0
                    ),
                    "participantes": int(
                        arena_resumo.get("participantes") or 0
                    ),
                    "convites": int(arena_resumo.get("convites") or 0),
                    "confirmacoes": int(
                        arena_resumo.get("confirmacoes") or 0
                    ),
                    "xp_distribuido": int(
                        arena_resumo.get("xp_distribuido") or 0
                    ),
                },
                "centros": [
                    {
                        "centro_custo": row.get("centro_custo"),
                        "campanhas": int(row.get("campanhas") or 0),
                        "participantes": int(row.get("participantes") or 0),
                        "convites": int(row.get("convites") or 0),
                        "confirmacoes": int(row.get("confirmacoes") or 0),
                        "participacoes_finalizadas": int(
                            row.get("participacoes_finalizadas") or 0
                        ),
                        "xp": int(row.get("xp") or 0),
                    }
                    for row in arena_dados.get("centros") or []
                ],
                "campanhas": [
                    {
                        "id": row.get("id"),
                        "titulo": row.get("titulo"),
                        "status": row.get("status"),
                        "centro_custo": row.get("centro_custo"),
                        "tipo_jogo": row.get("tipo_jogo"),
                        "data_agendada": self._iso(
                            row.get("data_agendada")
                        ),
                        "participantes": int(
                            row.get("participantes") or 0
                        ),
                        "confirmacoes": int(
                            row.get("confirmacoes") or 0
                        ),
                    }
                    for row in arena_dados.get("campanhas") or []
                ],
            },
            "equipes": {
                "resumo": {
                    "equipes": len(equipes_rows),
                    "membros": sum(
                        int(row.get("membros") or 0) for row in equipes_rows
                    ),
                    "convites_pendentes": sum(
                        int(row.get("convites_pendentes") or 0)
                        for row in equipes_rows
                    ),
                    "tarefas": sum(
                        int(row.get("tarefas") or 0) for row in equipes_rows
                    ),
                    "atrasadas": sum(
                        int(row.get("atrasadas") or 0) for row in equipes_rows
                    ),
                },
                "lista": [
                    {
                        "id": row.get("id"),
                        "nome": row.get("nome"),
                        "centro_custo": row.get("centro_custo"),
                        "supervisor": row.get("supervisor") or "Nao informado",
                        "membros": int(row.get("membros") or 0),
                        "convites_pendentes": int(
                            row.get("convites_pendentes") or 0
                        ),
                        "tarefas": int(row.get("tarefas") or 0),
                        "concluidas": int(row.get("concluidas") or 0),
                        "atrasadas": int(row.get("atrasadas") or 0),
                    }
                    for row in equipes_rows
                ],
            },
            "qualidade": {
                "resumo": {
                    "monitorias": int(
                        qualidade_resumo.get("monitorias") or 0
                    ),
                    "operadores": int(
                        qualidade_resumo.get("operadores") or 0
                    ),
                    "monitores": int(
                        qualidade_resumo.get("monitores") or 0
                    ),
                    "nota_media": float(
                        qualidade_resumo.get("nota_media") or 0
                    ),
                    "negativas": int(
                        qualidade_resumo.get("negativas") or 0
                    ),
                    "ultimos_30_dias": int(
                        qualidade_resumo.get("ultimos_30_dias") or 0
                    ),
                    "monitorias_anteriores": int(
                        qualidade_resumo.get("monitorias_anteriores") or 0
                    ),
                    "nota_media_anterior": float(
                        qualidade_resumo.get("nota_media_anterior") or 0
                    ),
                },
                "carteiras": [
                    {
                        "carteira": row.get("carteira"),
                        "monitorias": int(row.get("monitorias") or 0),
                        "operadores": int(row.get("operadores") or 0),
                        "nota_media": float(row.get("nota_media") or 0),
                        "negativas": int(row.get("negativas") or 0),
                        "ultima_monitoria": self._iso(
                            row.get("ultima_monitoria")
                        ),
                    }
                    for row in qualidade_dados.get("carteiras") or []
                ],
                "evolucao": [
                    {
                        "mes": row.get("mes"),
                        "monitorias": int(row.get("monitorias") or 0),
                        "nota_media": float(row.get("nota_media") or 0),
                    }
                    for row in qualidade_dados.get("evolucao") or []
                ],
            },
            "uso_copilot": {
                "resumo": {
                    "acessos": int(uso_resumo.get("acessos") or 0),
                    "usuarios": int(uso_resumo.get("usuarios") or 0),
                    "acessos_30_dias": int(
                        uso_resumo.get("acessos_30_dias") or 0
                    ),
                    "usuarios_30_dias": int(
                        uso_resumo.get("usuarios_30_dias") or 0
                    ),
                    "acessos_anteriores": int(
                        uso_resumo.get("acessos_anteriores") or 0
                    ),
                    "usuarios_anteriores": int(
                        uso_resumo.get("usuarios_anteriores") or 0
                    ),
                    "ultimo_acesso": self._iso(
                        uso_resumo.get("ultimo_acesso")
                    ),
                },
                "centros": [
                    {
                        "centro_custo": row.get("centro_custo"),
                        "acessos": int(row.get("acessos") or 0),
                        "usuarios": int(row.get("usuarios") or 0),
                        "ultimo_acesso": self._iso(
                            row.get("ultimo_acesso")
                        ),
                    }
                    for row in uso_dados.get("centros") or []
                ],
                "comandos": [
                    {
                        "comando": row.get("comando"),
                        "usos": int(row.get("usos") or 0),
                        "usuarios": int(row.get("usuarios") or 0),
                    }
                    for row in uso_dados.get("comandos") or []
                ],
            },
        }

    def registrar_uso_copilot(self, cpf, data):
        usuario = self._usuario(cpf)
        comando = " ".join(str(data.get("comando") or "").strip().split())
        if not comando.startswith("@") or len(comando) > 80:
            raise TarefasKanbanError("Comando de telemetria invalido.")
        self.repo.registrar_evento_uso(
            cpf,
            comando,
            usuario.get("CENTRO_CUSTO"),
        )
        return {"registrado": True}

    def criar_tarefa(self, cpf, data):
        criador = self._usuario(cpf)
        titulo = str(data.get("titulo") or "").strip()
        if not titulo:
            raise TarefasKanbanError("Informe o título da tarefa.")

        prioridade = str(data.get("prioridade") or "media").lower()
        if prioridade not in self.PRIORIDADES:
            raise TarefasKanbanError("Prioridade inválida.")
        status = str(data.get("status") or "caixa_entrada").lower()
        if status not in self.STATUS:
            raise TarefasKanbanError("Status inválido.")

        responsavel_cpf = str(data.get("cpf_responsavel") or cpf)
        equipe_id = data.get("equipe_id")
        quadro_id = data.get("quadro_id")
        lista_id = data.get("lista_id")
        origem = "PESSOAL"
        if responsavel_cpf != str(cpf):
            # Dois caminhos legítimos: ser dono da equipe do responsável,
            # ou dividir com ele um quadro em que você pode editar. O cargo
            # na empresa deixou de ser exigência.
            if equipe_id:
                if not self.repo.obter_equipe_supervisor(equipe_id, cpf):
                    raise TarefasKanbanError(
                        "Você não administra esta equipe.",
                        403
                    )
                if not self.repo.usuario_eh_membro_aceito(
                    equipe_id,
                    responsavel_cpf
                ):
                    raise TarefasKanbanError(
                        "O responsável precisa aceitar o convite da equipe.",
                        409
                    )
                origem = "EQUIPE"
            elif not self._pode_atribuir_no_quadro(
                cpf,
                quadro_id,
                responsavel_cpf
            ):
                raise TarefasKanbanError(
                    "Você só pode atribuir tarefas a quem divide um quadro "
                    "ou uma equipe com você.",
                    403
                )
        else:
            equipe_id = None

        if quadro_id:
            quadro = self.repo.obter_quadro(quadro_id)
            if not quadro or not self._pode_acessar_quadro(cpf, quadro):
                raise TarefasKanbanError("Quadro inválido.", 403)
            if quadro.get("ID_EQUIPE"):
                equipe_id = quadro["ID_EQUIPE"]
                origem = "EQUIPE"
        else:
            quadro = self._garantir_quadro_pessoal(cpf)
            quadro_id = quadro["ID"]

        if lista_id:
            lista = self.repo.obter_lista(lista_id)
            if not lista or str(lista["ID_QUADRO"]) != str(quadro_id):
                raise TarefasKanbanError("Lista inválida.", 403)
            status = lista.get("STATUS_BASE") or status
        else:
            listas = self._criar_listas_padrao(quadro_id)
            lista = next(
                (
                    item for item in listas
                    if item.get("STATUS_BASE") == status
                ),
                listas[0]
            )
            lista_id = lista["ID"]

        recorrencia_tipo, recorrencia_intervalo, recorrencia_ate = (
            self._config_recorrencia(data)
        )
        lembrete_minutos = self._lembrete_minutos(data)
        responsavel = self._usuario(responsavel_cpf)
        criado = self.repo.criar_tarefa(
            usuario_nome=responsavel["NOME"],
            cpf_criador=str(cpf),
            cpf_responsavel=responsavel_cpf,
            titulo=titulo,
            descricao=str(data.get("descricao") or "").strip(),
            categoria=str(data.get("categoria") or "Geral").strip(),
            prioridade=prioridade,
            status=status,
            data_vencimento=data.get("data_vencimento") or None,
            hora_vencimento=data.get("hora_vencimento") or None,
            origem=origem,
            equipe_id=equipe_id,
            quadro_id=quadro_id,
            lista_id=lista_id,
            recorrencia_tipo=recorrencia_tipo,
            recorrencia_intervalo=recorrencia_intervalo,
            recorrencia_ate=recorrencia_ate,
            lembrete_minutos=lembrete_minutos,
        )
        if not criado:
            raise TarefasKanbanError("Não foi possível criar a tarefa.", 500)
        self.repo.substituir_checklist(
            criado["ID"],
            data.get("checklist") or []
        )
        self.repo.registrar_historico(
            criado["ID"],
            cpf,
            "CRIACAO",
            f"{criador['NOME']} criou a tarefa."
        )
        if responsavel_cpf != str(cpf):
            self.repo.criar_notificacao(
                responsavel_cpf,
                "ATRIBUICAO",
                "Nova tarefa atribuída",
                f'{criador["NOME"]} atribuiu "{titulo}" a você.',
                criado["ID"],
                f"ATRIBUICAO:{criado['ID']}:{responsavel_cpf}",
            )
        return {"id": criado["ID"]}

    def atualizar_tarefa(self, cpf, id_todo, data):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if str(tarefa.get("CPF_CRIADOR") or "") != str(cpf):
            raise TarefasKanbanError(
                "Somente quem criou a tarefa pode editar seus dados.",
                403
            )

        prioridade = str(data.get("prioridade") or "media").lower()
        if prioridade not in self.PRIORIDADES:
            raise TarefasKanbanError("Prioridade inválida.")
        titulo = str(data.get("titulo") or "").strip()
        if not titulo:
            raise TarefasKanbanError("Informe o título da tarefa.")

        recorrencia_tipo, recorrencia_intervalo, recorrencia_ate = (
            self._config_recorrencia(data)
        )
        lembrete_minutos = self._lembrete_minutos(data)
        self.repo.atualizar_tarefa(
            id_todo=id_todo,
            titulo=titulo,
            descricao=str(data.get("descricao") or "").strip(),
            categoria=str(data.get("categoria") or "Geral").strip(),
            prioridade=prioridade,
            data_vencimento=data.get("data_vencimento") or None,
            hora_vencimento=data.get("hora_vencimento") or None,
            recorrencia_tipo=recorrencia_tipo,
            recorrencia_intervalo=recorrencia_intervalo,
            recorrencia_ate=recorrencia_ate,
            lembrete_minutos=lembrete_minutos,
        )
        self.repo.substituir_checklist(
            id_todo,
            data.get("checklist") or []
        )
        self.repo.registrar_historico(
            id_todo,
            cpf,
            "EDICAO",
            "Os detalhes da tarefa foram atualizados."
        )
        return {"status": "ok"}

    def _gerar_proxima_ocorrencia(self, tarefa, cpf_autor):
        tipo = str(tarefa.get("RECORRENCIA_TIPO") or "").lower()
        if (
            tipo not in self.RECORRENCIAS
            or tarefa.get("ID_PROXIMA_OCORRENCIA")
            or not tarefa.get("DATA_VENCIMENTO")
        ):
            return None

        data_atual = tarefa["DATA_VENCIMENTO"]
        if isinstance(data_atual, datetime):
            data_atual = data_atual.date()
        elif not isinstance(data_atual, date):
            data_atual = date.fromisoformat(str(data_atual)[:10])
        intervalo = int(tarefa.get("RECORRENCIA_INTERVALO") or 1)
        proxima_data = self._proxima_data(data_atual, tipo, intervalo)
        recorrencia_ate = tarefa.get("RECORRENCIA_ATE")
        if isinstance(recorrencia_ate, datetime):
            recorrencia_ate = recorrencia_ate.date()
        elif recorrencia_ate and not isinstance(recorrencia_ate, date):
            recorrencia_ate = date.fromisoformat(
                str(recorrencia_ate)[:10]
            )
        if recorrencia_ate and proxima_data > recorrencia_ate:
            return None

        listas = self.repo.listar_listas(tarefa.get("ID_QUADRO"))
        lista_inicial = next(
            (
                item for item in listas
                if item.get("STATUS_BASE") == "caixa_entrada"
            ),
            listas[0] if listas else None,
        )
        responsavel = self._usuario(tarefa.get("CPF_RESPONSAVEL"))
        criada = self.repo.criar_tarefa(
            usuario_nome=responsavel["NOME"],
            cpf_criador=str(tarefa.get("CPF_CRIADOR") or cpf_autor),
            cpf_responsavel=str(tarefa.get("CPF_RESPONSAVEL") or cpf_autor),
            titulo=tarefa.get("TITULO") or "Tarefa recorrente",
            descricao=tarefa.get("DESCRICAO") or "",
            categoria=tarefa.get("CATEGORIA") or "Geral",
            prioridade=tarefa.get("PRIORIDADE") or "media",
            status="caixa_entrada",
            data_vencimento=proxima_data.isoformat(),
            hora_vencimento=tarefa.get("HORA_VENCIMENTO"),
            origem=tarefa.get("ORIGEM") or "PESSOAL",
            equipe_id=tarefa.get("ID_EQUIPE"),
            quadro_id=tarefa.get("ID_QUADRO"),
            lista_id=lista_inicial["ID"] if lista_inicial else None,
            recorrencia_tipo=tipo,
            recorrencia_intervalo=intervalo,
            recorrencia_ate=(
                recorrencia_ate.isoformat() if recorrencia_ate else None
            ),
            lembrete_minutos=tarefa.get("LEMBRETE_MINUTOS"),
            id_tarefa_origem=(
                tarefa.get("ID_TAREFA_ORIGEM") or tarefa.get("ID_TODO")
            ),
        )
        if not criada:
            return None
        checklist = [
            {
                "texto": item["TEXTO"],
                "concluido": False,
            }
            for item in self.repo.listar_checklist(tarefa["ID_TODO"])
        ]
        self.repo.substituir_checklist(criada["ID"], checklist)
        self.repo.vincular_proxima_ocorrencia(
            tarefa["ID_TODO"],
            criada["ID"],
        )
        self.repo.registrar_historico(
            criada["ID"],
            cpf_autor,
            "RECORRENCIA",
            (
                "Esta ocorrência foi criada automaticamente "
                "a partir de uma tarefa concluída."
            ),
        )
        self.repo.criar_notificacao(
            tarefa.get("CPF_RESPONSAVEL"),
            "RECORRENCIA",
            "Próxima ocorrência criada",
            (
                f'A próxima ocorrência de "{tarefa.get("TITULO")}" '
                f"foi agendada para {proxima_data.strftime('%d/%m/%Y')}."
            ),
            criada["ID"],
            f"RECORRENCIA:{tarefa['ID_TODO']}",
        )
        return criada["ID"]

    def mover_tarefa(
        self,
        cpf,
        id_todo,
        status,
        ordem=0,
        lista_id=None,
    ):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if str(cpf) not in {
            str(tarefa.get("CPF_CRIADOR") or ""),
            str(tarefa.get("CPF_RESPONSAVEL") or ""),
        }:
            raise TarefasKanbanError(
                "Você não pode movimentar esta tarefa.",
                403
            )
        if lista_id:
            lista = self.repo.obter_lista(lista_id)
            if not lista:
                raise TarefasKanbanError("Lista não encontrada.", 404)
            if str(lista.get("ID_QUADRO") or "") != str(
                tarefa.get("ID_QUADRO") or ""
            ):
                raise TarefasKanbanError(
                    "A lista não pertence ao quadro da tarefa.",
                    403
                )
            status = lista.get("STATUS_BASE") or status or "caixa_entrada"
        if status not in self.STATUS:
            raise TarefasKanbanError("Status inválido.")
        status_anterior = self._status_legado(tarefa.get("STATUS"))
        self.repo.mover_tarefa(
            id_todo,
            status,
            int(ordem or 0),
            lista_id
        )
        if status == "concluido" and status_anterior != "concluido":
            self._gerar_proxima_ocorrencia(tarefa, cpf)
        if status_anterior != status:
            self.repo.registrar_historico(
                id_todo,
                cpf,
                "MOVIMENTACAO",
                "A tarefa foi movida entre etapas.",
                status_anterior,
                status
            )
        return {"status": "ok"}

    def reagendar_tarefa(
        self,
        cpf,
        id_todo,
        data_vencimento,
        hora_vencimento=None,
    ):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if str(cpf) not in {
            str(tarefa.get("CPF_CRIADOR") or ""),
            str(tarefa.get("CPF_RESPONSAVEL") or ""),
        }:
            raise TarefasKanbanError(
                "Você não pode reagendar esta tarefa.",
                403
            )

        try:
            data_normalizada = date.fromisoformat(
                str(data_vencimento or "")
            ).isoformat()
        except ValueError as erro:
            raise TarefasKanbanError(
                "Informe uma data de vencimento válida."
            ) from erro

        hora_normalizada = None
        if hora_vencimento:
            try:
                hora_normalizada = time.fromisoformat(
                    str(hora_vencimento)
                ).strftime("%H:%M")
            except ValueError as erro:
                raise TarefasKanbanError(
                    "Informe um horário válido."
                ) from erro

        data_anterior = self._iso(tarefa.get("DATA_VENCIMENTO"))
        hora_anterior = self._iso(tarefa.get("HORA_VENCIMENTO"))
        self.repo.reagendar_tarefa(
            id_todo,
            data_normalizada,
            hora_normalizada,
        )
        self.repo.registrar_historico(
            id_todo,
            cpf,
            "REAGENDAMENTO",
            "A data da tarefa foi alterada pelo calendário.",
            " ".join(
                parte
                for parte in (data_anterior, hora_anterior)
                if parte
            ) or "Sem data",
            " ".join(
                parte
                for parte in (data_normalizada, hora_normalizada)
                if parte
            ),
        )
        return {"status": "ok"}

    def criar_quadro_pessoal(self, cpf, data):
        # Só a criação manual de quadros extras é restrita. O quadro
        # padrão ("Meu planejamento") continua nascendo para todo mundo
        # em _garantir_quadro_pessoal.
        usuario = self._usuario(cpf)
        self._exigir_permissao_de_abertura(usuario)
        nome = str(data.get("nome") or "").strip()
        cor = str(data.get("cor") or "#8b5cf6").strip()
        if not nome:
            raise TarefasKanbanError("Informe o nome do quadro.")
        if len(nome) > 120:
            raise TarefasKanbanError("Nome do quadro muito longo.")
        criado = self.repo.criar_quadro(
            nome,
            "PESSOAL",
            cpf,
            cor
        )
        self._criar_listas_padrao(criado["ID"])
        if self._papeis_disponiveis():
            self.repo.definir_papel_no_quadro(
                criado["ID"],
                cpf,
                "DONO",
                cpf
            )
        return {"id": criado["ID"], "nome": nome}

    def criar_lista(self, cpf, quadro_id, data):
        self._usuario(cpf)
        quadro = self.repo.obter_quadro(quadro_id)
        if not quadro or not self._pode_editar_quadro(cpf, quadro):
            raise TarefasKanbanError(
                "Você não pode alterar este quadro.",
                403
            )
        nome = str(data.get("nome") or "").strip()
        cor = str(data.get("cor") or "#38bdf8").strip()
        if not nome:
            raise TarefasKanbanError("Informe o nome da lista.")
        listas = self.repo.listar_listas(quadro_id)
        criado = self.repo.criar_lista(
            quadro_id,
            nome,
            cor,
            len(listas),
            None
        )
        return {
            "id": criado["ID"],
            "nome": nome,
            "cor": cor,
            "ordem": len(listas),
            "status_base": None,
        }

    def atualizar_checklist(self, cpf, id_todo, checklist):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if str(cpf) not in {
            str(tarefa.get("CPF_CRIADOR") or ""),
            str(tarefa.get("CPF_RESPONSAVEL") or ""),
        }:
            raise TarefasKanbanError(
                "Você não pode atualizar este checklist.",
                403
            )
        if not isinstance(checklist, list):
            raise TarefasKanbanError("Checklist inválido.")
        self.repo.substituir_checklist(id_todo, checklist[:30])
        self.repo.registrar_historico(
            id_todo,
            cpf,
            "CHECKLIST",
            "O checklist da tarefa foi atualizado."
        )
        return {"status": "ok"}

    def arquivar_tarefa(self, cpf, id_todo):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if str(tarefa.get("CPF_CRIADOR") or "") != str(cpf):
            raise TarefasKanbanError(
                "Somente quem criou a tarefa pode arquivá-la.",
                403
            )
        self.repo.arquivar_tarefa(id_todo)
        self.repo.registrar_historico(
            id_todo,
            cpf,
            "ARQUIVAMENTO",
            "A tarefa foi arquivada."
        )
        return {"status": "ok"}

    def obter_detalhes(self, cpf, id_todo):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if not self._pode_acessar_tarefa(cpf, tarefa):
            raise TarefasKanbanError(
                "Você não possui acesso a esta tarefa.",
                403
            )

        return {
            "comentarios": [
                {
                    "id": row["ID"],
                    "cpf_autor": str(row.get("CPF_AUTOR") or ""),
                    "autor_nome": row.get("AUTOR_NOME") or "Colaborador",
                    "conteudo": row["CONTEUDO"],
                    "criado_em": self._iso(row.get("CREATED_AT")),
                }
                for row in self.repo.listar_comentarios(id_todo)
            ],
            "historico": [
                {
                    "id": row["ID"],
                    "cpf_autor": str(row.get("CPF_AUTOR") or ""),
                    "autor_nome": row.get("AUTOR_NOME") or "Colaborador",
                    "acao": row["ACAO"],
                    "descricao": row["DESCRICAO"],
                    "valor_anterior": row.get("VALOR_ANTERIOR"),
                    "valor_novo": row.get("VALOR_NOVO"),
                    "criado_em": self._iso(row.get("CREATED_AT")),
                }
                for row in self.repo.listar_historico(id_todo)
            ],
            "anexos": [
                {
                    "id": row["ID"],
                    "cpf_autor": str(row.get("CPF_AUTOR") or ""),
                    "autor_nome": row.get("AUTOR_NOME") or "Colaborador",
                    "nome": row["NOME_ARQUIVO"],
                    "url": row["URL_ARQUIVO"],
                    "criado_em": self._iso(row.get("CREATED_AT")),
                }
                for row in self.repo.listar_anexos(id_todo)
            ],
        }

    def adicionar_comentario(self, cpf, id_todo, conteudo):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if not self._pode_acessar_tarefa(cpf, tarefa):
            raise TarefasKanbanError(
                "Você não pode comentar nesta tarefa.",
                403
            )
        texto = str(conteudo or "").strip()
        if not texto:
            raise TarefasKanbanError("Escreva um comentário.")
        if len(texto) > 1500:
            raise TarefasKanbanError(
                "O comentário pode ter no máximo 1.500 caracteres."
            )
        criado = self.repo.adicionar_comentario(id_todo, cpf, texto)
        self.repo.registrar_historico(
            id_todo,
            cpf,
            "COMENTARIO",
            "Um comentário foi adicionado."
        )
        autor = self._usuario(cpf)
        destinatarios = {
            str(tarefa.get("CPF_CRIADOR") or ""),
            str(tarefa.get("CPF_RESPONSAVEL") or ""),
        } - {"", str(cpf)}
        for destinatario in destinatarios:
            self.repo.criar_notificacao(
                destinatario,
                "COMENTARIO",
                "Novo comentário",
                (
                    f'{autor["NOME"]} comentou em '
                    f'"{tarefa.get("TITULO")}".'
                ),
                id_todo,
            )
        return {"id": criado["ID"]}

    def adicionar_anexo(self, cpf, id_todo, data):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if not self._pode_acessar_tarefa(cpf, tarefa):
            raise TarefasKanbanError(
                "Você não pode anexar arquivos a esta tarefa.",
                403
            )
        nome = str(data.get("nome") or "").strip()
        url = str(data.get("url") or "").strip()
        if not nome or not url:
            raise TarefasKanbanError("Informe o nome e o link do anexo.")
        if len(nome) > 260 or len(url) > 1200:
            raise TarefasKanbanError("Dados do anexo excedem o limite.")
        if not url.lower().startswith(("https://", "http://")):
            raise TarefasKanbanError(
                "O anexo precisa utilizar um link HTTP ou HTTPS."
            )
        criado = self.repo.adicionar_anexo(id_todo, cpf, nome, url)
        self.repo.registrar_historico(
            id_todo,
            cpf,
            "ANEXO",
            f"O anexo {nome} foi adicionado."
        )
        return {"id": criado["ID"]}

    def atualizar_automacao(self, cpf, id_todo, ativa):
        tarefa = self.repo.obter_tarefa(id_todo)
        if not tarefa:
            raise TarefasKanbanError("Tarefa não encontrada.", 404)
        if not self._pode_acessar_tarefa(cpf, tarefa):
            raise TarefasKanbanError(
                "Você não pode alterar esta automação.",
                403
            )
        valor = bool(ativa)
        self.repo.atualizar_automacao(id_todo, valor)
        self.repo.registrar_historico(
            id_todo,
            cpf,
            "AUTOMACAO",
            (
                "A sugestão automática de finalização foi ativada."
                if valor
                else "A sugestão automática de finalização foi desativada."
            )
        )
        return {"ativa": valor}

    @staticmethod
    def _momento_vencimento(tarefa):
        data_vencimento = tarefa.get("DATA_VENCIMENTO")
        if isinstance(data_vencimento, datetime):
            data_vencimento = data_vencimento.date()
        elif not isinstance(data_vencimento, date):
            data_vencimento = date.fromisoformat(
                str(data_vencimento)[:10]
            )
        hora_vencimento = tarefa.get("HORA_VENCIMENTO")
        if isinstance(hora_vencimento, datetime):
            hora_vencimento = hora_vencimento.time()
        elif hora_vencimento and not isinstance(hora_vencimento, time):
            hora_vencimento = time.fromisoformat(
                str(hora_vencimento)[:8]
            )
        return (
            data_vencimento,
            datetime.combine(data_vencimento, hora_vencimento or time(23, 59))
        )

    def _avaliar_lembrete(self, cpf, tarefa, agora=None):
        """Cria a notificação de lembrete/atraso de uma tarefa.

        Idempotente: a chave de deduplicação impede repetir o mesmo aviso.
        Devolve o tipo gerado, ou None quando ainda não é hora.
        """
        agora = agora or datetime.now()
        try:
            data_vencimento, vencimento = self._momento_vencimento(tarefa)
        except (TypeError, ValueError):
            return None

        minutos = int(tarefa.get("LEMBRETE_MINUTOS") or 0)
        id_todo = tarefa["ID_TODO"]
        titulo = tarefa.get("TITULO") or "Tarefa"

        if agora > vencimento:
            self.repo.criar_notificacao(
                cpf,
                "ATRASO",
                "Tarefa atrasada",
                f'"{titulo}" passou do prazo.',
                id_todo,
                f"ATRASO:{cpf}:{id_todo}:{data_vencimento.isoformat()}",
            )
            return "ATRASO"

        if agora >= vencimento - timedelta(minutes=minutos):
            self.repo.criar_notificacao(
                cpf,
                "LEMBRETE",
                "Lembrete de tarefa",
                (
                    f'"{titulo}" vence em '
                    f"{vencimento.strftime('%d/%m às %H:%M')}."
                ),
                id_todo,
                f"LEMBRETE:{cpf}:{id_todo}:{vencimento.isoformat()}",
            )
            return "LEMBRETE"

        return None

    def _gerar_lembretes_pendentes(self, cpf):
        agora = datetime.now()
        for tarefa in self.repo.listar_tarefas_para_lembrete(cpf):
            self._avaliar_lembrete(cpf, tarefa, agora)

    def despachar_lembretes(self, cpf):
        """Gera lembretes e avisos de atraso de TODOS os colaboradores.

        Feito para ser chamado por um agendador. Sem isso, o lembrete só
        nascia quando a própria pessoa abria a tela — ou seja, avisava
        apenas quem já estava olhando.
        """
        usuario = self._usuario(cpf)
        if not (
            self._eh_supervisor(usuario)
            or self._eh_gerencia_operacional(usuario)
        ):
            raise TarefasKanbanError(
                "Apenas a gestão pode disparar o despacho de lembretes.",
                403
            )

        agora = datetime.now()
        gerados = {"LEMBRETE": 0, "ATRASO": 0}
        avaliadas = 0
        for tarefa in self.repo.listar_tarefas_para_lembrete_global():
            destinatario = str(tarefa.get("CPF_RESPONSAVEL") or "").strip()
            if not destinatario:
                continue
            avaliadas += 1
            tipo = self._avaliar_lembrete(destinatario, tarefa, agora)
            if tipo:
                gerados[tipo] += 1

        return {
            "tarefas_avaliadas": avaliadas,
            "lembretes": gerados["LEMBRETE"],
            "atrasos": gerados["ATRASO"],
            "executado_em": agora.isoformat(),
        }

    def listar_notificacoes(self, cpf):
        self._usuario(cpf)
        self._gerar_lembretes_pendentes(cpf)
        rows = self.repo.listar_notificacoes(cpf)
        return [
            {
                "id": row["ID"],
                "id_todo": row.get("ID_TODO"),
                "tipo": row["TIPO"],
                "titulo": row["TITULO"],
                "mensagem": row["MENSAGEM"],
                "lida": bool(row.get("LIDA")),
                "criada_em": self._iso(row.get("CREATED_AT")),
            }
            for row in rows
        ]

    def marcar_notificacoes_lidas(self, cpf, notificacao_id=None):
        self._usuario(cpf)
        try:
            id_normalizado = (
                int(notificacao_id) if notificacao_id is not None else None
            )
        except (TypeError, ValueError) as erro:
            raise TarefasKanbanError("Notificação inválida.") from erro
        self.repo.marcar_notificacao_lida(cpf, id_normalizado)
        return {"status": "ok"}

    def criar_equipe(self, cpf, data):
        usuario = self._usuario(cpf)
        self._exigir_permissao_de_abertura(usuario)
        nome = str(data.get("nome") or "").strip()
        if not nome:
            raise TarefasKanbanError("Informe o nome da equipe.")
        criada = self.repo.criar_equipe(
            nome,
            cpf,
            str(
                data.get("centro_custo")
                or usuario.get("CENTRO_CUSTO")
                or ""
            ).strip(),
        )
        return {"id": criada["ID"], "nome": nome}

    def pesquisar_operadores(self, cpf, nome=None, centro_custo=None):
        # A busca só serve para montar equipe ou compartilhar quadro, então
        # segue o mesmo critério de quem pode abrir esses espaços.
        usuario = self._usuario(cpf)
        self._exigir_permissao_de_abertura(usuario)
        if not nome and not centro_custo:
            return []
        return [
            {
                "cpf": str(row["CPF"]),
                "nome": row["NOME"],
                "funcao": row.get("FUNCAO") or "",
                "centro_custo": row.get("CENTRO_CUSTO") or "",
            }
            for row in self.repo.pesquisar_operadores(nome, centro_custo)
        ]

    def enviar_convites(self, cpf, equipe_id, cpfs):
        self._usuario(cpf)
        if not self.repo.obter_equipe_supervisor(equipe_id, cpf):
            raise TarefasKanbanError("Equipe não encontrada.", 404)
        cpfs_unicos = list(dict.fromkeys(
            str(item).strip() for item in (cpfs or []) if str(item).strip()
        ))
        if not cpfs_unicos:
            raise TarefasKanbanError("Selecione ao menos um colaborador.")
        if len(cpfs_unicos) > 100:
            raise TarefasKanbanError(
                "Envie no máximo 100 convites por vez."
            )
        # Só validamos que a pessoa existe e está ativa. A regra antiga
        # recusava supervisores, o que impedia equipes multidisciplinares
        # e times de projeto com gestor dentro.
        for convidado_cpf in cpfs_unicos:
            self._usuario(convidado_cpf)
        self.repo.enviar_convites(equipe_id, cpfs_unicos)
        return {"quantidade": len(cpfs_unicos)}

    def responder_convite(self, cpf, equipe_id, aceitar):
        self._usuario(cpf)
        status = "ACEITO" if bool(aceitar) else "RECUSADO"
        self.repo.responder_convite(equipe_id, cpf, status)
        return {"status": status}

    def listar_membros(self, cpf, equipe_id):
        self._usuario(cpf)
        if not self.repo.obter_equipe_supervisor(equipe_id, cpf):
            raise TarefasKanbanError("Equipe não encontrada.", 404)
        return [
            {
                "cpf": str(row["CPF"]),
                "nome": row.get("NOME") or "Colaborador",
                "funcao": row.get("FUNCAO") or "",
                "centro_custo": row.get("CENTRO_CUSTO") or "",
                "status": row["STATUS_CONVITE"],
            }
            for row in self.repo.listar_membros(equipe_id)
        ]

    def remover_membro(self, cpf, equipe_id, membro_cpf):
        self._usuario(cpf)
        if not self.repo.obter_equipe_supervisor(equipe_id, cpf):
            raise TarefasKanbanError("Equipe não encontrada.", 404)
        self.repo.remover_membro(equipe_id, membro_cpf)
        return {"status": "ok"}

    # ------------------------------------------------------------------
    # Membros do quadro
    # ------------------------------------------------------------------

    def _exigir_estrutura_papeis(self):
        if not self._papeis_disponiveis():
            raise TarefasKanbanError(
                "A estrutura de papéis por quadro ainda não foi instalada.",
                503
            )

    def _quadro_administravel(self, cpf, quadro_id):
        quadro = self.repo.obter_quadro(quadro_id)
        if not quadro:
            raise TarefasKanbanError("Quadro não encontrado.", 404)
        if self._papel_no_quadro(cpf, quadro) != "DONO":
            raise TarefasKanbanError(
                "Somente quem administra o quadro pode gerenciar membros.",
                403
            )
        return quadro

    def listar_membros_quadro(self, cpf, quadro_id):
        self._usuario(cpf)
        if not self._papeis_disponiveis():
            return []
        quadro = self.repo.obter_quadro(quadro_id)
        if not quadro:
            raise TarefasKanbanError("Quadro não encontrado.", 404)
        if not self._pode_acessar_quadro(cpf, quadro):
            raise TarefasKanbanError(
                "Você não possui acesso a este quadro.",
                403
            )
        return [
            {
                "cpf": str(row["CPF"]),
                "nome": row.get("NOME") or "Colaborador",
                "funcao": row.get("FUNCAO") or "",
                "centro_custo": row.get("CENTRO_CUSTO") or "",
                "papel": row["PAPEL"],
                "desde": self._iso(row.get("DT_CRIACAO")),
            }
            for row in self.repo.listar_membros_quadro(quadro_id)
        ]

    def definir_membro_quadro(self, cpf, quadro_id, membro_cpf, papel):
        self._usuario(cpf)
        self._exigir_estrutura_papeis()
        self._quadro_administravel(cpf, quadro_id)

        papel_normalizado = str(papel or "EDITOR").strip().upper()
        if papel_normalizado not in self.PAPEIS_QUADRO:
            raise TarefasKanbanError("Papel inválido.")

        alvo = str(membro_cpf or "").strip()
        if not alvo:
            raise TarefasKanbanError("Informe o colaborador.")
        convidado = self._usuario(alvo)

        self.repo.definir_papel_no_quadro(
            quadro_id,
            alvo,
            papel_normalizado,
            cpf
        )
        if alvo != str(cpf):
            self.repo.criar_notificacao(
                alvo,
                "ATRIBUICAO",
                "Acesso a um quadro",
                (
                    f'Você foi incluído em um quadro de tarefas como '
                    f'{papel_normalizado.lower()}.'
                ),
                None,
                f"QUADRO:{quadro_id}:{alvo}:{papel_normalizado}",
            )
        return {
            "cpf": alvo,
            "nome": convidado["NOME"],
            "papel": papel_normalizado,
        }

    def remover_membro_quadro(self, cpf, quadro_id, membro_cpf):
        self._usuario(cpf)
        self._exigir_estrutura_papeis()
        quadro = self._quadro_administravel(cpf, quadro_id)

        if str(membro_cpf) == str(quadro.get("CPF_CRIADOR") or ""):
            raise TarefasKanbanError(
                "O criador do quadro não pode ser removido.",
                409
            )
        self.repo.remover_membro_quadro(quadro_id, membro_cpf)
        return {"status": "ok"}
