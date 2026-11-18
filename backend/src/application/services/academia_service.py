import json
import secrets
from datetime import date, datetime

from src.infrastructure.repositories.sql_academia_repository import (
    AcademiaRepository,
)


ALFABETO_CERTIFICADO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
DIAS_ALERTA_PRAZO = 3


class AcademiaServiceError(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


def _para_data(valor):
    """Normaliza o que o driver devolve (date, datetime ou texto) em date."""
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    try:
        return datetime.fromisoformat(str(valor)[:10]).date()
    except ValueError:
        return None


def _iso(valor):
    if valor is None:
        return None
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    return str(valor)


class AcademiaService:
    def __init__(self):
        self.repo = AcademiaRepository()

    # ------------------------------------------------------------------
    # Prazo e obrigatoriedade
    # ------------------------------------------------------------------

    @staticmethod
    def _situacao_prazo(data_limite, concluido):
        if concluido:
            return "CONCLUIDO"
        limite = _para_data(data_limite)
        if limite is None:
            return None
        hoje = date.today()
        if limite < hoje:
            return "VENCIDO"
        if (limite - hoje).days <= DIAS_ALERTA_PRAZO:
            return "VENCE_EM_BREVE"
        return "EM_DIA"

    def _prazos_do_usuario(self, cpf):
        if not self.repo.estrutura_atribuicao_disponivel():
            return {}
        return {
            row["curso_id"]: row
            for row in self.repo.listar_prazos_do_usuario(str(cpf))
        }

    def _aplicar_prazo(self, curso, prazo):
        concluido = curso.get("status_matricula") == "CONCLUIDO"
        data_limite = (prazo or {}).get("data_limite")
        curso["obrigatoria"] = bool((prazo or {}).get("obrigatoria"))
        curso["data_limite"] = _iso(_para_data(data_limite))
        curso["situacao_prazo"] = self._situacao_prazo(data_limite, concluido)
        return curso

    # ------------------------------------------------------------------
    # Quiz
    # ------------------------------------------------------------------

    @staticmethod
    def _carregar_quiz(conteudo_texto):
        """Le o gabarito armazenado. Retorna None se nao for um quiz valido."""
        if not conteudo_texto:
            return None
        try:
            quiz = json.loads(conteudo_texto)
        except (TypeError, ValueError):
            return None
        if not isinstance(quiz, dict):
            return None
        perguntas = quiz.get("perguntas")
        if not isinstance(perguntas, list) or not perguntas:
            return None
        return quiz

    @classmethod
    def _quiz_para_aluno(cls, conteudo_texto):
        """Remove o gabarito antes de o quiz chegar ao navegador."""
        quiz = cls._carregar_quiz(conteudo_texto)
        if not quiz:
            return None
        return {
            "nota_minima": quiz.get("nota_minima") or 0,
            "perguntas": [
                {
                    "id": str(pergunta.get("id") or ""),
                    "enunciado": pergunta.get("enunciado") or "",
                    "alternativas": [
                        {
                            "id": str(alternativa.get("id") or ""),
                            "texto": alternativa.get("texto") or "",
                        }
                        for alternativa in pergunta.get("alternativas") or []
                    ],
                }
                for pergunta in quiz.get("perguntas") or []
            ],
        }

    def _usuario(self, cpf):
        usuario = self.repo.obter_usuario(str(cpf))
        if not usuario:
            raise AcademiaServiceError(
                "Usuário não encontrado ou inativo.",
                403
            )
        if not usuario.get("centro_custo"):
            raise AcademiaServiceError(
                "Usuário sem Centro de Custo configurado.",
                403
            )
        return usuario

    @staticmethod
    def _curso_resumo(row):
        return {
            "id": row["id"],
            "titulo": row["titulo"],
            "descricao": row.get("descricao"),
            "capa_url": row.get("capa_url"),
            "nivel": row.get("nivel"),
            "carga_horaria_min": row.get("carga_horaria_min") or 0,
            "total_modulos": row.get("total_modulos") or 0,
            "total_aulas": row.get("total_aulas") or 0,
            "matriculado": bool(row.get("matriculado")),
            "status_matricula": row.get("status_matricula"),
            "progresso": float(row.get("progresso") or 0),
        }

    def listar_catalogo(self, cpf):
        usuario = self._usuario(cpf)
        rows = self.repo.listar_catalogo(
            str(cpf),
            usuario["centro_custo"]
        )
        prazos = self._prazos_do_usuario(cpf)
        cursos = [
            self._aplicar_prazo(
                self._curso_resumo(row),
                prazos.get(row["id"])
            )
            for row in rows
        ]
        # Obrigatorio vencido primeiro, depois o que vence antes.
        ordem_situacao = {
            "VENCIDO": 0,
            "VENCE_EM_BREVE": 1,
            "EM_DIA": 2,
        }
        cursos.sort(
            key=lambda curso: (
                ordem_situacao.get(curso["situacao_prazo"], 3),
                curso["data_limite"] or "9999-12-31",
            )
        )
        return {
            "usuario": {
                "nome": usuario["nome"],
                "centro_custo": usuario["centro_custo"],
            },
            "cursos": cursos,
        }

    def listar_meus_cursos(self, cpf):
        catalogo = self.listar_catalogo(cpf)
        catalogo["cursos"] = [
            curso
            for curso in catalogo["cursos"]
            if curso["matriculado"]
        ]
        return catalogo

    def matricular(self, cpf, id_curso):
        usuario = self._usuario(cpf)
        if not self.repo.curso_disponivel(
            id_curso,
            usuario["centro_custo"]
        ):
            raise AcademiaServiceError(
                "Curso não encontrado para o seu Centro de Custo.",
                404
            )
        self.repo.matricular(id_curso, str(cpf))
        return self.obter_curso(cpf, id_curso)

    def obter_curso(self, cpf, id_curso):
        usuario = self._usuario(cpf)
        rows = self.repo.obter_curso(
            id_curso,
            str(cpf),
            usuario["centro_custo"]
        )
        if not rows:
            raise AcademiaServiceError(
                "Curso não encontrado para o seu Centro de Custo.",
                404
            )

        primeira = rows[0]
        curso = {
            "id": primeira["curso_id"],
            "titulo": primeira["curso_titulo"],
            "descricao": primeira.get("curso_descricao"),
            "capa_url": primeira.get("capa_url"),
            "nivel": primeira.get("nivel"),
            "carga_horaria_min": primeira.get("carga_horaria_min") or 0,
            "matriculado": primeira.get("matricula_id") is not None,
            "status_matricula": primeira.get("status_matricula"),
            "progresso": 0.0,
            "modulos": [],
        }

        modulos = {}
        total_aulas = 0
        aulas_concluidas = 0
        sequencia_liberada = curso["matriculado"]

        matricula_id = primeira.get("matricula_id")
        tentativas = {}
        if matricula_id and self.repo.estrutura_quiz_disponivel():
            tentativas = {
                tentativa["aula_id"]: tentativa
                for tentativa in self.repo.listar_melhores_tentativas(
                    matricula_id
                )
            }

        for row in rows:
            modulo_id = row.get("modulo_id")
            if modulo_id is None:
                continue

            if modulo_id not in modulos:
                modulo = {
                    "id": modulo_id,
                    "titulo": row["modulo_titulo"],
                    "descricao": row.get("modulo_descricao"),
                    "ordem": row.get("modulo_ordem") or 0,
                    "aulas": [],
                }
                modulos[modulo_id] = modulo
                curso["modulos"].append(modulo)

            aula_id = row.get("aula_id")
            if aula_id is None:
                continue
            if row.get("aula_tipo") in {"SIMULACAO", "TREINAMENTO"}:
                continue

            concluida = bool(row.get("concluida"))
            bloqueada = not concluida and not sequencia_liberada
            eh_quiz = row.get("aula_tipo") == "QUIZ"
            total_aulas += 1
            aulas_concluidas += 1 if concluida else 0

            tentativa = tentativas.get(aula_id) if eh_quiz else None
            modulos[modulo_id]["aulas"].append({
                "id": aula_id,
                "titulo": row["aula_titulo"],
                "descricao": row.get("aula_descricao"),
                "tipo": row["aula_tipo"],
                "conteudo_url": (
                    None if bloqueada else row.get("conteudo_url")
                ),
                # O gabarito do quiz nunca sai do servidor: para aulas
                # avaliativas o conteudo bruto e substituido pela versao
                # sem a marcacao de alternativa correta.
                "conteudo_texto": (
                    None if bloqueada or eh_quiz
                    else row.get("conteudo_texto")
                ),
                "quiz": (
                    self._quiz_para_aluno(row.get("conteudo_texto"))
                    if eh_quiz and not bloqueada else None
                ),
                "quiz_resultado": (
                    {
                        "melhor_nota": float(
                            tentativa.get("melhor_nota") or 0
                        ),
                        "tentativas": tentativa.get("tentativas") or 0,
                        "aprovada": bool(tentativa.get("aprovada")),
                        "realizada_em": _iso(
                            tentativa.get("ultima_tentativa")
                        ),
                    }
                    if tentativa else None
                ),
                "comando": None if bloqueada else row.get("comando"),
                "duracao_min": row.get("duracao_min") or 0,
                "ordem": row.get("aula_ordem") or 0,
                "obrigatoria": bool(row.get("obrigatoria")),
                "percentual": row.get("percentual") or 0,
                "concluida": concluida,
                "favorita": bool(row.get("favorita")),
                "bloqueada": bloqueada,
                "mensagem_bloqueio": (
                    "Conclua a aula anterior para liberar este conteúdo."
                    if bloqueada else None
                ),
            })
            if not concluida:
                sequencia_liberada = False

        if total_aulas:
            curso["progresso"] = round(
                aulas_concluidas * 100 / total_aulas,
                2
            )
        curso["total_aulas"] = total_aulas
        curso["aulas_concluidas"] = aulas_concluidas

        self._aplicar_prazo(curso, self._prazos_do_usuario(cpf).get(id_curso))

        # Emitir aqui e idempotente e cobre tambem quem concluiu antes de o
        # certificado existir.
        curso["certificado"] = (
            self._garantir_certificado(matricula_id)
            if matricula_id and curso.get("status_matricula") == "CONCLUIDO"
            else None
        )
        return curso

    def salvar_progresso(
        self,
        cpf,
        id_aula,
        percentual,
        concluida
    ):
        usuario = self._usuario(cpf)
        vinculo = self.repo.aula_da_matricula(
            id_aula,
            str(cpf),
            usuario["centro_custo"]
        )
        if not vinculo:
            raise AcademiaServiceError(
                "Matricule-se no curso antes de iniciar esta aula.",
                409
            )

        if not self.repo.aula_liberada(
            vinculo["matricula_id"],
            id_aula
        ):
            raise AcademiaServiceError(
                "Conclua as aulas anteriores antes de iniciar esta etapa.",
                409
            )

        try:
            percentual_int = int(percentual)
        except (TypeError, ValueError):
            raise AcademiaServiceError(
                "Percentual de progresso inválido.",
                400
            )

        if percentual_int < 0 or percentual_int > 100:
            raise AcademiaServiceError(
                "O percentual deve estar entre 0 e 100.",
                400
            )

        concluida_bool = bool(concluida) or percentual_int == 100
        if concluida_bool:
            percentual_int = 100

        # Aula avaliativa so conclui pela correcao do servidor. Sem isso o
        # cliente poderia marcar o quiz como concluido sem responder nada.
        # A consulta so acontece na conclusao: progresso parcial de video
        # chega com alta frequencia e nao precisa dela.
        if concluida_bool:
            aula = self.repo.obter_aula_avaliativa(id_aula)
            if (aula or {}).get("tipo") == "QUIZ":
                raise AcademiaServiceError(
                    "Envie suas respostas para concluir a avaliação.",
                    409
                )

        self.repo.salvar_progresso(
            vinculo["matricula_id"],
            id_aula,
            percentual_int,
            concluida_bool
        )
        return self.obter_curso(cpf, vinculo["curso_id"])

    def responder_quiz(self, cpf, id_aula, respostas):
        """Corrige a avaliacao no servidor e registra a tentativa."""
        usuario = self._usuario(cpf)
        vinculo = self.repo.aula_da_matricula(
            id_aula,
            str(cpf),
            usuario["centro_custo"]
        )
        if not vinculo:
            raise AcademiaServiceError(
                "Matricule-se no curso antes de responder a avaliação.",
                409
            )
        if not self.repo.aula_liberada(
            vinculo["matricula_id"],
            id_aula
        ):
            raise AcademiaServiceError(
                "Conclua as aulas anteriores antes de responder esta etapa.",
                409
            )

        aula = self.repo.obter_aula_avaliativa(id_aula)
        if not aula or aula.get("tipo") != "QUIZ":
            raise AcademiaServiceError(
                "Esta aula não é uma avaliação.",
                400
            )

        gabarito = self._carregar_quiz(aula.get("conteudo_texto"))
        if not gabarito:
            raise AcademiaServiceError(
                "Esta avaliação ainda não foi configurada pela Qualidade.",
                409
            )

        if not isinstance(respostas, dict):
            raise AcademiaServiceError("Respostas inválidas.", 400)

        perguntas = gabarito.get("perguntas") or []
        correcao = []
        acertos = 0
        for pergunta in perguntas:
            pergunta_id = str(pergunta.get("id") or "")
            alternativa_correta = next(
                (
                    str(alternativa.get("id"))
                    for alternativa in pergunta.get("alternativas") or []
                    if alternativa.get("correta")
                ),
                None
            )
            escolhida = respostas.get(pergunta_id)
            escolhida = str(escolhida) if escolhida is not None else None
            acertou = (
                escolhida is not None
                and escolhida == alternativa_correta
            )
            acertos += 1 if acertou else 0
            correcao.append({
                "pergunta_id": pergunta_id,
                "enunciado": pergunta.get("enunciado") or "",
                "resposta_enviada": escolhida,
                "resposta_correta": alternativa_correta,
                "acertou": acertou,
                "explicacao": pergunta.get("explicacao") or "",
            })

        total = len(perguntas)
        nota = round(acertos * 100 / total, 2) if total else 0.0
        nota_minima = int(gabarito.get("nota_minima") or 0)
        aprovada = nota >= nota_minima

        registrado = self.repo.estrutura_quiz_disponivel()
        tentativas = 0
        if registrado:
            self.repo.registrar_tentativa_quiz(
                vinculo["matricula_id"],
                id_aula,
                {
                    "nota": nota,
                    "acertos": acertos,
                    "total_perguntas": total,
                    "nota_minima": nota_minima,
                    "aprovada": aprovada,
                    "respostas": json.dumps(
                        {
                            item["pergunta_id"]: item["resposta_enviada"]
                            for item in correcao
                        },
                        ensure_ascii=False
                    ),
                }
            )
            tentativas = self.repo.contar_tentativas_quiz(
                vinculo["matricula_id"],
                id_aula
            )

        if aprovada:
            self.repo.salvar_progresso(
                vinculo["matricula_id"],
                id_aula,
                100,
                True
            )

        return {
            "nota": nota,
            "acertos": acertos,
            "total_perguntas": total,
            "nota_minima": nota_minima,
            "aprovada": aprovada,
            "tentativas": tentativas,
            "registrado": registrado,
            "correcao": correcao,
            "curso": self.obter_curso(cpf, vinculo["curso_id"]),
        }

    # ------------------------------------------------------------------
    # Certificados
    # ------------------------------------------------------------------

    @staticmethod
    def _gerar_codigo_certificado():
        bloco = "".join(
            secrets.choice(ALFABETO_CERTIFICADO) for _ in range(4)
        )
        outro = "".join(
            secrets.choice(ALFABETO_CERTIFICADO) for _ in range(4)
        )
        return f"ACAD-{bloco}-{outro}"

    @staticmethod
    def _certificado_publico(row):
        if not row:
            return None
        return {
            "codigo": row["codigo"],
            "nome": row.get("nome"),
            "centro_custo": row.get("centro_custo"),
            "curso_titulo": row.get("curso_titulo"),
            "curso_id": row.get("curso_id"),
            "carga_horaria_min": row.get("carga_horaria_min") or 0,
            "total_aulas": row.get("total_aulas") or 0,
            "nota_final": (
                float(row["nota_final"])
                if row.get("nota_final") is not None else None
            ),
            "emitido_em": _iso(row.get("emitido_em")),
        }

    def _garantir_certificado(self, id_matricula):
        """Emite o certificado se ainda nao existir. Idempotente."""
        if not self.repo.estrutura_certificado_disponivel():
            return None

        existente = self.repo.obter_certificado_por_matricula(id_matricula)
        if existente:
            return self._certificado_publico(existente)

        dados = self.repo.obter_dados_certificado(id_matricula)
        if not dados:
            return None

        nota_final = (
            self.repo.obter_nota_media_matricula(id_matricula)
            if self.repo.estrutura_quiz_disponivel() else None
        )
        self.repo.emitir_certificado(
            id_matricula,
            self._gerar_codigo_certificado(),
            {
                "cpf": dados["cpf"],
                "nome": dados.get("nome") or "Colaborador",
                "centro_custo": dados.get("centro_custo"),
                "curso_titulo": dados.get("curso_titulo") or "Curso",
                "carga_horaria_min": dados.get("carga_horaria_min") or 0,
                "total_aulas": dados.get("total_aulas") or 0,
                "nota_final": nota_final,
            }
        )
        return self._certificado_publico(
            self.repo.obter_certificado_por_matricula(id_matricula)
        )

    def listar_certificados(self, cpf):
        self._usuario(cpf)
        if not self.repo.estrutura_certificado_disponivel():
            return []
        return [
            self._certificado_publico(row)
            for row in self.repo.listar_certificados(str(cpf))
        ]

    def emitir_certificado(self, cpf, id_curso):
        self._usuario(cpf)
        if not self.repo.estrutura_certificado_disponivel():
            raise AcademiaServiceError(
                "A estrutura de certificados da Academia ainda não foi "
                "instalada.",
                503
            )
        matricula = self.repo.obter_matricula_concluida(str(cpf), id_curso)
        if not matricula:
            raise AcademiaServiceError(
                "Conclua o curso para emitir o certificado.",
                409
            )
        certificado = self._garantir_certificado(matricula["matricula_id"])
        if not certificado:
            raise AcademiaServiceError(
                "Não foi possível emitir o certificado.",
                500
            )
        return certificado

    def obter_anotacao(self, cpf, id_aula):
        usuario = self._usuario(cpf)
        vinculo = self.repo.aula_da_matricula(
            id_aula,
            str(cpf),
            usuario["centro_custo"]
        )
        if not vinculo:
            raise AcademiaServiceError(
                "Matricule-se no curso antes de acessar suas anotações.",
                409
            )
        if not self.repo.aula_liberada(
            vinculo["matricula_id"],
            id_aula
        ):
            raise AcademiaServiceError(
                "Conclua as aulas anteriores para acessar esta anotação.",
                409
            )
        if not self.repo.estrutura_anotacoes_disponivel():
            raise AcademiaServiceError(
                "A estrutura de anotações da Academia ainda não foi instalada.",
                503
            )
        anotacao = self.repo.obter_anotacao(
            vinculo["matricula_id"],
            id_aula
        )
        return {
            "conteudo": (anotacao or {}).get("conteudo") or "",
            "atualizado_em": (anotacao or {}).get("atualizado_em"),
        }

    def salvar_anotacao(self, cpf, id_aula, conteudo):
        usuario = self._usuario(cpf)
        vinculo = self.repo.aula_da_matricula(
            id_aula,
            str(cpf),
            usuario["centro_custo"]
        )
        if not vinculo:
            raise AcademiaServiceError(
                "Matricule-se no curso antes de salvar uma anotação.",
                409
            )
        if not self.repo.aula_liberada(
            vinculo["matricula_id"],
            id_aula
        ):
            raise AcademiaServiceError(
                "Conclua as aulas anteriores para acessar esta anotação.",
                409
            )
        if not self.repo.estrutura_anotacoes_disponivel():
            raise AcademiaServiceError(
                "A estrutura de anotações da Academia ainda não foi instalada.",
                503
            )

        texto = str(conteudo or "").strip()
        if len(texto) > 10000:
            raise AcademiaServiceError(
                "A anotação deve ter no máximo 10.000 caracteres.",
                400
            )
        self.repo.salvar_anotacao(
            vinculo["matricula_id"],
            id_aula,
            texto
        )
        return self.obter_anotacao(cpf, id_aula)

    def atualizar_favorito(self, cpf, id_aula, favorita):
        usuario = self._usuario(cpf)
        vinculo = self.repo.aula_da_matricula(
            id_aula,
            str(cpf),
            usuario["centro_custo"]
        )
        if not vinculo:
            raise AcademiaServiceError(
                "Matricule-se no curso antes de salvar esta aula.",
                409
            )
        self.repo.atualizar_favorito(
            vinculo["matricula_id"],
            id_aula,
            bool(favorita)
        )
        return {"favorita": bool(favorita)}

    def listar_materiais_salvos(self, cpf):
        usuario = self._usuario(cpf)
        rows = self.repo.listar_materiais_salvos(
            str(cpf),
            usuario["centro_custo"]
        )
        return [
            {
                "id": row["id"],
                "titulo": row["titulo"],
                "descricao": row.get("descricao"),
                "tipo": row["tipo"],
                "conteudo_url": row.get("conteudo_url"),
                "duracao_min": row.get("duracao_min") or 0,
                "curso_id": row["curso_id"],
                "curso_titulo": row["curso_titulo"],
                "modulo_titulo": row["modulo_titulo"],
            }
            for row in rows
        ]


class AcademiaAdminService:
    NIVEIS = {"INICIANTE", "INTERMEDIARIO", "AVANCADO"}
    TIPOS_AULA = {
        "VIDEO",
        "PDF",
        "TEXTO",
        "QUIZ",
        "LINK",
    }
    TIPOS_PUBLICO = {"TODOS", "CENTRO_CUSTO", "COLABORADOR"}

    def __init__(self):
        self.repo = AcademiaRepository()

    @staticmethod
    def _normalizar(valor):
        return " ".join(str(valor or "").strip().upper().split())

    def autorizar_qualidade(self, cpf):
        usuario = self.repo.obter_usuario(str(cpf))
        if not usuario:
            raise AcademiaServiceError(
                "Usuário não encontrado ou inativo.",
                403
            )
        if self._normalizar(usuario.get("centro_custo")) != "QUALIDADE":
            raise AcademiaServiceError(
                "A gestão da Academia é exclusiva da Qualidade.",
                403
            )
        return usuario

    @staticmethod
    def _inteiro(valor, campo, minimo=0):
        try:
            numero = int(valor or 0)
        except (TypeError, ValueError):
            raise AcademiaServiceError(f"{campo} inválido.", 400)
        if numero < minimo:
            raise AcademiaServiceError(
                f"{campo} deve ser maior ou igual a {minimo}.",
                400
            )
        return numero

    def _validar_quiz(self, valor):
        try:
            quiz = json.loads(valor) if isinstance(valor, str) else valor
        except (TypeError, ValueError, json.JSONDecodeError):
            raise AcademiaServiceError("Configuração do Quiz inválida.", 400)
        if not isinstance(quiz, dict):
            raise AcademiaServiceError("Configure as perguntas do Quiz.", 400)
        perguntas = quiz.get("perguntas") or []
        if not isinstance(perguntas, list) or not 1 <= len(perguntas) <= 50:
            raise AcademiaServiceError(
                "O Quiz deve possuir entre 1 e 50 perguntas.", 400
            )
        perguntas_validas = []
        for indice, pergunta in enumerate(perguntas, start=1):
            enunciado = str(pergunta.get("enunciado") or "").strip()
            alternativas = pergunta.get("alternativas") or []
            if not enunciado:
                raise AcademiaServiceError(
                    f"Informe o enunciado da pergunta {indice}.", 400
                )
            if not isinstance(alternativas, list) or not 2 <= len(alternativas) <= 6:
                raise AcademiaServiceError(
                    f"A pergunta {indice} deve possuir entre 2 e 6 alternativas.",
                    400,
                )
            alternativas_validas = []
            corretas = 0
            for alternativa_indice, alternativa in enumerate(alternativas, start=1):
                texto = str(alternativa.get("texto") or "").strip()
                if not texto:
                    raise AcademiaServiceError(
                        f"Preencha a alternativa {alternativa_indice} da pergunta {indice}.",
                        400,
                    )
                correta = bool(alternativa.get("correta"))
                corretas += 1 if correta else 0
                alternativas_validas.append({
                    "id": str(alternativa.get("id") or f"p{indice}-a{alternativa_indice}"),
                    "texto": texto,
                    "correta": correta,
                })
            if corretas != 1:
                raise AcademiaServiceError(
                    f"A pergunta {indice} deve possuir exatamente uma resposta correta.",
                    400,
                )
            perguntas_validas.append({
                "id": str(pergunta.get("id") or f"pergunta-{indice}"),
                "enunciado": enunciado,
                "explicacao": str(pergunta.get("explicacao") or "").strip(),
                "alternativas": alternativas_validas,
            })
        nota_minima = self._inteiro(
            quiz.get("nota_minima", 70), "Nota mínima", 0
        )
        if nota_minima > 100:
            raise AcademiaServiceError("A nota mínima não pode ultrapassar 100%.", 400)
        return json.dumps({
            "nota_minima": nota_minima,
            "perguntas": perguntas_validas,
        }, ensure_ascii=False)

    def listar_centros_custo(self, cpf):
        self.autorizar_qualidade(cpf)
        return [
            row["centro_custo"]
            for row in self.repo.listar_centros_custo_admin()
        ]

    def listar_cursos(self, cpf):
        self.autorizar_qualidade(cpf)
        agrupados = {}
        for row in self.repo.listar_cursos_admin():
            curso = agrupados.setdefault(
                row["id"],
                {
                    "id": row["id"],
                    "titulo": row["titulo"],
                    "descricao": row.get("descricao"),
                    "capa_url": row.get("capa_url"),
                    "nivel": row["nivel"],
                    "carga_horaria_min": row["carga_horaria_min"] or 0,
                    "status": row["status"],
                    "todos_centros_custo": bool(
                        row["todos_centros_custo"]
                    ),
                    "ordem": row["ordem"] or 0,
                    "atualizado_em": row.get("atualizado_em"),
                    "total_modulos": row["total_modulos"] or 0,
                    "total_aulas": row["total_aulas"] or 0,
                    "centros_custo": [],
                }
            )
            if row.get("centro_custo"):
                curso["centros_custo"].append(row["centro_custo"])
        return list(agrupados.values())

    def _prazos_dashboard(self):
        if not self.repo.estrutura_atribuicao_disponivel():
            return []
        return [
            {
                "curso_id": row["curso_id"],
                "curso_titulo": row["curso_titulo"],
                "atribuidas": row.get("atribuidas") or 0,
                "concluidas": row.get("concluidas") or 0,
                "vencidas": row.get("vencidas") or 0,
                "vencendo": row.get("vencendo") or 0,
                "aderencia": float(row.get("aderencia") or 0),
            }
            for row in self.repo.obter_prazos_admin()
        ]

    def obter_dashboard(self, cpf):
        self.autorizar_qualidade(cpf)
        dados = self.repo.obter_dashboard_admin()
        resumo = dados["resumo"]
        return {
            "prazos": self._prazos_dashboard(),
            "resumo": {
                "cursos_publicados": resumo.get("cursos_publicados") or 0,
                "rascunhos": resumo.get("rascunhos") or 0,
                "em_revisao": resumo.get("em_revisao") or 0,
                "alunos_ativos": resumo.get("alunos_ativos") or 0,
                "total_matriculas": resumo.get("total_matriculas") or 0,
                "total_iniciaram": resumo.get("total_iniciaram") or 0,
                "total_concluidos": resumo.get("total_concluidos") or 0,
                "total_metade": resumo.get("total_metade") or 0,
                "alunos_em_risco": resumo.get("alunos_em_risco") or 0,
                "alunos_interrompidos": (
                    resumo.get("alunos_interrompidos") or 0
                ),
                "conclusao_media": float(
                    resumo.get("conclusao_media") or 0
                ),
            },
            "desempenho": [
                {
                    "curso_id": row["curso_id"],
                    "titulo": row["titulo"],
                    "matriculas": row["matriculas"] or 0,
                    "concluidos": row["concluidos"] or 0,
                    "taxa_conclusao": float(
                        row["taxa_conclusao"] or 0
                    ),
                    "progresso_medio": float(
                        row["progresso_medio"] or 0
                    ),
                }
                for row in dados["desempenho"]
            ],
            "abandonos": [
                {
                    "aula_id": row["aula_id"],
                    "aula_titulo": row["aula_titulo"],
                    "curso_id": row["curso_id"],
                    "curso_titulo": row["curso_titulo"],
                    "abandonos": row["abandonos"] or 0,
                    "taxa_abandono": float(
                        row["taxa_abandono"] or 0
                    ),
                }
                for row in dados["abandonos"]
            ],
            "alunos": [
                {
                    "matricula_id": row["matricula_id"],
                    "cpf": row["cpf"],
                    "nome": row["nome"],
                    "centro_custo": row.get("centro_custo") or "Não informado",
                    "curso_id": row["curso_id"],
                    "curso_titulo": row["curso_titulo"],
                    "status_matricula": row["status_matricula"],
                    "aulas_iniciadas": row.get("aulas_iniciadas") or 0,
                    "aulas_concluidas": row.get("aulas_concluidas") or 0,
                    "total_aulas": row.get("total_aulas") or 0,
                    "progresso": float(row.get("progresso") or 0),
                    "ultima_atividade": (
                        row["ultima_atividade"].isoformat()
                        if row.get("ultima_atividade") else None
                    ),
                    "situacao": row["situacao"],
                }
                for row in dados["alunos"]
            ],
        }

    def _validar_curso(self, data):
        titulo = str(data.get("titulo") or "").strip()
        if not titulo:
            raise AcademiaServiceError(
                "Informe o título do curso.",
                400
            )

        nivel = self._normalizar(data.get("nivel") or "INICIANTE")
        if nivel not in self.NIVEIS:
            raise AcademiaServiceError("Nível do curso inválido.", 400)

        todos = bool(data.get("todos_centros_custo"))
        centros = sorted({
            " ".join(str(item or "").strip().upper().split())
            for item in data.get("centros_custo", [])
            if str(item or "").strip()
        })
        if not todos and not centros:
            raise AcademiaServiceError(
                "Selecione ao menos um Centro de Custo.",
                400
            )

        return {
            "dados": {
                "titulo": titulo,
                "descricao": (
                    str(data.get("descricao") or "").strip() or None
                ),
                "capa_url": (
                    str(data.get("capa_url") or "").strip() or None
                ),
                "nivel": nivel,
                "carga_horaria_min": self._inteiro(
                    data.get("carga_horaria_min"),
                    "Carga horária"
                ),
                "todos_centros_custo": 1 if todos else 0,
                "ordem": self._inteiro(data.get("ordem"), "Ordem"),
            },
            "centros_custo": [] if todos else centros,
        }

    def salvar_curso(self, cpf, data, id_curso=None):
        self.autorizar_qualidade(cpf)
        validado = self._validar_curso(data)
        curso_id = self.repo.salvar_curso_admin(
            id_curso,
            validado["dados"],
            validado["centros_custo"],
            str(cpf)
        )
        return self.obter_curso(cpf, curso_id)

    def _montar_estrutura(self, rows):
        primeira = rows[0]
        curso = {
            "id": primeira["curso_id"],
            "titulo": primeira["curso_titulo"],
            "descricao": primeira.get("curso_descricao"),
            "capa_url": primeira.get("capa_url"),
            "nivel": primeira["nivel"],
            "carga_horaria_min": primeira["carga_horaria_min"] or 0,
            "status": primeira["status"],
            "todos_centros_custo": bool(
                primeira["todos_centros_custo"]
            ),
            "ordem": primeira["curso_ordem"] or 0,
            "centros_custo": primeira.get("centros_custo", []),
            "modulos": [],
        }
        modulos = {}
        for row in rows:
            modulo_id = row.get("modulo_id")
            if modulo_id is None:
                continue
            if modulo_id not in modulos:
                modulo = {
                    "id": modulo_id,
                    "titulo": row["modulo_titulo"],
                    "descricao": row.get("modulo_descricao"),
                    "ordem": row["modulo_ordem"] or 0,
                    "aulas": [],
                }
                modulos[modulo_id] = modulo
                curso["modulos"].append(modulo)
            if row.get("aula_id") is not None:
                if row.get("aula_tipo") in {"SIMULACAO", "TREINAMENTO"}:
                    continue
                modulos[modulo_id]["aulas"].append({
                    "id": row["aula_id"],
                    "titulo": row["aula_titulo"],
                    "descricao": row.get("aula_descricao"),
                    "tipo": row["aula_tipo"],
                    "conteudo_url": row.get("conteudo_url"),
                    "conteudo_texto": row.get("conteudo_texto"),
                    "comando": row.get("comando"),
                    "duracao_min": row["duracao_min"] or 0,
                    "ordem": row["aula_ordem"] or 0,
                    "obrigatoria": bool(row["obrigatoria"]),
                })
        return curso

    def obter_curso(self, cpf, id_curso):
        self.autorizar_qualidade(cpf)
        rows = self.repo.obter_estrutura_admin(id_curso)
        if not rows:
            raise AcademiaServiceError("Curso não encontrado.", 404)
        return self._montar_estrutura(rows)

    def salvar_modulo(self, cpf, id_curso, data, id_modulo=None):
        self.autorizar_qualidade(cpf)
        estrutura = self.repo.obter_estrutura_admin(id_curso)
        if not estrutura:
            raise AcademiaServiceError("Curso não encontrado.", 404)
        titulo = str(data.get("titulo") or "").strip()
        if not titulo:
            raise AcademiaServiceError(
                "Informe o título do módulo.",
                400
            )
        dados = {
            "titulo": titulo,
            "descricao": (
                str(data.get("descricao") or "").strip() or None
            ),
            "ordem": self._inteiro(data.get("ordem"), "Ordem"),
        }
        resultado = self.repo.salvar_modulo_admin(
            id_curso,
            id_modulo,
            dados
        )
        if id_modulo and not resultado:
            raise AcademiaServiceError("Módulo não encontrado.", 404)
        return self.obter_curso(cpf, id_curso)

    def desativar_modulo(self, cpf, id_curso, id_modulo):
        self.autorizar_qualidade(cpf)
        if not self.repo.desativar_modulo_admin(id_curso, id_modulo):
            raise AcademiaServiceError("Módulo não encontrado.", 404)
        return self.obter_curso(cpf, id_curso)

    def _validar_aula(self, data):
        titulo = str(data.get("titulo") or "").strip()
        if not titulo:
            raise AcademiaServiceError(
                "Informe o título da aula.",
                400
            )
        tipo = self._normalizar(data.get("tipo"))
        if tipo not in self.TIPOS_AULA:
            raise AcademiaServiceError("Tipo de aula inválido.", 400)

        conteudo_url = (
            str(data.get("conteudo_url") or "").strip() or None
        )
        conteudo_texto = (
            str(data.get("conteudo_texto") or "").strip() or None
        )
        comando = None

        if tipo in {"VIDEO", "PDF", "LINK"} and not conteudo_url:
            raise AcademiaServiceError(
                "Informe o endereço do conteúdo.",
                400
            )
        if tipo == "TEXTO" and not conteudo_texto:
            raise AcademiaServiceError(
                "Informe o conteúdo da aula.",
                400
            )
        if tipo == "QUIZ":
            conteudo_texto = self._validar_quiz(
                data.get("quiz") or conteudo_texto
            )
            conteudo_url = None

        return {
            "titulo": titulo,
            "descricao": (
                str(data.get("descricao") or "").strip() or None
            ),
            "tipo": tipo,
            "conteudo_url": conteudo_url,
            "conteudo_texto": conteudo_texto,
            "comando": comando,
            "duracao_min": self._inteiro(
                data.get("duracao_min"),
                "Duração"
            ),
            "ordem": self._inteiro(data.get("ordem"), "Ordem"),
            "obrigatoria": 1 if data.get("obrigatoria", True) else 0,
        }

    def salvar_aula(
        self,
        cpf,
        id_curso,
        id_modulo,
        data,
        id_aula=None
    ):
        self.autorizar_qualidade(cpf)
        curso = self.obter_curso(cpf, id_curso)
        if not any(
            modulo["id"] == id_modulo
            for modulo in curso["modulos"]
        ):
            raise AcademiaServiceError("Módulo não encontrado.", 404)
        dados = self._validar_aula(data)
        resultado = self.repo.salvar_aula_admin(
            id_modulo,
            id_aula,
            dados
        )
        if id_aula and not resultado:
            raise AcademiaServiceError("Aula não encontrada.", 404)
        return self.obter_curso(cpf, id_curso)

    def desativar_aula(
        self,
        cpf,
        id_curso,
        id_modulo,
        id_aula
    ):
        self.autorizar_qualidade(cpf)
        if not self.repo.desativar_aula_admin(id_modulo, id_aula):
            raise AcademiaServiceError("Aula não encontrada.", 404)
        return self.obter_curso(cpf, id_curso)

    def _validar_curso_pronto(self, id_curso):
        validacao = self.repo.validar_publicacao_admin(id_curso)
        if not validacao:
            raise AcademiaServiceError("Curso não encontrado.", 404)
        if (
            not validacao["todos_centros_custo"]
            and not validacao["total_centros_custo"]
        ):
            raise AcademiaServiceError(
                "Defina o público do curso antes de publicar.",
                409
            )
        if not validacao["total_modulos"] or not validacao["total_aulas"]:
            raise AcademiaServiceError(
                "Inclua ao menos um módulo e uma aula antes de publicar.",
                409
            )
        return validacao

    def enviar_para_revisao(self, cpf, id_curso):
        self.autorizar_qualidade(cpf)
        self._validar_curso_pronto(id_curso)
        self.repo.alterar_status_curso_admin(id_curso, "EM_REVISAO")
        return self.obter_curso(cpf, id_curso)

    def publicar(self, cpf, id_curso):
        self.autorizar_qualidade(cpf)
        self._validar_curso_pronto(id_curso)
        self.repo.alterar_status_curso_admin(id_curso, "PUBLICADO")
        # Atribuicao so matricula em curso publicado: e na publicacao que as
        # matriculas obrigatorias pendentes finalmente entram.
        if self.repo.estrutura_atribuicao_disponivel():
            self.repo.sincronizar_atribuicoes(id_curso)
        return self.obter_curso(cpf, id_curso)

    def voltar_para_rascunho(self, cpf, id_curso):
        self.autorizar_qualidade(cpf)
        if not self.repo.alterar_status_curso_admin(
            id_curso,
            "RASCUNHO"
        ):
            raise AcademiaServiceError("Curso não encontrado.", 404)
        return self.obter_curso(cpf, id_curso)

    def arquivar(self, cpf, id_curso):
        self.autorizar_qualidade(cpf)
        if not self.repo.arquivar_curso_admin(id_curso):
            raise AcademiaServiceError("Curso não encontrado.", 404)
        return {"mensagem": "Curso arquivado com sucesso."}

    # ------------------------------------------------------------------
    # Atribuicao de cursos
    # ------------------------------------------------------------------

    def _exigir_estrutura_atribuicao(self):
        if not self.repo.estrutura_atribuicao_disponivel():
            raise AcademiaServiceError(
                "A estrutura de atribuições da Academia ainda não foi "
                "instalada.",
                503
            )

    @staticmethod
    def _atribuicao_publica(row):
        return {
            "id": row["id"],
            "curso_id": row["curso_id"],
            "tipo_publico": row["tipo_publico"],
            "alvo": row.get("alvo") or "",
            "obrigatoria": bool(row.get("obrigatoria")),
            "prazo_dias": row.get("prazo_dias"),
            "data_limite": _iso(_para_data(row.get("data_limite"))),
            "sincronizado_em": _iso(row.get("sincronizado_em")),
            "matriculas": row.get("matriculas") or 0,
        }

    def listar_atribuicoes(self, cpf, id_curso):
        self.autorizar_qualidade(cpf)
        if not self.repo.estrutura_atribuicao_disponivel():
            return []
        return [
            self._atribuicao_publica(row)
            for row in self.repo.listar_atribuicoes(id_curso)
        ]

    def _validar_atribuicao(self, data):
        tipo = self._normalizar(data.get("tipo_publico"))
        if tipo not in self.TIPOS_PUBLICO:
            raise AcademiaServiceError("Tipo de público inválido.", 400)

        alvo = " ".join(str(data.get("alvo") or "").strip().upper().split())
        if tipo == "TODOS":
            alvo = ""
        elif not alvo:
            raise AcademiaServiceError(
                "Informe o público da atribuição.",
                400
            )
        if tipo == "COLABORADOR":
            alvo = "".join(
                caractere for caractere in alvo if caractere.isdigit()
            )
            if not alvo:
                raise AcademiaServiceError("CPF inválido.", 400)

        prazo_dias = data.get("prazo_dias")
        data_limite = str(data.get("data_limite") or "").strip() or None

        if prazo_dias in ("", None):
            prazo_dias = None
        else:
            prazo_dias = self._inteiro(prazo_dias, "Prazo em dias", 1)

        if prazo_dias and data_limite:
            raise AcademiaServiceError(
                "Escolha entre prazo em dias ou data limite, não os dois.",
                400
            )

        if data_limite:
            if _para_data(data_limite) is None:
                raise AcademiaServiceError("Data limite inválida.", 400)
            data_limite = _para_data(data_limite).isoformat()

        return {
            "tipo_publico": tipo,
            "alvo": alvo,
            "obrigatoria": bool(data.get("obrigatoria", True)),
            "prazo_dias": prazo_dias,
            "data_limite": data_limite,
        }

    def salvar_atribuicao(self, cpf, id_curso, data):
        self.autorizar_qualidade(cpf)
        self._exigir_estrutura_atribuicao()
        if not self.repo.obter_estrutura_admin(id_curso):
            raise AcademiaServiceError("Curso não encontrado.", 404)

        validado = self._validar_atribuicao(data)
        self.repo.salvar_atribuicao(id_curso, validado, str(cpf))
        return self.sincronizar_atribuicoes(cpf, id_curso)

    def remover_atribuicao(self, cpf, id_curso, id_atribuicao):
        self.autorizar_qualidade(cpf)
        self._exigir_estrutura_atribuicao()
        if not self.repo.desativar_atribuicao(id_curso, id_atribuicao):
            raise AcademiaServiceError("Atribuição não encontrada.", 404)
        # As matriculas ja criadas permanecem: retirar o publico nao apaga o
        # historico de quem comecou o curso.
        return {
            "atribuicoes": self.listar_atribuicoes(cpf, id_curso),
            "novas_matriculas": 0,
        }

    def sincronizar_atribuicoes(self, cpf, id_curso):
        self.autorizar_qualidade(cpf)
        self._exigir_estrutura_atribuicao()

        validacao = self.repo.validar_publicacao_admin(id_curso)
        if not validacao:
            raise AcademiaServiceError("Curso não encontrado.", 404)

        novas = self.repo.sincronizar_atribuicoes(id_curso)
        return {
            "atribuicoes": self.listar_atribuicoes(cpf, id_curso),
            "novas_matriculas": novas or 0,
        }

    def validar_certificado(self, cpf, codigo):
        self.autorizar_qualidade(cpf)
        if not self.repo.estrutura_certificado_disponivel():
            raise AcademiaServiceError(
                "A estrutura de certificados da Academia ainda não foi "
                "instalada.",
                503
            )
        registro = self.repo.obter_certificado_por_codigo(
            str(codigo or "").strip().upper()
        )
        if not registro:
            raise AcademiaServiceError(
                "Certificado não encontrado.",
                404
            )
        return AcademiaService._certificado_publico(registro)
