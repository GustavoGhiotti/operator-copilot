import random

# 🔹 Listas base para geração de nomes aleatórios
NOMES_PRIMEIROS = [
    "Carlos", "Ana", "João", "Marina", "José", "Paula", "Roberto", "Luciana",
    "Fernanda", "Pedro", "Cláudia", "Eduardo", "Rogério", "Patrícia",
    "Tiago", "Gabriela", "Anderson", "Rafaela", "Juliana", "Leandro",
    "Fábio", "Sueli", "Simone", "Marcos", "Vitória", "André", "Natália",
    "Ronaldo", "Beatriz", "Paulo", "Denise", "Gustavo", "Helena"
]

SOBRENOMES = [
    "Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Costa",
    "Gomes", "Ribeiro", "Martins", "Carvalho", "Araújo", "Fernandes",
    "Rodrigues", "Almeida", "Barbosa", "Teixeira", "Moraes", "Castro",
    "Vieira", "Mendes", "Cavalcante", "Dias", "Freitas", "Correia",
    "Batista", "Campos", "Duarte", "Cardoso"
]


def gerar_nome_aleatorio():
    """Gera um nome aleatório plausível."""
    return f"{random.choice(NOMES_PRIMEIROS)} {random.choice(SOBRENOMES)}"

print(gerar_nome_aleatorio)


# 🔹 Perfis base de cliente com mais profundidade
PERFIS_CLIENTE = [
    {
        "tipo": "emocional",
        "descricao": "Reage com emoção e desespero. Usa frases como 'pelo amor de Deus' e 'tô desesperado'. Fica abalado facilmente, mas pode ceder se sentir empatia.",
        "tom": "dramático e vulnerável",
        "humor_inicial": "nervoso",
        "dificuldade": 2,
    },
    {
        "tipo": "frio",
        "descricao": "Fala curto e direto. Quer apenas números e clareza. Não se importa com empatia, só com o valor final.",
        "tom": "racional e distante",
        "humor_inicial": "neutro",
        "dificuldade": 3,
    },
    {
        "tipo": "mentiroso",
        "descricao": "Cria desculpas para evitar compromisso. Usa frases como 'já paguei' ou 'vou ver com meu marido'.",
        "tom": "evasivo e enrolador",
        "humor_inicial": "defensivo",
        "dificuldade": 4,
    },
    {
        "tipo": "irritado",
        "descricao": "Começa o diálogo exaltado e agressivo. Reclama de tudo, mas pode se acalmar se o operador for paciente e educado.",
        "tom": "agressivo e impaciente",
        "humor_inicial": "irritado",
        "dificuldade": 5,
    },
    {
        "tipo": "gentil",
        "descricao": "Educado e colaborativo. Quer resolver o problema, tende a aceitar propostas justas rapidamente.",
        "tom": "cordial e prestativo",
        "humor_inicial": "tranquilo",
        "dificuldade": 1,
    },
    {
        "tipo": "idoso",
        "descricao": "Tem dificuldade com tecnologia e memória. É educado, mas se confunde com termos técnicos e precisa de paciência.",
        "tom": "calmo e inseguro",
        "humor_inicial": "neutro",
        "dificuldade": 4,
    },
    {
        "tipo": "apressado",
        "descricao": "Quer resolver tudo rápido. Se o operador enrolar, ele se irrita. Se for objetivo, fecha o acordo logo.",
        "tom": "impaciente, prático",
        "humor_inicial": "neutro",
        "dificuldade": 3,
    },
    {
        "tipo": "arrogante",
        "descricao": "Acha que está acima das regras. Usa frases como 'vocês precisam de mim' ou 'sei meus direitos'.",
        "tom": "prepotente e exigente",
        "humor_inicial": "irritado",
        "dificuldade": 5,
    },
    {
        "tipo": "desinformado",
        "descricao": "Não entende direito sua dívida, confunde valores e prazos. Precisa de paciência e explicação detalhada.",
        "tom": "confuso e inseguro",
        "humor_inicial": "neutro",
        "dificuldade": 2,
    },
    {
        "tipo": "cansado",
        "descricao": "Já negociou várias vezes, acha que nunca muda. Se o operador for diferente, pode se surpreender e aceitar.",
        "tom": "desmotivado e descrente",
        "humor_inicial": "defensivo",
        "dificuldade": 3,
    },
]


# 🔹 Evolução emocional (como o humor muda conforme o tom do operador)
EVOLUCAO_HUMOR = {
    "tranquilo": {
        "empático": "tranquilo",
        "neutro": "neutro",
        "rude": "irritado",
        "impaciente": "defensivo",
    },
    "irritado": {
        "empático": "neutro",
        "neutro": "irritado",
        "rude": "furioso",
        "impaciente": "furioso",
    },
    "defensivo": {
        "empático": "neutro",
        "neutro": "defensivo",
        "rude": "irritado",
        "impaciente": "irritado",
    },
    "nervoso": {
        "empático": "tranquilo",
        "neutro": "nervoso",
        "rude": "desesperado",
        "impaciente": "desesperado",
    },
    "neutro": {
        "empático": "tranquilo",
        "neutro": "neutro",
        "rude": "defensivo",
        "impaciente": "defensivo",
    },
    "furioso": {
        "empático": "irritado",
        "neutro": "furioso",
        "rude": "furioso",
        "impaciente": "furioso",
    },
}


# 🔹 Funções utilitárias
def escolher_perfil_cliente():
    """Escolhe um perfil aleatório e adiciona um nome fictício."""
    perfil = random.choice(PERFIS_CLIENTE)
    perfil["nome"] = gerar_nome_aleatorio()
    return perfil


def ajustar_humor_atual(humor_atual: str, tom_operador: str) -> str:
    """Ajusta o humor do cliente com base no tom do operador."""
    humor_atual = humor_atual.lower().strip()
    tom_operador = tom_operador.lower().strip()

    if humor_atual not in EVOLUCAO_HUMOR:
        return humor_atual
    if tom_operador not in EVOLUCAO_HUMOR[humor_atual]:
        return humor_atual

    return EVOLUCAO_HUMOR[humor_atual][tom_operador]