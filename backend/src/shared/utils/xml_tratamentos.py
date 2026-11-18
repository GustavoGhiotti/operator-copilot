def extrair_tag(conteudo:str, inicio_tag:str, fim_tag:str) -> str:
    inicio = conteudo.find(inicio_tag) + len(inicio_tag)
    fim = conteudo.find(fim_tag, inicio)
    return conteudo[inicio:fim] if inicio > -1 and fim > -1 else None

def extrair_array(conteudo:str, inicio_tag:str, fim_tag:str) -> str:
    inicio = conteudo.find(inicio_tag)
    fim = conteudo.find(fim_tag, inicio) + len(fim_tag)
    return conteudo[inicio:fim] if inicio > -1 and fim > -1 else None
