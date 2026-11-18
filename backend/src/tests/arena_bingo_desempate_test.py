"""Janela de disputa do Bingo e desempate por pedra maior.

O caso que originou isto: dois operadores esperando o mesmo numero: o numero
chegava antes para um por diferenca de rede, ele cantava primeiro e o outro
recebia erro ao clicar. A rede decidia o jogo.
"""
import unittest

from src.application.services.arena_service import (
    ArenaServiceError,
    ArenaSupervisorService,
)


class BingoRepositoryFake:
    def __init__(self, empatados=2, ja_sorteado=False, restantes=None):
        self.empatados = empatados
        self.ja_sorteado = ja_sorteado
        # Por padrao sobram varias pedras; os testes de escassez passam a lista.
        self.restantes = restantes if restantes is not None else list(
            range(1, 76)
        )
        self.fechamentos = []
        self.sorteios = []

    def obter_usuario(self, cpf):
        return {
            "cpf": cpf,
            "nome": "BEATRIZ LIMA SANTOS",
            "funcao": "SUPERVISOR(A) DE OPERACOES I",
            "centro_custo": "VEGA",
        }

    def fechar_janela_bingo(self, id_sessao, janela_segundos=3):
        self.fechamentos.append((id_sessao, janela_segundos))
        return {"fechada": True, "empatados": self.empatados}

    def sortear_desempate(self, id_sessao, cpf):
        if self.ja_sorteado:
            raise ValueError("DESEMPATE_JA_SORTEADO")
        if self.empatados < 2:
            raise ValueError("SEM_EMPATE")
        if len(self.restantes) < self.empatados:
            raise ValueError("PEDRAS_INSUFICIENTES")

        import random

        pedras = random.sample(self.restantes, self.empatados)
        resultado = [
            {
                "id_vitoria": indice,
                "id_participante": indice,
                "nome": f"Jogador {indice}",
                "pedra": pedra,
            }
            for indice, pedra in enumerate(pedras, start=1)
        ]
        resultado.sort(key=lambda item: item["pedra"], reverse=True)
        for posicao, item in enumerate(resultado, start=1):
            item["posicao"] = posicao
        self.sorteios.append(id_sessao)
        return resultado


class BingoDesempateTest(unittest.TestCase):
    def _servico(self, **kwargs):
        servico = ArenaSupervisorService()
        servico.repo = BingoRepositoryFake(**kwargs)
        return servico, servico.repo

    def test_janela_de_tres_segundos(self):
        """O valor cobre a variação de entrega medida no cliente."""
        self.assertEqual(ArenaSupervisorService.JANELA_DISPUTA_SEGUNDOS, 3)

    def test_fechar_janela_usa_a_constante(self):
        servico, repo = self._servico()

        servico.fechar_janela_bingo(77)

        self.assertEqual(repo.fechamentos, [(77, 3)])

    def test_desempate_ordena_pela_maior_pedra(self):
        servico, _ = self._servico(empatados=2)

        resultado = servico.sortear_desempate_bingo("123", 77)["desempate"]

        self.assertEqual(len(resultado), 2)
        self.assertGreater(resultado[0]["pedra"], resultado[1]["pedra"])
        self.assertEqual(resultado[0]["posicao"], 1)
        self.assertEqual(resultado[1]["posicao"], 2)

    def test_pedras_sorteadas_sao_distintas(self):
        """Sem reposição: um desempate que empata seria inútil."""
        servico, _ = self._servico(empatados=4)

        resultado = servico.sortear_desempate_bingo("123", 77)["desempate"]

        pedras = [item["pedra"] for item in resultado]
        self.assertEqual(len(pedras), len(set(pedras)))

    def test_pedra_nunca_repete_numero_ja_sorteado(self):
        # Só o 70 e o 71 sobraram; tudo abaixo já saiu na partida.
        servico, _ = self._servico(empatados=2, restantes=[70, 71])

        resultado = servico.sortear_desempate_bingo("123", 77)["desempate"]

        for item in resultado:
            self.assertIn(item["pedra"], (70, 71))

    def test_recusa_segundo_sorteio(self):
        """Sortear de novo até sair o nome preferido quebraria a confiança."""
        servico, repo = self._servico(ja_sorteado=True)

        with self.assertRaises(ArenaServiceError) as caso:
            servico.sortear_desempate_bingo("123", 77)

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.sorteios, [])

    def test_recusa_desempate_sem_empate(self):
        servico, repo = self._servico(empatados=1)

        with self.assertRaises(ArenaServiceError) as caso:
            servico.sortear_desempate_bingo("123", 77)

        self.assertEqual(caso.exception.status, 409)
        self.assertEqual(repo.sorteios, [])

    def test_recusa_quando_faltam_pedras(self):
        servico, _ = self._servico(empatados=3, restantes=[10, 20])

        with self.assertRaises(ArenaServiceError) as caso:
            servico.sortear_desempate_bingo("123", 77)

        self.assertEqual(caso.exception.status, 409)

    def test_operador_nao_sorteia_desempate(self):
        servico, repo = self._servico()
        servico.repo.obter_usuario = lambda cpf: {
            "cpf": cpf,
            "nome": "Operador",
            "funcao": "OPERADOR(A) COBRADOR(A)",
            "centro_custo": "VEGA",
        }

        with self.assertRaises(ArenaServiceError) as caso:
            servico.sortear_desempate_bingo("123", 77)

        self.assertEqual(caso.exception.status, 403)
        self.assertEqual(repo.sorteios, [])


if __name__ == "__main__":
    unittest.main()
