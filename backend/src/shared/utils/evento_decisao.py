import random

def get_evento_aleatorio():
    eventos_decisao = [
        # 🎧 AMBIENTE DO OPERADOR
        {
            "id": "colega_falando",
            "descricao": "Seu colega começa a falar alto sobre outro cliente ao lado.",
            "opcoes": [
                {"texto": "Ignorar e continuar a negociação", "efeito": {"humor_cliente": -5, "comentario": "Cliente ficou desconfortável com o barulho."}},
                {"texto": "Pedir licença e pedir silêncio ao colega", "efeito": {"humor_cliente": +3, "comentario": "Cliente percebeu profissionalismo."}},
                {"texto": "Avisar o cliente e pedir um instante", "efeito": {"humor_cliente": +5, "comentario": "Cliente sentiu empatia e compreensão."}},
            ]
        },
        {
            "id": "fone_desconecta",
            "descricao": "Seu fone de ouvido desconecta brevemente durante a conversa.",
            "opcoes": [
                {"texto": "Pedir desculpas e retomar a conversa rapidamente", "efeito": {"humor_cliente": +2, "comentario": "Cliente entendeu a situação."}},
                {"texto": "Fingir que nada aconteceu", "efeito": {"humor_cliente": -5, "comentario": "Cliente percebeu falha e achou descuido."}},
                {"texto": "Interromper e testar o som antes de voltar", "efeito": {"chance_acordo": -3, "comentario": "Cliente ficou esperando e perdeu ritmo."}},
            ]
        },
        {
            "id": "chefe_passando",
            "descricao": "O supervisor passa atrás observando discretamente sua ligação.",
            "opcoes": [
                {"texto": "Continuar normalmente", "efeito": {"chance_acordo": +1}},
                {"texto": "Ficar nervoso e mudar o tom de voz", "efeito": {"chance_acordo": -4}},
                {"texto": "Permanecer calmo e seguir com empatia", "efeito": {"chance_acordo": +3}},
            ]
        },
        {
            "id": "sistema_lento",
            "descricao": "O CollectSys está lento para carregar.",
            "opcoes": [
                {"texto": "Avisar o cliente e manter conversa leve", "efeito": {"humor_cliente": +5}},
                {"texto": "Ficar em silêncio aguardando", "efeito": {"humor_cliente": -8}},
                {"texto": "Reclamar do sistema para o cliente", "efeito": {"humor_cliente": -10}},
            ]
        },
       

        # 📞 CLIENTE DISTRAÍDO
        {
            "id": "cliente_recebe_ligacao",
            "descricao": "O cliente recebe uma ligação e pede pra você aguardar.",
            "opcoes": [
                {"texto": "Esperar em silêncio", "efeito": {"chance_acordo": -10}},
                {"texto": "Dizer que pode retornar depois", "efeito": {"chance_acordo": -5}},
                {"texto": "Manter contato com leveza e aguardar", "efeito": {"chance_acordo": +5}},
            ]
        },
        {
            "id": "crianca_chorando",
            "descricao": "Uma criança começa a chorar ao fundo durante a conversa.",
            "opcoes": [
                {"texto": "Ignorar e continuar o atendimento", "efeito": {"humor_cliente": -3}},
                {"texto": "Mostrar compreensão e dizer 'sem problemas'", "efeito": {"humor_cliente": +5}},
                {"texto": "Perguntar se prefere falar mais tarde", "efeito": {"chance_acordo": -5}},
            ]
        },
        {
            "id": "cliente_no_transito",
            "descricao": "O cliente diz que está dirigindo e não pode se concentrar.",
            "opcoes": [
                {"texto": "Pedir para retornar em outro momento", "efeito": {"chance_acordo": +5}},
                {"texto": "Insistir rapidamente antes que ele desligue", "efeito": {"chance_acordo": -5}},
                {"texto": "Encerrar educadamente e marcar retorno", "efeito": {"chance_acordo": +3}},
            ]
        },
        {
            "id": "barulho_na_linha",
            "descricao": "A linha está com ruído e o cliente não ouve bem.",
            "opcoes": [
                {"texto": "Repetir com paciência", "efeito": {"humor_cliente": +3}},
                {"texto": "Falar mais alto e rápido", "efeito": {"humor_cliente": -5}},
                {"texto": "Oferecer retornar em melhor horário", "efeito": {"chance_acordo": -2}},
            ]
        },

        # 💬 CLIMA EMOCIONAL
        {
            "id": "cliente_irritado",
            "descricao": "O cliente demonstra irritação logo no início da ligação.",
            "opcoes": [
                {"texto": "Manter a calma e ouvir o cliente", "efeito": {"humor_cliente": +6}},
                {"texto": "Responder de forma defensiva", "efeito": {"humor_cliente": -10}},
                {"texto": "Pedir desculpas e buscar resolver", "efeito": {"chance_acordo": +5}},
            ]
        },
        {
            "id": "cliente_emocional",
            "descricao": "O cliente se emociona ao falar sobre seus problemas financeiros.",
            "opcoes": [
                {"texto": "Demonstrar empatia e ouvir", "efeito": {"humor_cliente": +8}},
                {"texto": "Mudar de assunto rapidamente", "efeito": {"humor_cliente": -6}},
                {"texto": "Oferecer ajuda prática e calma", "efeito": {"chance_acordo": +5}},
            ]
        },
        {
            "id": "cliente_desconfiado",
            "descricao": "O cliente diz que não acredita na proposta e acha que é golpe.",
            "opcoes": [
                {"texto": "Explicar com clareza e segurança", "efeito": {"chance_acordo": +6}},
                {"texto": "Tentar insistir rapidamente", "efeito": {"chance_acordo": -8}},
            ]
        },
        {
            "id": "cliente_brinca",
            "descricao": "O cliente faz piadas sobre a dívida para aliviar o clima.",
            "opcoes": [
                {"texto": "Entrar no tom leve e sorrir", "efeito": {"humor_cliente": +4}},
                {"texto": "Ignorar e seguir o roteiro", "efeito": {"humor_cliente": -1}},
                {"texto": "Reforçar o assunto com leveza", "efeito": {"chance_acordo": +3}},
            ]
        },

        # 💻 PROBLEMAS TÉCNICOS
        {
            "id": "boletim_nao_abre",
            "descricao": "O boleto que você tenta gerar não está enviando pelo CollectSys.",
            "opcoes": [
                {"texto": "Avisar o cliente e tentar novamente", "efeito": {"chance_acordo": 0}},
                {"texto": "Culpar o sistema", "efeito": {"humor_cliente": -4}},
                {"texto": "Garantir que enviará assim que possível", "efeito": {"chance_acordo": +3}},
            ]
        },
        {
            "id": "microfone_com_eco",
            "descricao": "O cliente reclama que sua voz está com eco.",
            "opcoes": [
                {"texto": "Pedir um instante para ajustar", "efeito": {"humor_cliente": +1}},
                {"texto": "Fingir que não ouviu", "efeito": {"humor_cliente": -6}},
                {"texto": "Brincar de leve e continuar", "efeito": {"chance_acordo": 0}},
            ]
        },
        {
            "id": "sistema_cai",
            "descricao": "O sistema sai do ar e você não consegue prosseguir.",
            "opcoes": [
                {"texto": "Avisar o cliente com sinceridade e marcar retorno", "efeito": {"chance_acordo": +3}},
                {"texto": "Tentar enrolar até voltar", "efeito": {"chance_acordo": -5}},
                {"texto": "Encerrar abruptamente", "efeito": {"chance_acordo": -10}},
            ]
        },

        # 🕒 TEMPO E PRESSÃO
        {
            "id": "fim_expediente",
            "descricao": "Está quase na hora do fim do expediente, e você tem pouco tempo.",
            "opcoes": [
                {"texto": "Manter o foco e resolver rápido com qualidade", "efeito": {"chance_acordo": +4}},
                {"texto": "Apressar a conversa", "efeito": {"humor_cliente": -3}},
                {"texto": "Encerrar e prometer retorno", "efeito": {"chance_acordo": -2}},
            ]
        },
        {
            "id": "meta_do_dia",
            "descricao": "Você está a um acordo de bater a meta diária.",
            "opcoes": [
                {"texto": "Focar na qualidade da conversa", "efeito": {"chance_acordo": +4}},
                {"texto": "Forçar o fechamento", "efeito": {"chance_acordo": -5}},
                {"texto": "Usar empolgação positiva", "efeito": {"chance_acordo": +2}},
            ]
        },

        # ❤️ EMPATIA E CONEXÃO
        {
            "id": "cliente_elogia",
            "descricao": "O cliente elogia sua paciência e educação.",
            "opcoes": [
                {"texto": "Agradecer e seguir com leveza", "efeito": {"humor_cliente": +6}},
                {"texto": "Ignorar o elogio e continuar", "efeito": {"humor_cliente": -2}},
                {"texto": "Ficar envergonhado e mudar de assunto", "efeito": {"chance_acordo": 0}},
            ]
        },
        {
            "id": "cliente_reconhece_voce",
            "descricao": "O cliente diz que já falou com você antes e gostou do atendimento.",
            "opcoes": [
                {"texto": "Agradecer e retomar o contato com empatia", "efeito": {"chance_acordo": +8}},
                {"texto": "Tratar como se fosse a primeira vez", "efeito": {"chance_acordo": -3}},
                {"texto": "Brincar de leve com a coincidência", "efeito": {"humor_cliente": +3}},
            ]
        },
        {
            "id": "cliente_em_dia",
            "descricao": "O cliente diz que já quitou a dívida recentemente.",
            "opcoes": [
                {"texto": "Checar calmamente no sistema", "efeito": {"chance_acordo": 0}},
                {"texto": "Duvidar da informação", "efeito": {"humor_cliente": -6}},
                {"texto": "Pedir comprovante com cordialidade", "efeito": {"humor_cliente": +3}},
            ]
        },

        # 🏠 CENAS COTIDIANAS
        {
            "id": "porteiro_interrompe",
            "descricao": "O porteiro chama o cliente no interfone durante a conversa.",
            "opcoes": [
                {"texto": "Esperar e retomar o diálogo", "efeito": {"chance_acordo": 0}},
                {"texto": "Encerrar e remarcar", "efeito": {"chance_acordo": -2}},
                {"texto": "Brincar com leveza e aguardar", "efeito": {"humor_cliente": +3}},
            ]
        },
        {
            "id": "cachorro_latindo",
            "descricao": "Um cachorro começa a latir alto durante a ligação.",
            "opcoes": [
                {"texto": "Rir e manter leveza", "efeito": {"humor_cliente": +4}},
                {"texto": "Ignorar o barulho", "efeito": {"humor_cliente": -1}},
                {"texto": "Sugerir retomar em outro momento", "efeito": {"chance_acordo": +2}},
            ]
        },
        {
            "id": "cliente_cozinhando",
            "descricao": "O cliente diz que está cozinhando e pede pra ser rápido.",
            "opcoes": [
                {"texto": "Resumir de forma clara e objetiva", "efeito": {"chance_acordo": +5}},
                {"texto": "Manter o mesmo ritmo", "efeito": {"chance_acordo": -3}},
                {"texto": "Sugerir remarcar", "efeito": {"chance_acordo": -2}},
            ]
        },
        {
            "id": "cliente_no_mercado",
            "descricao": "O cliente diz que está no vega do mercado.",
            "opcoes": [
                {"texto": "Aguardar com paciência", "efeito": {"chance_acordo": 5}},
                {"texto": "Encerrar a ligação", "efeito": {"chance_acordo": -3}},
                {"texto": "Forçar fechamento rápido", "efeito": {"chance_acordo": -5}},
            ]
        },
    ]

    if random.random() < 0.15:  
        return random.choice(eventos_decisao)
    return None