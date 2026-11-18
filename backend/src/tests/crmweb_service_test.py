from datetime import date

from src.application.services.crmweb_service import calcular_datas_d9


def test_calcular_datas_d9_usa_dias_corridos():
    assert calcular_datas_d9(date(2026, 8, 13)) == {
        "base": "2026-08-13",
        "d2": "2026-08-15",
        "d4": "2026-08-17",
        "d6": "2026-08-19",
        "d9": "2026-08-22",
    }


def test_calcular_datas_d9_pode_retornar_domingo():
    assert calcular_datas_d9(date(2026, 8, 14))["d2"] == "2026-08-16"


def test_calcular_datas_d9_soma_dias_corridos_a_partir_de_domingo():
    datas = calcular_datas_d9(date(2026, 8, 16))

    assert datas["base"] == "2026-08-16"
    assert datas["d2"] == "2026-08-18"


def test_calcular_datas_d9_sem_data_base_usa_a_data_atual():
    datas = calcular_datas_d9()

    assert len(datas) == 5
    assert list(datas) == ["base", "d2", "d4", "d6", "d9"]
