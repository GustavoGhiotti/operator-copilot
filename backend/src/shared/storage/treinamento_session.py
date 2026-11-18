from collections import defaultdict

clientes_sessao = defaultdict(dict)

def get_cliente(operador: str):
    return clientes_sessao.get(operador)

def set_cliente(operador: str,cliente: dict):
    clientes_sessao[operador] = cliente

def clear_cliente(operador: str):
    clientes_sessao.pop(operador,None)
