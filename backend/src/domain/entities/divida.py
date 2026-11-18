from dataclasses import dataclass
from src.shared.utils.xml_tratamentos import *
from typing import Optional
from datetime import date

@dataclass
class Divida:
    nome_cedente:str
    id_cedente:int
    id_cliente:int
    id_contrato:int
    numero_prestacao:int
    atraso:int
    xml:str

    data_pagamento: Optional[date] = None
    valor: float = 0
    valor_parcelas: float = 0
    parcelamento_max: int = 99
    qtd_parcelas: int = 1

    def atualizar_valores(self, valor:float, valor_parcelas:float, parcelamento_max:int, parcelas:int) -> None:
        self.valor = valor
        self.valor_parcelas = valor_parcelas
        self.parcelamento_max = parcelamento_max
        self.qtd_parcelas = parcelas

    def atualizar_data(self, data:date):
        self.data_pagamento = data

    def atualizar_xml(self, new_xml:str) -> None:
        xml_old = extrair_tag(self.xml, "<ArrayOfDividaAtiva>", "</ArrayOfDividaAtiva>")
        self.xml =  f"<ArrayOfDividaAtiva>{xml_old + new_xml}</ArrayOfDividaAtiva>"

    def parcelamento_div2(self)-> None:
        self.qtd_parcelas = int(self.parcelamento_max / 2) 

    def parcelamento_div4(self)-> None:
        self.qtd_parcelas = int(self.parcelamento_max / 4)