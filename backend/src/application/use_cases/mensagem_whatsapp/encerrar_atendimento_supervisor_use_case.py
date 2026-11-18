from datetime import datetime, timezone
from .constantes_eventos import TIPO_EVENTO_CONVERSA_ENCERRADA_SUPERVISOR

class EncerrarAtendimentoSupervisorUseCase:
    def __init__(self, repository):
        self.repository = repository

    def executar(self, payload: dict) -> dict:
        """
        payload esperado:
        {
            "id_conversa": int,
            "cpf_supervisor": str,
            "nome_supervisor": str,
            "motivo_finalizacao": str (opcional),
            "observacao_finalizacao": str (opcional)
        }
        """

        id_conversa = payload["id_conversa"]
        cpf_supervisor = payload["cpf_supervisor"]
        nome_supervisor = payload["nome_supervisor"]
        motivo = payload.get("motivo_finalizacao", "ENCERRADO_SUPERVISOR")
        observacao = payload.get("observacao_finalizacao")

        agora = datetime.now(timezone.utc)

        # 1) Conversa deve existir
        conversa = self.repository.obter_conversa_por_id(id_conversa)
        if not conversa:
            raise PermissionError("Conversa não encontrada.")

        # 2) Conversa deve estar em atendimento
        if conversa["STATUS_CONVERSA"] != "EM_ATENDIMENTO":
            raise PermissionError("A conversa não está em atendimento.")

        numero_empresa = conversa["NUMERO_EMPRESA"]
        numero_cliente = conversa["NUMERO_CLIENTE"]

        # 3) Carteira da conversa
        carteira_conversa = self.repository.obter_carteira_por_numero_empresa(
            numero_empresa
        )
        if not carteira_conversa:
            raise PermissionError("Carteira da conversa não encontrada.")

        # 4) Carteira do supervisor
        cc_supervisor = self.repository.obter_centro_custo_por_cpf(cpf_supervisor)
        carteira_supervisor = self.repository.obter_carteira_por_centro_custo(
            cc_supervisor,
            somente_whatsapp=False
        )

        if carteira_supervisor != carteira_conversa:
            raise PermissionError(
                "Supervisor não pertence à carteira da conversa."
            )

        # 5) Deve existir atendimento ativo
        atendimento = self.repository.obter_atendimento_ativo_por_conversa(id_conversa)
        if not atendimento:
            raise PermissionError("Não existe atendimento ativo.")

        id_atendimento = atendimento["ID_ATENDIMENTO"]

        with self.repository.transacao():
            # 6) Finalizar atendimento
            atendimento_finalizado = self.repository.finalizar_atendimento(
                id_atendimento=id_atendimento,
                nome_operador_fim=nome_supervisor,
                data_fim=agora,
                motivo=motivo,
                observacao=observacao
            )

            if not atendimento_finalizado:
                raise PermissionError("O atendimento foi alterado por outro processo.")

            # 7) Encerrar conversa
            conversa_encerrada = self.repository.encerrar_conversa(
                id_conversa,
                status_esperado="EM_ATENDIMENTO"
            )

            if not conversa_encerrada:
                raise PermissionError("A conversa foi alterada por outro processo.")

            # 8) Evento
            self.repository.inserir_evento(
                tipo_evento=TIPO_EVENTO_CONVERSA_ENCERRADA_SUPERVISOR,
                id_conversa=id_conversa,
                id_atendimento=id_atendimento,
                numero_empresa=numero_empresa,
                numero_cliente=numero_cliente,
                cpf_operador=cpf_supervisor,
                nome_operador=nome_supervisor,
                payload={
                    "status_conversa": "ENCERRADA",
                    "motivo": motivo,
                    "observacao": observacao
                }
            )

        return {
            "ok": True,
            "id_conversa": id_conversa,
            "id_atendimento": id_atendimento
        }
