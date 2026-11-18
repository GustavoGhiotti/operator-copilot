from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EvidenciaAnalise(BaseModel):
    segmento_id: int | None = None
    inicio_segundos: float = Field(ge=0)
    fim_segundos: float = Field(ge=0)
    texto: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def validar_intervalo(self):
        if self.fim_segundos < self.inicio_segundos:
            raise ValueError("fim_segundos deve ser maior ou igual a inicio_segundos")
        return self


class CategoriaAnalise(BaseModel):
    codigo: str = Field(min_length=2, max_length=80)
    nome: str = Field(min_length=2, max_length=150)
    nota: int = Field(ge=0, le=100)
    status: Literal["ATENDEU", "PARCIAL", "NAO_ATENDEU", "NAO_APLICAVEL"]
    justificativa: str = Field(min_length=1, max_length=4000)
    evidencias: list[EvidenciaAnalise] = Field(default_factory=list)
    orientacao: str = Field(min_length=1, max_length=4000)


class DestaqueAnalise(BaseModel):
    titulo: str = Field(min_length=1, max_length=200)
    descricao: str = Field(min_length=1, max_length=4000)
    exemplo_melhorado: str | None = Field(default=None, max_length=4000)


class AlertaCritico(BaseModel):
    codigo: str = Field(min_length=2, max_length=80)
    titulo: str = Field(min_length=1, max_length=200)
    descricao: str = Field(min_length=1, max_length=4000)
    evidencias: list[EvidenciaAnalise] = Field(min_length=1)


class ResumoAnalise(BaseModel):
    nota_geral: int = Field(ge=0, le=100)
    classificacao: Literal["EXCELENTE", "BOM", "ATENCAO", "CRITICO"]
    resumo_atendimento: str = Field(min_length=1, max_length=6000)


class ResultadoAuditoriaIA(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"] = "1.0"
    resumo: ResumoAnalise
    categorias: list[CategoriaAnalise] = Field(min_length=1)
    pontos_positivos: list[DestaqueAnalise]
    pontos_melhoria: list[DestaqueAnalise]
    alertas_criticos: list[AlertaCritico]
    proxima_melhor_acao: str = Field(min_length=1, max_length=4000)
    confianca_analise: float = Field(ge=0, le=1)
    limitacoes: list[str] = Field(default_factory=list)


class SegmentoTranscricao(BaseModel):
    ordem: int = Field(ge=1)
    inicio_segundos: float = Field(ge=0)
    fim_segundos: float = Field(ge=0)
    interlocutor: str = Field(min_length=1, max_length=100)
    texto: str = Field(min_length=1)


class ResultadoTranscricao(BaseModel):
    texto: str
    duracao_segundos: float = Field(default=0, ge=0)
    idioma: str | None = None
    segmentos: list[SegmentoTranscricao]


class OrientacaoTempoReal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    fase: str = Field(min_length=1, max_length=100)
    contexto: str = Field(min_length=1, max_length=1000)
    orientacao: str = Field(min_length=1, max_length=2000)
    fala_sugerida: str = Field(min_length=1, max_length=2000)
    prioridade: Literal["BAIXA", "MEDIA", "ALTA"]
    confianca: float = Field(ge=0, le=1)
    risco: str | None = Field(default=None, max_length=1000)
