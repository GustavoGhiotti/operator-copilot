from datetime import datetime, timezone
from .constantes_eventos import (
    TIPO_EVENTO_ATENDIMENTO_INICIADO,
    TIPO_EVENTO_CONCILIACAO_ESTADO,
)
from .validacao_estado_operacional import (
    ConflitoOperacionalError,
    RecursoNaoEncontradoError,
    validar_estado_conversa_atendimento,
)


class IniciarAtendimentoWhatsappUseCase:
    def __init__(self, repository):
        self.repository = repository

    def executar(self, payload: dict) -> dict:
        numero_empresa = payload["numero_empresa"]
        numero_cliente = payload["numero_cliente"]
        cpf_operador = payload["cpf_operador"]
        nome_operador = payload["nome_operador"]

        agora_utc = datetime.now(timezone.utc)

        carteira_numero = self.repository.obter_carteira_por_numero_empresa(
            numero_empresa
        )
        if not carteira_numero:
            raise ConflitoOperacionalError(
                "Numero da empresa invalido ou inativo.",
                "MONITORIA_NUMERO_EMPRESA_INVALIDO"
            )

        centro_custo_operador = self.repository.obter_centro_custo_por_cpf(
            cpf_operador
        )
        if not centro_custo_operador:
            raise ConflitoOperacionalError(
                "Usuario nao encontrado ou inativo.",
                "MONITORIA_USUARIO_INATIVO"
            )

        carteira_operador = self.repository.obter_carteira_por_centro_custo(
            centro_custo_operador
        )
        if not carteira_operador:
            raise ConflitoOperacionalError(
                "Carteira nao habilitada para WhatsApp.",
                "MONITORIA_CARTEIRA_NAO_HABILITADA"
            )

        if carteira_operador != carteira_numero:
            raise ConflitoOperacionalError(
                "Voce nao pode atender conversas de outra carteira.",
                "MONITORIA_CARTEIRA_DIVERGENTE"
            )

        conversa = self.repository.obter_conversa_aberta(
            numero_empresa=numero_empresa,
            numero_cliente=numero_cliente
        )
        if not conversa:
            raise RecursoNaoEncontradoError(
                "Nao existe conversa aberta para este cliente.",
                "MONITORIA_CONVERSA_ABERTA_NAO_ENCONTRADA"
            )

        id_conversa = conversa["ID_CONVERSA"]
        atendimento_ativo = self.repository.obter_atendimento_ativo_por_conversa(
            id_conversa
        )

        if (
            atendimento_ativo
            and (conversa.get("STATUS_CONVERSA") or "").strip().upper() == "ABERTA"
            and conversa.get("CPF_OPERADOR_ATUAL")
            and conversa.get("NOME_OPERADOR_ATUAL")
        ):
            with self.repository.transacao():
                reconciliada = self.repository.reconciliar_conversa_para_em_atendimento(
                    id_conversa
                )

                if reconciliada:
                    self.repository.inserir_evento(
                        tipo_evento=TIPO_EVENTO_CONCILIACAO_ESTADO,
                        id_conversa=id_conversa,
                        id_atendimento=atendimento_ativo["ID_ATENDIMENTO"],
                        numero_empresa=numero_empresa,
                        numero_cliente=numero_cliente,
                        cpf_operador=conversa["CPF_OPERADOR_ATUAL"],
                        nome_operador=conversa["NOME_OPERADOR_ATUAL"],
                        payload={
                            "status_anterior": "ABERTA",
                            "status_corrigido": "EM_ATENDIMENTO",
                            "motivo": "CONVERSA_ABERTA_COM_ATENDIMENTO_ATIVO"
                        }
                    )

            conversa = self.repository.obter_conversa_por_id(id_conversa)
            atendimento_ativo = self.repository.obter_atendimento_ativo_por_conversa(
                id_conversa
            )

        validar_estado_conversa_atendimento(conversa, atendimento_ativo)

        if atendimento_ativo:
            raise ConflitoOperacionalError(
                "Ja existe um atendimento ativo.",
                "MONITORIA_ATENDIMENTO_ATIVO_EXISTENTE"
            )

        with self.repository.transacao():
            id_atendimento = self.repository.criar_atendimento(
                id_conversa=id_conversa,
                nome_operador_inicio=nome_operador,
                data_inicio=agora_utc
            )

            conversa_assumida = self.repository.assumir_conversa(
                id_conversa=id_conversa,
                cpf_operador=cpf_operador,
                nome_operador=nome_operador,
                data_evento=agora_utc
            )

            if not conversa_assumida:
                raise ConflitoOperacionalError(
                    "Esta conversa ja esta em atendimento.",
                    "MONITORIA_CONVERSA_JA_EM_ATENDIMENTO"
                )

            self.repository.inserir_evento(
                tipo_evento=TIPO_EVENTO_ATENDIMENTO_INICIADO,
                id_conversa=id_conversa,
                id_atendimento=id_atendimento,
                numero_empresa=numero_empresa,
                numero_cliente=numero_cliente,
                cpf_operador=cpf_operador,
                nome_operador=nome_operador,
                payload={"status_conversa": "EM_ATENDIMENTO"}
            )

        return {
            "ok": True,
            "id_conversa": id_conversa,
            "id_atendimento": id_atendimento
        }
