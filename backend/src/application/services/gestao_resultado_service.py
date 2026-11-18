from datetime import date, datetime, timedelta

from src.infrastructure.repositories.sql_gestao_resultado_repository import (
    ORDENACOES,
    GestaoResultadoRepository,
)


class GestaoResultadoError(Exception):
    def __init__(self, mensagem, status=400):
        super().__init__(mensagem)
        self.status = status


# Quem parou de dar sinal ha mais de 30 minutos nao esta online, esta ausente.
# A regra mora aqui e nao no banco para ser afinada sem migracao. Ela existe
# porque IS_LOGADO vira 1 no login e so volta a 0 no logout explicito: quem
# fecha o navegador fica "online" para sempre, e o contador do painel antigo e
# inflado por isso.
MINUTOS_PARA_AUSENTE = 30

PERIODO_MAXIMO_DIAS = 400
LIMITE_MAXIMO = 200


class GestaoResultadoService:
    def __init__(self, repo=None):
        self.repo = repo or GestaoResultadoRepository()

    # ---------------------------------------------------------------- #

    def obter_resumo(self, filtros) -> dict:
        inicio, fim = self._periodo(filtros)
        carteira = self._carteira(filtros)

        resumo = self.repo.obter_resumo(
            data_inicio=inicio, data_fim=fim, id_carteira=carteira
        )
        cobertura = self.repo.contar_cobertura_meta(data_inicio=inicio, data_fim=fim)

        # Periodo anterior de mesmo tamanho, para a tela dizer "subiu" ou
        # "caiu" em vez de so mostrar um numero solto.
        dias = (fim - inicio).days + 1
        anterior = self.repo.obter_resumo(
            data_inicio=inicio - timedelta(days=dias),
            data_fim=inicio - timedelta(days=1),
            id_carteira=carteira,
        )

        recuperado = self._decimal(resumo.get("VL_RECUPERADO"))
        fechado = self._decimal(resumo.get("VL_FECHADO"))
        meta = self._decimal(resumo.get("VL_META"))

        return {
            "periodo": {"inicio": inicio.isoformat(), "fim": fim.isoformat(), "dias": dias},
            "valor_recuperado": recuperado,
            "valor_fechado": fechado,
            "acordos": self._inteiro(resumo.get("QT_ACORDOS")),
            "cpc": self._inteiro(resumo.get("QT_CPC")),
            "conversao": self._percentual(recuperado, fechado),
            "meta": meta,
            "atingimento": self._percentual(recuperado, meta),
            "operadores": self._inteiro(resumo.get("QT_OPERADORES")),
            "operadores_ativos": self._inteiro(resumo.get("QT_OPERADORES_ATIVOS")),
            "valor_nao_atribuido": self._decimal(resumo.get("VL_NAO_ATRIBUIDO")),
            # Sem vega no periodo, a tela esconde recuperado e conversao em vez
            # de mostrar zero -- zero aqui significaria "nao entrou dinheiro".
            "tem_vega": bool(resumo.get("TEM_VEGA")),
            "cobertura_meta": {
                "operadores": self._inteiro(cobertura.get("QT_OPERADORES")),
                "com_meta": self._inteiro(cobertura.get("QT_COM_META")),
            },
            "comparativo": {
                "valor_recuperado": self._variacao(
                    recuperado, self._decimal(anterior.get("VL_RECUPERADO"))
                ),
                "valor_fechado": self._variacao(
                    fechado, self._decimal(anterior.get("VL_FECHADO"))
                ),
                "acordos": self._variacao(
                    self._inteiro(resumo.get("QT_ACORDOS")),
                    self._inteiro(anterior.get("QT_ACORDOS")),
                ),
            },
            "atualizado_em": self._frescor(),
        }

    def listar_operadores(self, filtros) -> dict:
        inicio, fim = self._periodo(filtros)

        ordenar_por = str(filtros.get("ordenar_por") or "RECUPERADO").upper()
        if ordenar_por not in ORDENACOES:
            raise GestaoResultadoError(f"Ordenacao invalida: {ordenar_por}.", 400)

        pagina = max(1, self._para_inteiro(filtros.get("pagina"), 1))
        tamanho = min(LIMITE_MAXIMO, max(1, self._para_inteiro(filtros.get("tamanho"), 50)))

        linhas = self.repo.listar_ranking_operadores(
            data_inicio=inicio,
            data_fim=fim,
            id_carteira=self._carteira(filtros),
            supervisor=self._texto(filtros.get("supervisor")),
            busca=self._texto(filtros.get("busca")),
            ordenar_por=ordenar_por,
            offset=(pagina - 1) * tamanho,
            limite=tamanho,
        )

        presenca = self._presenca()
        total = self._inteiro(linhas[0].get("QT_TOTAL")) if linhas else 0

        return {
            "pagina": pagina,
            "tamanho": tamanho,
            "total": total,
            "ordenar_por": ordenar_por,
            "operadores": [self._mapear_operador(linha, presenca) for linha in linhas],
            "atualizado_em": self._frescor(),
        }

    def listar_carteiras(self, filtros) -> dict:
        inicio, fim = self._periodo(filtros)
        linhas = self.repo.listar_carteiras(data_inicio=inicio, data_fim=fim)

        return {
            "carteiras": [
                {
                    "id_carteira": self._inteiro(linha.get("ID_CARTEIRA")),
                    "carteira": linha.get("NM_CARTEIRA") or "Nao classificada",
                    "slug": linha.get("SLUG_CARTEIRA"),
                    "valor_fechado": self._decimal(linha.get("VL_FECHADO")),
                    "valor_recuperado": self._decimal(linha.get("VL_RECUPERADO")),
                    "acordos": self._inteiro(linha.get("QT_ACORDOS")),
                    "cpc": self._inteiro(linha.get("QT_CPC")),
                    "meta": self._decimal(linha.get("VL_META")),
                    "operadores": self._inteiro(linha.get("QT_OPERADORES")),
                    "conversao": self._percentual(
                        self._decimal(linha.get("VL_RECUPERADO")),
                        self._decimal(linha.get("VL_FECHADO")),
                    ),
                    "atingimento": self._percentual(
                        self._decimal(linha.get("VL_RECUPERADO")),
                        self._decimal(linha.get("VL_META")),
                    ),
                }
                for linha in linhas
            ],
            "atualizado_em": self._frescor(),
        }

    def listar_evolucao(self, filtros) -> dict:
        meses = min(24, max(1, self._para_inteiro(filtros.get("meses"), 6)))
        hoje = date.today()
        primeiro = date(hoje.year, hoje.month, 1)
        for _ in range(meses - 1):
            primeiro = date(primeiro.year, primeiro.month, 1) - timedelta(days=1)
            primeiro = date(primeiro.year, primeiro.month, 1)

        linhas = self.repo.listar_serie_mensal(
            data_inicio=primeiro,
            data_fim=hoje,
            id_carteira=self._carteira(filtros),
        )

        serie = [
            {
                "mes_chave": linha.get("MES_CHAVE"),
                "mes": self._rotulo_mes(linha.get("MES_CHAVE")),
                "valor_fechado": self._decimal(linha.get("VL_FECHADO")),
                "valor_recuperado": self._decimal(linha.get("VL_RECUPERADO")),
                "acordos": self._inteiro(linha.get("QT_ACORDOS")),
                # Onde nao ha vega, a tela corta a linha em vez de desenhar
                # zero: TB_PARCELAS guarda 16 meses de fechamento, mas o
                # recuperado so existe enquanto INFORMACAO_PAGAMENTOS segurar.
                "tem_vega": bool(linha.get("TEM_VEGA")),
            }
            for linha in linhas
        ]

        com_vega = [item["mes_chave"] for item in serie if item["tem_vega"]]

        return {
            "serie": serie,
            "vega_comeca_em": com_vega[0] if com_vega else None,
            "atualizado_em": self._frescor(),
        }

    def obter_ficha(self, chave_operador, filtros) -> dict:
        if not str(chave_operador or "").strip():
            raise GestaoResultadoError("Informe o operador.", 400)

        inicio, fim = self._periodo(filtros)
        ficha = self.repo.obter_ficha_operador(
            chave_operador=str(chave_operador).strip(),
            data_inicio=inicio,
            data_fim=fim,
        )

        agregado = ficha["agregado"]
        if not agregado or agregado.get("NM_OPERADOR") is None:
            raise GestaoResultadoError("Operador sem resultado no periodo.", 404)

        recuperado = self._decimal(agregado.get("VL_RECUPERADO"))
        meta = self._decimal(agregado.get("VL_META"))
        presenca = self._presenca()

        return {
            "operador": {
                "chave": str(chave_operador).strip(),
                "nome": agregado.get("NM_OPERADOR"),
                "supervisor": agregado.get("NM_SUPERVISOR") or "Sem supervisao",
                "funcao": agregado.get("NM_FUNCAO"),
                "status": presenca.get(str(agregado.get("CPF_COLABORADOR") or ""), "offline"),
                "valor_fechado": self._decimal(agregado.get("VL_FECHADO")),
                "valor_recuperado": recuperado,
                "acordos": self._inteiro(agregado.get("QT_ACORDOS")),
                "cpc": self._inteiro(agregado.get("QT_CPC")),
                "dias_trabalhados": self._inteiro(agregado.get("QT_DIAS")),
                "meta": meta,
                "atingimento": self._percentual(recuperado, meta) if meta else None,
                "monitorias": self._inteiro(agregado.get("QT_MONITORIAS")),
                "nota_qualidade": self._decimal(agregado.get("VL_NOTA_QUALIDADE")) or None,
            },
            "serie": [
                {
                    "data": self._iso(linha.get("DATA")),
                    "valor_fechado": self._decimal(linha.get("VL_FECHADO")),
                    "valor_recuperado": self._decimal(linha.get("VL_RECUPERADO")),
                    "acordos": self._inteiro(linha.get("QT_ACORDOS")),
                    "cpc": self._inteiro(linha.get("QT_CPC")),
                    "meta": self._decimal(linha.get("VL_META")),
                    "trabalhou": bool(linha.get("DIA_TRABALHADO")),
                }
                for linha in ficha["serie"]
            ],
            "carteiras": [
                {
                    "carteira": linha.get("NM_CARTEIRA") or "Nao classificada",
                    "valor_fechado": self._decimal(linha.get("VL_FECHADO")),
                    "valor_recuperado": self._decimal(linha.get("VL_RECUPERADO")),
                }
                for linha in ficha["carteiras"]
            ],
            "atualizado_em": self._frescor(),
        }

    def listar_filtros(self) -> dict:
        dados = self.repo.listar_filtros()
        return {
            "carteiras": [
                {
                    "id_carteira": self._inteiro(linha.get("ID_CARTEIRA")),
                    "nome": linha.get("NM_CARTEIRA"),
                    "slug": linha.get("SLUG_CARTEIRA"),
                }
                for linha in dados["carteiras"]
            ],
            "supervisores": [
                linha.get("NM_SUPERVISOR") for linha in dados["supervisores"]
            ],
            "ordenacoes": sorted(ORDENACOES),
        }

    # ---------------------------------------------------------------- #

    def _mapear_operador(self, linha, presenca) -> dict:
        recuperado = self._decimal(linha.get("VL_RECUPERADO"))
        meta = self._decimal(linha.get("VL_META"))
        cpf = str(linha.get("CPF_COLABORADOR") or "")

        return {
            "chave": linha.get("CHAVE_OPERADOR"),
            "cpf": cpf or None,
            "nome": linha.get("NM_OPERADOR"),
            "supervisor": linha.get("NM_SUPERVISOR") or "Sem supervisao",
            "carteira": linha.get("NM_CARTEIRA") or "Nao classificada",
            "posicao": self._inteiro(linha.get("POSICAO")),
            "valor_fechado": self._decimal(linha.get("VL_FECHADO")),
            "valor_recuperado": recuperado,
            "acordos": self._inteiro(linha.get("QT_ACORDOS")),
            "cpc": self._inteiro(linha.get("QT_CPC")),
            "dias_trabalhados": self._inteiro(linha.get("QT_DIAS")),
            "meta": meta or None,
            # None e diferente de 0: "nao tem meta cadastrada" nao e "nao bateu
            # a meta". Sao 116 de 1.260 operadores com meta valida hoje.
            "atingimento": self._percentual(recuperado, meta) if meta else None,
            "nota_qualidade": self._decimal(linha.get("VL_NOTA_QUALIDADE")) or None,
            "status": presenca.get(cpf, "offline"),
        }

    def _presenca(self) -> dict:
        agora = datetime.now()
        limite = agora - timedelta(minutes=MINUTOS_PARA_AUSENTE)

        situacao = {}
        for linha in self.repo.listar_presenca():
            cpf = str(linha.get("CPF_COLABORADOR") or "")
            if not cpf:
                continue
            ultimo = linha.get("DT_ULTIMO_ACESSO")
            situacao[cpf] = "online" if ultimo and ultimo >= limite else "ausente"
        return situacao

    def _frescor(self):
        execucao = self.repo.obter_frescor()
        if not execucao or not execucao.get("DT_FIM"):
            return None
        return {
            "em": self._iso(execucao.get("DT_FIM")),
            "tipo": execucao.get("TIPO_CARGA"),
        }

    def _periodo(self, filtros) -> tuple[date, date]:
        hoje = date.today()
        inicio = self._data(filtros.get("data_inicio"))
        fim = self._data(filtros.get("data_fim"))

        if inicio is None and fim is None:
            return date(hoje.year, hoje.month, 1), hoje
        if inicio is None:
            inicio = date(fim.year, fim.month, 1)
        if fim is None:
            fim = hoje

        if fim < inicio:
            raise GestaoResultadoError("data_fim nao pode ser anterior a data_inicio.", 400)
        if (fim - inicio).days > PERIODO_MAXIMO_DIAS:
            raise GestaoResultadoError(
                f"Periodo maximo de {PERIODO_MAXIMO_DIAS} dias.", 400
            )
        return inicio, fim

    @staticmethod
    def _data(valor):
        if not valor:
            return None
        try:
            return datetime.strptime(str(valor).strip(), "%Y-%m-%d").date()
        except ValueError:
            raise GestaoResultadoError("Data invalida. Use YYYY-MM-DD.", 400)

    def _carteira(self, filtros):
        valor = filtros.get("id_carteira")
        if valor in (None, "", "todas"):
            return None
        try:
            return int(valor)
        except (TypeError, ValueError):
            raise GestaoResultadoError("id_carteira invalido.", 400)

    @staticmethod
    def _texto(valor):
        texto = str(valor or "").strip()
        return texto or None

    @staticmethod
    def _para_inteiro(valor, padrao):
        try:
            return int(valor)
        except (TypeError, ValueError):
            return padrao

    @staticmethod
    def _inteiro(valor):
        return int(valor or 0)

    @staticmethod
    def _decimal(valor):
        return round(float(valor or 0), 2)

    @staticmethod
    def _percentual(numerador, denominador):
        if not denominador:
            return 0.0
        return round((float(numerador) / float(denominador)) * 100, 1)

    @staticmethod
    def _variacao(atual, anterior):
        if not anterior:
            return None
        return round(((float(atual) - float(anterior)) / float(anterior)) * 100, 1)

    @staticmethod
    def _iso(valor):
        if valor is None:
            return None
        if hasattr(valor, "isoformat"):
            return valor.isoformat()
        return str(valor)

    @staticmethod
    def _rotulo_mes(mes_chave):
        if not mes_chave:
            return "-"
        try:
            dt = datetime.strptime(mes_chave, "%Y-%m")
        except ValueError:
            return mes_chave
        meses = ["jan", "fev", "mar", "abr", "mai", "jun",
                 "jul", "ago", "set", "out", "nov", "dez"]
        return f"{meses[dt.month - 1]}/{str(dt.year)[-2:]}"
