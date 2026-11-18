from .acordo import Acordo
from .divida import Divida
from src.infrastructure.services.utils import *
import re

class Contrato:
    def __init__(self, xml:str, nome_cedente:str, id_cedente:int, id_cliente:int):
        self.xml = xml
        self.nome_cedente = nome_cedente
        self.id_cedente = id_cedente
        self.id_cliente = id_cliente

    def acordo(self, numero_prestacao:int) -> Acordo:

        def obter_fatura_acordo():
            while "<Fatura>" in self.xml:
                array_fatura = extrair_array(self.xml, "<Fatura>", "</Fatura>")
                parcela = int(extrair_tag(array_fatura, '<Parcela>','</Parcela>'))

                if parcela == numero_prestacao:
                    valor_boleto = float(extrair_tag(array_fatura, '<ValorParcela>', '</ValorParcela>'))
                    vencimento_boleto =  re.sub(r'T.*', '', extrair_tag(array_fatura,'<DataParcela>', '</DataParcela>'))
                    
                    atraso = int(extrair_tag(array_fatura, '<Atraso>', '</Atraso>') or 0)
                    situacao = 'vencido' if atraso > 0 else 'vigente'

                    return valor_boleto, vencimento_boleto, situacao

                self.xml = self.xml.replace(array_fatura, "")

        self.nome_cedente = self.mu() if self.id_cedente == 3 else self.nome_cedente

        id_acordo = int(extrair_tag(self.xml, '<IdAcordo>', '</IdAcordo>'))
        id_contrato = int(extrair_tag(self.xml, '<IdContrato>', '</IdContrato>'))
        
        valor_boleto, vencimento_boleto, situacao = obter_fatura_acordo()

        return  Acordo(id_cedente=self.id_cedente,
                      nome_cedente=self.nome_cedente,
                      id_cliente=self.id_cliente,
                      id_acordo=id_acordo,
                      id_contrato=id_contrato, 
                      valor=valor_boleto,
                      numero_parcelas=numero_prestacao,
                      vencimento_boleto=vencimento_boleto,
                      situacao_acordo=situacao,
                      xml=self.xml
                    )

    def divida(self) -> Divida:
        self.nome_cedente = self.mu() if self.id_cedente == 3 else self.nome_cedente
        id_contrato = int(extrair_tag(self.xml, '<IdContrato>', '</IdContrato>'))
        prestacao = int(extrair_tag(self.xml, '<NumeroPrestacao>', '</NumeroPrestacao>'))
        atraso = int(extrair_tag(self.xml, '<Atraso>', '</Atraso>'))

        xml = f"<ArrayOfDividaAtiva>{self.xml}</ArrayOfDividaAtiva>" 

        return Divida(nome_cedente=self.nome_cedente,
                      id_cedente=self.id_cedente,
                      id_cliente=self.id_cliente,
                      id_contrato=id_contrato,
                      numero_prestacao=prestacao,
                      atraso=atraso,
                      xml=xml
                    )
    


    def mu(self) -> str:
        divida_cedente = str(extrair_tag(self.xml, "<DividaCedente>", "</DividaCedente>"))

        nr_divida_cedente = int(divida_cedente[0:3])

        match nr_divida_cedente:
            case 100:
                self.nome_cedente = "ETA"
            case 700:
                self.nome_cedente = "XICLUB"
            case _:
                self.nome_cedente = "MU"

        return self.nome_cedente