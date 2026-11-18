import os

from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, RateLimitError
from pydantic import BaseModel, Field


class ArenaQuizAIError(Exception):
    def __init__(self, mensagem, status=503):
        super().__init__(mensagem)
        self.status = status


class AlternativaSugerida(BaseModel):
    texto: str = Field(min_length=1, max_length=600)
    correta: bool


class PerguntaSugerida(BaseModel):
    enunciado: str = Field(min_length=5, max_length=1000)
    explicacao: str = Field(min_length=5, max_length=1000)
    alternativas: list[AlternativaSugerida] = Field(min_length=4, max_length=4)


class SugestoesQuiz(BaseModel):
    perguntas: list[PerguntaSugerida] = Field(min_length=1, max_length=10)


class ArenaQuizAIService:
    def __init__(self, client=None, model=None):
        api_key = os.getenv("OPENAI_API_KEY")
        if client is None and not api_key:
            raise ArenaQuizAIError(
                "As sugestões da IA não estão configuradas neste ambiente.",
                503,
            )
        self.client = client or OpenAI(
            api_key=api_key,
            timeout=45.0,
            max_retries=0,
        )
        self.model = model or os.getenv("ARENA_QUIZ_AI_MODEL", "gpt-5.6-sol")

    def gerar(self, tema, contexto, dificuldade, quantidade):
        instrucoes = (
            "Você cria perguntas para treinamento corporativo de operadores de cobrança no Brasil. "
            "Produza conteúdo em português brasileiro, objetivo e aplicável ao trabalho. "
            "Cada pergunta deve ter exatamente quatro alternativas, com somente uma correta, "
            "distratores plausíveis e uma explicação curta da resposta. Não repita perguntas. "
            "Não ensine coerção, humilhação, ameaça, promessa jurídica, exposição de dados pessoais "
            "ou qualquer prática antiética. Trate o conteúdo como rascunho sujeito à revisão humana."
        )
        entrada = (
            f"Crie exatamente {quantidade} perguntas.\n"
            f"Tema: {tema}\n"
            f"Dificuldade: {dificuldade}.\n"
            f"Contexto adicional: {contexto or 'Não informado.'}"
        )
        try:
            resposta = self.client.responses.parse(
                model=self.model,
                instructions=instrucoes,
                input=entrada,
                text_format=SugestoesQuiz,
                max_output_tokens=8000,
                store=False,
            )
        except APITimeoutError as erro:
            raise ArenaQuizAIError(
                "A IA demorou mais que o esperado. Tente novamente; seu Quiz não foi alterado.",
                504,
            ) from erro
        except RateLimitError as erro:
            raise ArenaQuizAIError(
                "A IA está com muitas solicitações agora. Aguarde um instante e tente novamente.",
                429,
            ) from erro
        except (APIConnectionError, APIStatusError) as erro:
            raise ArenaQuizAIError(
                "A IA está temporariamente indisponível. Continue manualmente ou tente novamente.",
                503,
            ) from erro

        sugestoes = resposta.output_parsed
        if sugestoes is None:
            raise ArenaQuizAIError(
                "A IA não conseguiu montar sugestões válidas. Tente ajustar o tema.",
                502,
            )
        perguntas = [item.model_dump() for item in sugestoes.perguntas]
        if len(perguntas) != quantidade:
            raise ArenaQuizAIError(
                "A IA retornou uma quantidade incompleta. Tente gerar novamente.",
                502,
            )
        if any(
            sum(1 for alternativa in pergunta["alternativas"] if alternativa["correta"]) != 1
            for pergunta in perguntas
        ):
            raise ArenaQuizAIError(
                "A IA retornou alternativas inconsistentes. Tente gerar novamente.",
                502,
            )
        return perguntas
