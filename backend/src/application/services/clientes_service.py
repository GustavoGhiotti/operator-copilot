from src.infrastructure.repositories.sql_clientes_repository import *
from datetime import datetime

class ClientesPendentesService:
    def executar(self, operador: str):
        resultado = ClientesPendentesRepository().buscar(operador)

        if not resultado:
            return None

        pendentes = []
        for row in resultado:
            nome, cpf, vencimento, valor, operador_nome = row

            pendentes.append({
                "nome": nome.strip().title() if nome else "",
                "cpf": cpf.strip() if cpf else "",
                "vencimento": vencimento.strftime('%d/%m/%Y') if vencimento else "",
                "valor": f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
                "operador": operador_nome.strip().upper() if operador_nome else "",
                "prioridade": "Alta",
                "status": "Pendente",
            })

        return pendentes
    

class ListaCombateService:
    def executar(self, usuario: str):
        resultado = ListaCombateRepository().buscar(usuario)

        if not resultado:
            return None

        colunas = [
            "CPF", "ID_CLIENTE", "NM_NOME", "CARTEIRA",
            "SEGMENTO", "RISCO", "DATA_ENTRADA", "FAIXA_CONTRATANTE",
            "CPC", "PROPENSAO", "TELEFONE_1", "LINK_WPP_TEL",
            "USUARIO", "OBS_USUARIO", "ULT_ATUALIZACAO",
            "PREVENTIVO", "QUEBRA"
        ]

        dados = []

        for linha in resultado:
            if not hasattr(linha, "__len__"):
                continue

            if len(linha) != len(colunas):
                continue

            registro = dict(zip(colunas, linha))

            # Normalizações leves (opcional, mas profissional)
            registro["NM_NOME"] = registro["NM_NOME"].strip().title() if registro.get("NM_NOME") else ""
            registro["USUARIO"] = registro["USUARIO"].strip().upper() if registro.get("USUARIO") else ""

            dados.append(registro)

        return dados

class AtualizarObservacaoService:
    def executar(self,id_cliente: int,carteira: str,comando: str,observacao: str) -> bool:

        repo = AtualizarObservacaoRepository()

        # 1️⃣ Atualiza observação
        atualizado = repo.atualizar_observacao(id_cliente=id_cliente,observacao=observacao)

        if not atualizado:
            return False

        # 2️⃣ Registra log da ação
        log_ok = repo.registrar_log(id_cliente=id_cliente,carteira=carteira,descricao=observacao,comando=comando,data=datetime.now())

        if not log_ok:
            return False

        return True


class AtualizarDescricaoService:
    def executar(self,id_cliente: int,descricao: str,comando: str,id_acordo: int,id_contrato: int,carteira: str) -> bool:
        repo = AtualizarDescricaoRepository()

        atualizado = repo.atualizar_descricao(id_cliente=id_cliente,descricao=descricao)
        if not atualizado:
            return False

        logado = repo.registrar_log(
            id_cliente=id_cliente,
            descricao=descricao,
            data=datetime.now(),
            id_acordo=id_acordo,
            id_contrato=id_contrato,
            carteira=carteira,
            comando=comando
        )

        return logado



