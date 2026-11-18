from datetime import datetime, timezone
from .constantes_eventos import TIPO_EVENTO_CONVERSA_TRANSFERIDA
from .validacao_estado_operacional import ConflitoOperacionalError
from src.shared.utils.monitoria_permissoes import funcao_eh_operador_monitoria

class TransferirAtendimentoUseCase:
    def __init__(self, repository):
        self.repository = repository
    
    def executar(self, payload: dict) -> dict:
        """
        payload esperado:
        {
            "id_conversa": int,
            "cpf_solicitante": str,
            "nome_solicitante": str,
            "cpf_destino": str,
            "nome_destino": str,
        }
        """

        id_conversa = payload["id_conversa"]
        cpf_solicitante = payload["cpf_solicitante"]
        nome_solicitante = payload["nome_solicitante"]
        cpf_destino = payload["cpf_destino"]
        nome_destino = payload["nome_destino"]

        agora = datetime.now(timezone.utc)

        # 1) Conversa deve existir
        conversa = self.repository.obter_conversa_por_id(id_conversa)
        if not conversa:
            raise ValueError("Conversa não encontrada")
        
        if conversa["STATUS_CONVERSA"] != "EM_ATENDIMENTO":
            raise PermissionError("A conversa não está em atendimento")
        
        numero_empresa = conversa["NUMERO_EMPRESA"]
        numero_cliente = conversa["NUMERO_CLIENTE"]

        # 2) Carteira da conversa
        carteira_conversa = self.repository.obter_carteira_por_numero_empresa(numero_empresa)

        if not carteira_conversa:
            raise PermissionError("Carteira da conversa não encontrada.")

        # 3) Carteira do solicitante
        cc_solicitante = self.repository.obter_centro_custo_por_cpf(cpf_solicitante)
        carteira_solicitante = self.repository.obter_carteira_por_centro_custo(
            cc_solicitante,
            somente_whatsapp=False
        )

        # 4) Carteira do destino
        usuario_destino = self.repository.obter_usuario_ativo_por_cpf(cpf_destino)
        if not usuario_destino:
            raise PermissionError("Usuário destino não encontrado ou inativo.")

        if not funcao_eh_operador_monitoria(usuario_destino.get("FUNCAO_COLABORADOR")):
            raise PermissionError("Destino não é operador habilitado para WhatsApp.")

        cc_destino = self.repository.obter_centro_custo_por_cpf(cpf_destino)
        carteira_destino = self.repository.obter_carteira_por_centro_custo(
            cc_destino
        )

        # VALIDAÇÕES
        if carteira_solicitante != carteira_conversa:
            raise PermissionError("Solicitante não pertence à carteira da conversa.")

        if carteira_destino != carteira_conversa:
            raise PermissionError("Destino não pertence à carteira da conversa.")

        if conversa["CPF_OPERADOR_ATUAL"] == cpf_destino:
            raise ConflitoOperacionalError(
                "A conversa ja esta atribuida a este operador.",
                "MONITORIA_TRANSFERENCIA_MESMO_OPERADOR"
            )

        # 5) Finalizar atendimento atual
        atendimento = self.repository.obter_atendimento_ativo_por_conversa(id_conversa)

        if not atendimento:
            raise PermissionError("Não existe atendimento ativo.")

        id_atendimento_atual = atendimento["ID_ATENDIMENTO"]

        with self.repository.transacao():
            atendimento_finalizado = self.repository.finalizar_atendimento(
                id_atendimento=id_atendimento_atual,
                nome_operador_fim=nome_solicitante,
                data_fim=agora,
                motivo="TRANSFERENCIA"
            )

            if not atendimento_finalizado:
                raise PermissionError("O atendimento foi alterado por outro processo.")

            # 6) Criar novo atendimento
            novo_id_atendimento = self.repository.criar_atendimento(
                id_conversa=id_conversa,
                nome_operador_inicio=nome_destino,
                data_inicio=agora
            )

            # 7) Reatribuir conversa
            conversa_reatribuida = self.repository.reatribuir_atendimento(
                id_conversa=id_conversa,
                cpf_operador=cpf_destino,
                nome_operador=nome_destino,
                data_evento=agora
            )

            if not conversa_reatribuida:
                raise PermissionError("A conversa foi alterada por outro processo.")

            # 8) Evento
            self.repository.inserir_evento(
                tipo_evento=TIPO_EVENTO_CONVERSA_TRANSFERIDA,
                id_conversa=id_conversa,
                id_atendimento=novo_id_atendimento,
                numero_empresa=numero_empresa,
                numero_cliente=numero_cliente,
                cpf_operador=cpf_destino,
                nome_operador=nome_destino,
                payload={
                    "de": conversa["NOME_OPERADOR_ATUAL"],
                    "para": nome_destino,
                    "cpf_de": conversa["CPF_OPERADOR_ATUAL"],
                    "cpf_para": cpf_destino
                }
            )

        return {
            "ok": True,
            "id_conversa": id_conversa,
            "novo_operador": nome_destino
        }
