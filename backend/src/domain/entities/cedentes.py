class Mu:
    def grupo(contrato:int):
        nr_divida_cedente = int(contrato[0:3])

        match nr_divida_cedente:
            case 100:
                nome_cedente = "Eta"
            case 700:
                nome_cedente = "XiClub"
            case _:
                nome_cedente = "Mu"

        return nome_cedente
    