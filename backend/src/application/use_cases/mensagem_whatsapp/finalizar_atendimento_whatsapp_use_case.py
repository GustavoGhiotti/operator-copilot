from datetime import datetime, timezone
from .constantes_eventos import TIPO_EVENTO_ATENDIMENTO_FINALIZADO
from .validacao_estado_operacional import (
    ConflitoOperacionalError,
    RecursoNaoEncontradoError,
    validar_estado_conversa_atendimento,
)


class FinalizarAtendimentoWhatsappUseCase:
    def __init__(self, repository):
        self.repository = repository

    def executar(self, payload: dict) -> dict:
        id_conversa = payload["id_conversa"]
        cpf_operador = payload["cpf_operador"]
        nome_operador = payload["nome_operador"]
        motivo = payload.get("motivo_finalizacao")
        observacao = payload.get("observacao_finalizacao")

        agora_utc = datetime.now(timezone.utc)

        conversa = self.repository.obter_conversa_por_id(id_conversa)
        if not conversa:
            raise RecursoNaoEncontradoError(
                "Conversa nao encontrada.",
                "MONITORIA_CONVERSA_NAO_ENCONTRADA"
            )

        atendimento = self.repository.obter_atendimento_ativo_por_conversa(
            id_conversa
        )
        validar_estado_conversa_atendimento(conversa, atendimento)

        if conversa.get("STATUS_CONVERSA") != "EM_ATENDIMENTO":
            raise ConflitoOperacionalError(
                "A conversa nao esta em atendimento ativo.",
                "MONITORIA_CONVERSA_FORA_DE_ATENDIMENTO"
            )

        if conversa.get("CPF_OPERADOR_ATUAL") != cpf_operador:
            raise ConflitoOperacionalError(
                "Voce nao e o operador responsavel por este atendimento.",
                "MONITORIA_OPERADOR_NAO_RESPONSAVEL"
            )

        if not atendimento:
            raise ConflitoOperacionalError(
                "Nao existe atendimento ativo para esta conversa.",
                "MONITORIA_ATENDIMENTO_ATIVO_AUSENTE"
            )

        id_atendimento = atendimento["ID_ATENDIMENTO"]

        with self.repository.transacao():
            atendimento_finalizado = self.repository.finalizar_atendimento(
                id_atendimento=id_atendimento,
                nome_operador_fim=nome_operador,
                data_fim=agora_utc,
                motivo=motivo,
                observacao=observacao
            )

            if not atendimento_finalizado:
                raise ConflitoOperacionalError(
                    "O atendimento foi alterado por outro processo.",
                    "MONITORIA_ATENDIMENTO_CONCORRENTE"
                )

            conversa_encerrada = self.repository.encerrar_conversa(
                id_conversa,
                status_esperado="EM_ATENDIMENTO"
            )

            if not conversa_encerrada:
                raise ConflitoOperacionalError(
                    "A conversa foi alterada por outro processo.",
                    "MONITORIA_CONVERSA_CONCORRENTE"
                )

            self.repository.inserir_evento(
                tipo_evento=TIPO_EVENTO_ATENDIMENTO_FINALIZADO,
                id_conversa=id_conversa,
                id_atendimento=id_atendimento,
                numero_empresa=conversa["NUMERO_EMPRESA"],
                numero_cliente=conversa["NUMERO_CLIENTE"],
                cpf_operador=cpf_operador,
                nome_operador=nome_operador,
                payload={
                    "status_conversa": "ENCERRADA",
                    "motivo": motivo
                }
            )

        return {
            "ok": True,
            "id_conversa": id_conversa,
            "id_atendimento": id_atendimento
        }
