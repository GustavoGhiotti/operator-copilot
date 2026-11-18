from datetime import datetime

class ListarDashboardCarteiraUseCase:
    def __init__(self, repository, sla_minutos: int = 5):
        self.repository = repository
        self.sla_minutos = sla_minutos

    def executar(self, cpf_usuario: str):

        # Validar usuário
        centro_custo = self.repository.obter_centro_custo_por_cpf(cpf_usuario)
        if not centro_custo:
            raise PermissionError("Usuário não encontrado ou inativo")

        carteira = self.repository.obter_carteira_por_centro_custo(
            centro_custo,
            somente_whatsapp=False
        )
        if not carteira:
            raise PermissionError("Carteira não habilitada para Whatsapp")

        # Buscar todas conversas da carteira
        conversas = self.repository.listar_conversas_por_carteira(
            carteira=carteira,
            tipo_visao="TODAS"
        )

        agora = datetime.utcnow()

        total_abertas = 0
        total_em_atendimento = 0
        total_fora_sla = 0

        operadores = {}

        for c in conversas:

            status = c["STATUS_CONVERSA"]

            if status == "ABERTA":
                total_abertas += 1

            elif status == "EM_ATENDIMENTO":
                total_em_atendimento += 1

                # SLA
                if c["DIRECAO_ULTIMA_MENSAGEM"] == "RECEBIDA":
                    diff = (agora - c["DATA_ULTIMA_MENSAGEM"]).total_seconds() / 60

                    if diff > self.sla_minutos:
                        total_fora_sla += 1

                        nome_op = c.get("NOME_OPERADOR_ATUAL") or "SEM_OPERADOR"

                        if nome_op not in operadores:
                            operadores[nome_op] = {
                                "EM_ATENDIMENTO": 0,
                                "FORA_SLA": 0
                            }

                        operadores[nome_op]["FORA_SLA"] += 1

                nome_op = c.get("NOME_OPERADOR_ATUAL") or "SEM_OPERADOR"

                if nome_op not in operadores:
                    operadores[nome_op] = {
                        "EM_ATENDIMENTO": 0,
                        "FORA_SLA": 0
                    }

                operadores[nome_op]["EM_ATENDIMENTO"] += 1

        # Transformar dict em lista ordenada
        ranking_operadores = [
            {
                "NOME_OPERADOR": nome,
                "EM_ATENDIMENTO": dados["EM_ATENDIMENTO"],
                "FORA_SLA": dados["FORA_SLA"]
            }
            for nome, dados in operadores.items()
        ]

        ranking_operadores.sort(
            key=lambda x: (x["FORA_SLA"], x["EM_ATENDIMENTO"]),
            reverse=True
        )

        return {
            "CARTEIRA": carteira,
            "TOTAL_ABERTAS": total_abertas,
            "TOTAL_EM_ATENDIMENTO": total_em_atendimento,
            "TOTAL_FORA_SLA": total_fora_sla,
            "OPERADORES": ranking_operadores
        }
