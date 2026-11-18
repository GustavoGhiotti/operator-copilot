from datetime import datetime, timezone
from src.infrastructure.clients.meta_whatsapp_client import MetaWhatsappClient
from .constantes_eventos import TIPO_EVENTO_MENSAGEM_ENVIADA
from .validacao_estado_operacional import (
    ConflitoOperacionalError,
    ConfiguracaoIntegracaoMetaError,
    RecursoNaoEncontradoError,
    validar_estado_conversa_atendimento,
)


class EnviarMensagemWhatsappUseCase:
    def __init__(self, repository, meta_client=None):
        self.repository = repository
        self.meta_client = meta_client or MetaWhatsappClient()

    def executar(self, payload: dict) -> dict:
        cpf_operador = payload["cpf_operador"]
        nome_operador = payload["nome_operador"]
        numero_cliente = payload["numero_cliente"]
        conteudo = payload["conteudo"]

        agora_utc = datetime.now(timezone.utc)

        conversa = self.repository.obter_conversa_por_cliente(numero_cliente)
        if not conversa:
            raise RecursoNaoEncontradoError(
                "Nao e possivel enviar mensagem sem conversa ativa.",
                "MONITORIA_CONVERSA_NAO_ENCONTRADA"
            )

        id_conversa = conversa["ID_CONVERSA"]
        atendimento_ativo = self.repository.obter_atendimento_ativo_por_conversa(
            id_conversa
        )
        validar_estado_conversa_atendimento(conversa, atendimento_ativo)

        if conversa["STATUS_CONVERSA"] != "EM_ATENDIMENTO":
            raise ConflitoOperacionalError(
                "A conversa nao esta em atendimento ativo.",
                "MONITORIA_CONVERSA_FORA_DE_ATENDIMENTO"
            )

        numero_empresa = conversa["NUMERO_EMPRESA"]

        if not atendimento_ativo:
            raise ConflitoOperacionalError(
                "Nao existe atendimento ativo para esta conversa.",
                "MONITORIA_ATENDIMENTO_ATIVO_AUSENTE"
            )

        if conversa["CPF_OPERADOR_ATUAL"] != cpf_operador:
            raise ConflitoOperacionalError(
                "Voce nao e o operador responsavel por este atendimento.",
                "MONITORIA_OPERADOR_NAO_RESPONSAVEL"
            )

        carteira_conversa = self.repository.obter_carteira_por_numero_empresa(
            numero_empresa
        )
        if not carteira_conversa:
            raise ConflitoOperacionalError(
                "Numero da empresa invalido ou inativo.",
                "MONITORIA_NUMERO_EMPRESA_INVALIDO"
            )

        numero_whatsapp = self.repository.obter_numero_whatsapp_por_numero_empresa(
            numero_empresa
        )
        if not numero_whatsapp:
            raise ConflitoOperacionalError(
                "Numero da empresa nao esta cadastrado para envio no WhatsApp.",
                "MONITORIA_NUMERO_EMPRESA_NAO_CADASTRADO"
            )

        phone_number_id_meta = (numero_whatsapp.get("PHONE_NUMBER_ID_META") or "").strip()
        if not phone_number_id_meta:
            raise ConfiguracaoIntegracaoMetaError(
                "PHONE_NUMBER_ID_META nao configurado para o numero da empresa."
            )

        resposta_meta = self.meta_client.enviar_texto(
            phone_number_id=phone_number_id_meta,
            numero_destino=numero_cliente,
            conteudo=conteudo,
        )
        id_mensagem_provedor = resposta_meta["id_mensagem_provedor"]

        with self.repository.transacao():
            self.repository.inserir_mensagem_enviada({
                "id_conversa": id_conversa,
                "id_mensagem_provedor": id_mensagem_provedor,
                "id_conta_whatsapp": phone_number_id_meta,
                "numero_origem": numero_empresa,
                "numero_destino": numero_cliente,
                "conteudo": conteudo,
                "cpf_operador": cpf_operador,
                "nome_operador": nome_operador,
                "data_evento": agora_utc
            })

            self.repository.atualizar_conversa_apos_envio(
                id_conversa=id_conversa,
                data_evento=agora_utc
            )

            self.repository.inserir_evento(
                tipo_evento=TIPO_EVENTO_MENSAGEM_ENVIADA,
                id_conversa=id_conversa,
                numero_empresa=numero_empresa,
                numero_cliente=numero_cliente,
                cpf_operador=cpf_operador,
                nome_operador=nome_operador,
                payload={
                    "direcao": "ENVIADA",
                    "conteudo": conteudo,
                    "id_mensagem_provedor": id_mensagem_provedor,
                }
            )

        return {
            "ok": True,
            "id_conversa": id_conversa,
            "id_mensagem_provedor": id_mensagem_provedor,
        }
