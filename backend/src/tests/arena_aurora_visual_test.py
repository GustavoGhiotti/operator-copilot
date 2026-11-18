"""Colecao e compatibilidade dos presets completos da Aurora."""
import json
import unittest

from src.application.services.arena_service import ArenaService


def item(codigo, slot="SUPERIOR", xp=0, adquirido=False, equipado=False,
         conjunto=None, filtro=None, chave=None, raridade="COMUM"):
    return {
        "id": abs(hash(codigo)) % 10000,
        "codigo": codigo,
        "nome": codigo.title(),
        "descricao": None,
        "slot": slot,
        "raridade": raridade,
        "preco_coins": 100,
        "xp_necessario": xp,
        "chave_visual": chave or codigo.lower(),
        "filtro_cor": filtro,
        "codigo_conjunto": conjunto,
        "nome_conjunto": None if not conjunto else f"Linha {conjunto.title()}",
        "adquirido": adquirido,
        "adquirido_em": None,
        "equipado": equipado,
        "desbloqueado": True,
        "pode_comprar": False,
    }


class ColecaoTest(unittest.TestCase):
    def test_conta_o_que_ja_e_do_operador(self):
        resumo = ArenaService._resumo_colecao(
            [item("A", adquirido=True), item("B"), item("C", adquirido=True)],
            xp_total=500,
        )

        self.assertEqual(resumo["total"], 3)
        self.assertEqual(resumo["adquiridos"], 2)

    def test_proximo_desbloqueio_e_o_mais_barato_em_xp(self):
        """O objetivo tem que ser o alcançável, não o mais caro."""
        itens = [
            {**item("LONGE", xp=3000), "desbloqueado": False},
            {**item("PERTO", xp=1000), "desbloqueado": False},
            {**item("JATENHO", xp=100), "desbloqueado": True},
        ]

        resumo = ArenaService._resumo_colecao(itens, xp_total=275)

        self.assertEqual(resumo["proximo_desbloqueio"]["codigo"], "PERTO")
        self.assertEqual(resumo["proximo_desbloqueio"]["xp_faltando"], 725)

    def test_sem_bloqueados_nao_ha_proximo(self):
        resumo = ArenaService._resumo_colecao(
            [item("A", adquirido=True)], xp_total=9999,
        )

        self.assertIsNone(resumo["proximo_desbloqueio"])

    def test_xp_faltando_nunca_e_negativo(self):
        itens = [{**item("X", xp=100), "desbloqueado": False}]

        resumo = ArenaService._resumo_colecao(itens, xp_total=500)

        self.assertEqual(resumo["proximo_desbloqueio"]["xp_faltando"], 0)


class ConjuntosTest(unittest.TestCase):
    def test_conjunto_incompleto_nao_conta(self):
        resumo = ArenaService._resumo_conjuntos([
            item("A", conjunto="PULSE", adquirido=True),
            item("B", conjunto="PULSE"),
        ])

        self.assertEqual(len(resumo), 1)
        self.assertFalse(resumo[0]["completo"])
        self.assertEqual(resumo[0]["adquiridos"], 1)

    def test_conjunto_completo_com_todas_as_pecas(self):
        resumo = ArenaService._resumo_conjuntos([
            item("A", conjunto="PULSE", adquirido=True),
            item("B", conjunto="PULSE", adquirido=True),
        ])

        self.assertTrue(resumo[0]["completo"])

    def test_ter_as_pecas_nao_e_o_mesmo_que_vestir(self):
        """O bônus é do look montado, não do inventário."""
        resumo = ArenaService._resumo_conjuntos([
            item("A", conjunto="PULSE", adquirido=True, equipado=True),
            item("B", conjunto="PULSE", adquirido=True),
        ])

        self.assertTrue(resumo[0]["completo"])
        self.assertFalse(resumo[0]["ativo"])

    def test_conjunto_ativo_com_tudo_vestido(self):
        resumo = ArenaService._resumo_conjuntos([
            item("A", conjunto="PULSE", adquirido=True, equipado=True),
            item("B", conjunto="PULSE", adquirido=True, equipado=True),
        ])

        self.assertTrue(resumo[0]["ativo"])

    def test_item_sem_conjunto_e_ignorado(self):
        resumo = ArenaService._resumo_conjuntos([
            item("SOLTO"), item("A", conjunto="PULSE"),
        ])

        self.assertEqual([g["codigo"] for g in resumo], ["PULSE"])


class PresetCompletoTest(unittest.TestCase):
    def test_catalogo_publica_exatamente_os_50_novos_presets(self):
        codigos = {
            codigo
            for codigo in ArenaService.AURORA_PRESET_CODES
            if codigo.startswith("AURORA_LOOK_")
        }
        chaves = {
            chave
            for chave in ArenaService.AURORA_PRESET_KEYS
            if chave.startswith("look-")
        }

        self.assertEqual(len(codigos), 50)
        self.assertEqual(len(chaves), 50)
        self.assertIn("AURORA_LOOK_01", codigos)
        self.assertIn("AURORA_LOOK_50", codigos)
        self.assertIn("look-01", chaves)
        self.assertIn("look-50", chaves)

    def test_estado_legado_escolhe_um_unico_visual_corporal(self):
        participante = {
            "visual_json": json.dumps([
                {
                    "slot": "SUPERIOR",
                    "chave": "jaqueta-lunar",
                    "filtro": None,
                },
                {
                    "slot": "OCULOS",
                    "chave": "oculos-pulse",
                    "filtro": None,
                },
                {"slot": "AURA", "chave": "aura-pulso", "filtro": None},
            ]),
        }

        visual = ArenaService._visual_do_participante(participante)

        self.assertEqual(visual["equipado"]["VISUAL"], "jaqueta-lunar")
        self.assertEqual(visual["equipado"]["AURA"], "aura-pulso")
        self.assertEqual(visual["filtros"], {})

    def test_variante_por_filtro_nao_volta_para_o_avatar(self):
        participante = {
            "visual_json": json.dumps([
                {
                    "slot": "CABECA",
                    "chave": "bone-arena",
                    "filtro": "hue-rotate(165deg)",
                },
            ]),
        }

        visual = ArenaService._visual_do_participante(participante)

        self.assertNotIn("VISUAL", visual["equipado"])


if __name__ == "__main__":
    unittest.main()
