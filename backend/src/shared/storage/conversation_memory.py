from collections import defaultdict

conversation_histories = defaultdict(list)

MAX_MESSAGES = 20


def get_history(operador: str):
    return conversation_histories.get(operador,[])


def append_user_message(operador: str,mensagem: str):
    conversation_histories[operador].append({"role":"user","content":mensagem})
    _limitar_historico(operador)


def append_assistant_message(operador: str,mensagem: str):
    conversation_histories[operador].append({"role":"assistant","content":mensagem})
    _limitar_historico(operador)


def clear_history(operador: str):
    conversation_histories.pop(operador,None)


def _limitar_historico(operador: str):
    if len(conversation_histories[operador]) > MAX_MESSAGES:
        conversation_histories[operador] = conversation_histories[operador][-MAX_MESSAGES:]
