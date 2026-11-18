from .constantes_eventos import TIPO_EVENTO_CONVERSA_REABERTA


class ReabrirConversaUseCase:
    def __init__(self, repository):
        self.repository = repository

    def executar(self, payload: dict) -> dict:
        """
        payload esperado:
        {
            "id_conversa": int,
            "cpf_supervisor": str,
            "nome_supervisor": str
        }
        """

        id_conversa = payload["id_conversa"]
        cpf_supervisor = payload["cpf_supervisor"]
        nome_supervisor = payload["nome_supervisor"]

        # 1) Conversa deve existir
        conversa = self.repository.obter_conversa_por_id(id_conversa)
        if not conversa:
            raise PermissionError("Conversa não encontrada.")

        # 2) Conversa deve estar encerrada
        if conversa["STATUS_CONVERSA"] != "ENCERRADA":
            raise PermissionError("A conversa não está encerrada.")

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

        with self.repository.transacao():
            # 5) Reabrir conversa
            conversa_reaberta = self.repository.reabrir_conversa(id_conversa)
            if not conversa_reaberta:
                raise PermissionError("A conversa foi alterada por outro processo.")

            # 6) Evento
            self.repository.inserir_evento(
                tipo_evento=TIPO_EVENTO_CONVERSA_REABERTA,
                id_conversa=id_conversa,
                numero_empresa=numero_empresa,
                numero_cliente=numero_cliente,
                cpf_operador=cpf_supervisor,
                nome_operador=nome_supervisor,
                payload={
                    "status_conversa": "ABERTA"
                }
            )

        return {
            "ok": True,
            "id_conversa": id_conversa
        }
