from sched import scheduler
import uuid
from flask import Blueprint, jsonify, request
from datetime import datetime
from flask_cors import cross_origin
from classes.AcoesBancoDados import AcaoBancoDados
import os




ip_servidor_66 = os.getenv('SERVIDOR_66')
banco_senha_66 = os.getenv('SENHA_BANCO_66')
banco_desenvolvimento = os.getenv('BANCO_DESENVOLVIMENTO')
banco_copilot = os.getenv('BANCO_COPILOT')

user_66 = os.getenv('USUARIO_66')



bp = Blueprint("natal_bd", __name__)




@bp.route("/natal/<cpf>/operador", methods=["GET"])
def get_operadores(cpf):
    query = f"""
        SELECT ID_OPERADOR, ID_CARTEIRA, NOME
        FROM TB_OPERADORES
        WHERE CPF = '{cpf}'
        ORDER BY NOME
    """
    try:
        banco = AcaoBancoDados(
            ip_servidor_66,
            banco_desenvolvimento,
            user_66,
            banco_senha_66,
            query
        )
        rows = banco.executa()

        data = [
            {
                "id_operador": row[0],
                "id_carteira": row[1],
                "nome": row[2].capitalize(),
            }
            for row in rows
        ]

        return jsonify(data), 200

    except Exception as e:
        return jsonify({"erro": f"Erro ao buscar operadores: {str(e)}"}), 500

    




# @bp.route("/natal/metas", methods=["GET"])
# def get_metas():
#     query = """
#         SELECT * 
#         FROM TB_METAS
#     """
#     try:
#         banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query)
#         rows = banco.executa()

#         data = [
#             {"id": row[0], "nome": row[1], "pontos": row[2], "carteiras":row[3]}
#             for row in rows
#         ]

#         return jsonify(data), 200

#     except Exception as e:
#         return jsonify({"erro": f"Erro ao buscar operadores: {str(e)}"}), 500
    




@bp.route("/carteira/<id_carteira>", methods=["PUT"])
def editar_carteira(id_carteira):
    try:
        dados = request.get_json()

        novo_nome = dados.get("nome_carteira")
        ativo = dados.get("ativo")

        if not novo_nome:
            return jsonify({"erro": "O campo 'nome_carteira' é obrigatório."}), 400

        query = f"""
            UPDATE TB_CARTEIRA
            SET 
                NOME_CARTEIRA = '{novo_nome}',
                ATIVO = {1 if ativo else 0}
            WHERE ID_CARTEIRA = '{id_carteira}'
        """

        banco = AcaoBancoDados(
            ip_servidor_66,
            banco_desenvolvimento,
            user_66,
            banco_senha_66,
            query
        )

        linhas = banco.executa()

        return jsonify({
            "mensagem": "Carteira atualizada com sucesso.",
            "id": id_carteira,
            "nome_carteira": novo_nome,
            "ativo": ativo
        }), 200

    except Exception as e:
        return jsonify({"erro": f"Erro ao atualizar carteira: {str(e)}"}), 500
    

@bp.route("/meta/<id_meta>", methods=["PUT"])
def editar_meta(id_meta):
    try:
        dados = request.get_json()

        nome_meta = dados.get("nome_meta")
        valor_meta = dados.get("valor_meta")
        ativo = dados.get("ativo")

        # validação mínima
        if not nome_meta:
            return jsonify({"erro": "O campo 'nome_meta' é obrigatório."}), 400
        
        if valor_meta is None:
            return jsonify({"erro": "O campo 'valor_meta' é obrigatório."}), 400

        # Atualização SQL
        query = f"""
            UPDATE TB_METAS
            SET
                NOME_META = '{nome_meta}',
                VALOR_META = {valor_meta},
                ATIVO = {1 if ativo else 0},
                DT_CRIACAO = DT_CRIACAO -- mantém a data original
            WHERE ID_META = '{id_meta}'
        """

        banco = AcaoBancoDados(
            ip_servidor_66,
            banco_desenvolvimento,
            user_66,
            banco_senha_66,
            query
        )

        banco.executa()

        return jsonify({
            "mensagem": "Meta atualizada com sucesso.",
            "id_meta": id_meta,
            "nome_meta": nome_meta,
            "valor_meta": valor_meta,
            "ativo": ativo
        }), 200

    except Exception as e:
        return jsonify({"erro": f"Erro ao atualizar meta: {str(e)}"}), 500
    

# @bp.route("/carteira/<id_carteira>/metas", methods=["GET"])
# def listar_metas_por_carteira(id_carteira):
#     try:
#         query = f"""
#             SELECT 
#                 ID_META,
#                 NOME_META,
#                 VALOR_META,
#                 ATIVO,
#                 DT_CRIACAO,
#                 FREQUENCIA
#             FROM TB_METAS
#             WHERE ID_CARTEIRA = '{id_carteira}'
#             ORDER BY NOME_META
#         """

#         banco = AcaoBancoDados(
#             ip_servidor_66,
#             banco_desenvolvimento,
#             user_66,
#             banco_senha_66,
#             query
#         )

#         rows = banco.executa()

#         metas = [
#             {
#                 "id_meta": row[0],
#                 "nome_meta": row[1],
#                 "valor_meta": row[2],
#                 "ativo": bool(row[3]),
#                 "dt_criacao": row[4].strftime("%Y-%m-%d %H:%M:%S") if row[4] else None,
#                 "frequencia": row[5]
#             }
#             for row in rows
#         ]

#         return jsonify({
#             "id_carteira": id_carteira,
#             "total_metas": len(metas),
#             "metas": metas
#         }), 200

#     except Exception as e:
#         return jsonify({"erro": f"Erro ao buscar metas: {str(e)}"}), 500
    
@bp.route("/operador/<cpf>/metas", methods=["GET"])
def metas_do_operador(cpf):
    try:
        # 1. Buscar o ID do operador via CPF
        query_op = f"""
            SELECT ID_OPERADOR
            FROM TB_OPERADORES
            WHERE CPF = '{cpf}'
        """

        banco_op = AcaoBancoDados(
            ip_servidor_66,
            banco_desenvolvimento,
            user_66,
            banco_senha_66,
            query_op
        )
        rows = banco_op.executa()

        if not rows:
            return jsonify({"erro": "Operador não encontrado"}), 404

        id_operador = rows[0][0]

        # 2. Buscar metas do operador, com JOIN apenas para pegar os detalhes da meta
        query_metas = f"""
            SELECT
                mo.ID_META_OPERADOR,   -- 0
                m.ID_META,             -- 1
                m.NOME_META,           -- 2
                m.VALOR_META,          -- 3
                mo.VALOR_ATINGIDO,     -- 4
                mo.CUMPRIU,            -- 5
                m.FREQUENCIA,          -- 6
                m.OBJETIVO,            -- 7
                mo.OBJETIVO,           -- 8
                mo.USADA_NO_SORTEIO    -- 9
            FROM TB_METAS_OPERADOR mo
            JOIN TB_METAS m ON m.ID_META = mo.ID_META
            WHERE mo.ID_OPERADOR = '{id_operador}'
        """

        banco_metas = AcaoBancoDados(
            ip_servidor_66,
            banco_desenvolvimento,
            user_66,
            banco_senha_66,
            query_metas
        )

        rows_metas = banco_metas.executa()

        # 3. Formato idêntico ao anterior
        metas = [
            {
                "id_meta_operador": row[0],
                "id_meta": row[1],
                "nome_meta": row[2],
                "valor_meta": row[3],
                "valor_atingido": row[4],
                "cumpriu": row[5],
                "frequencia": row[6],
                "Objetivo": row[7],
                "Objetivo_alcançado": row[8],
                "usada_no_sorteio": row[9]
            }
            for row in rows_metas
        ]

        return jsonify(metas), 200

    except Exception as e:
        return jsonify({"erro": f"Erro ao carregar metas do operador: {str(e)}"}), 500





# @bp.route("/operador/<cpf>/meta/<id_meta>/update", methods=["PUT"])
# def atualizar_progresso_por_cpf(cpf, id_meta):
#     try:
#         dados = request.get_json()
#         novo_valor = dados.get("valor_atingido")

#         if novo_valor is None:
#             return jsonify({"erro": "valor_atingido é obrigatório"}), 400

#         # Atualiza o progresso da meta baseada no CPF do operador
#         query = f"""
#             UPDATE mo
#             SET 
#                 VALOR_ATINGIDO = {novo_valor},
#                CUMPRIU = CASE 
#             WHEN {novo_valor} >= m.VALOR_META 
#                 THEN CUMPRIU + 1   
#             ELSE CUMPRIU
#           END,

#                 DT_ATUALIZACAO = GETDATE()
#             FROM TB_METAS_OPERADOR mo
#             JOIN TB_OPERADORES o
#                 ON o.ID_OPERADOR = mo.ID_OPERADOR
#             JOIN TB_METAS m
#                 ON m.ID_META = mo.ID_META
#             WHERE o.CPF = '{cpf}'
#               AND mo.ID_META = '{id_meta}'
#         """

#         banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query)
#         banco.executa()

#         return jsonify({"sucesso": True}), 200

#     except Exception as e:
#         return jsonify({"erro": str(e)}), 500
    


@bp.route("/carteira/<id_carteira>/ranking-metas", methods=["GET"])
def ranking_metas_por_carteira(id_carteira):
    try:
        query = f"""
           SELECT 
    o.ID_OPERADOR,
    o.NOME,
    o.CPF,
    c.NOME_CARTEIRA,

    (
        SELECT COUNT(*) 
        FROM OPENJSON(o.ESTADO_ARVORE, '$.ornaments')
    ) AS BOLINHAS,

    SUM(mo.OBJETIVO) AS OBJETIVO_TOTAL

FROM TB_OPERADORES o
JOIN TB_CARTEIRA c 
    ON c.ID_CARTEIRA = o.ID_CARTEIRA
JOIN TB_METAS_OPERADOR mo 
    ON mo.ID_OPERADOR = o.ID_OPERADOR

WHERE o.ID_CARTEIRA = '{id_carteira}'

GROUP BY 
    o.ID_OPERADOR,
    o.NOME,
    o.CPF,
    o.ESTADO_ARVORE,
    c.NOME_CARTEIRA

ORDER BY 
    BOLINHAS DESC,

    OBJETIVO_TOTAL DESC,

    o.NOME ASC;

        """

        banco = AcaoBancoDados(
            ip_servidor_66,
            banco_desenvolvimento,
            user_66,
            banco_senha_66,
            query
        )

        rows = banco.executa()

        ranking = [
            {
                "id_operador": row[0],
                "nome": row[1],
                "cpf": row[2],
                "carteira": row[3],
                "metas_concluidas": row[4]
            }
            for row in rows
        ]

        return jsonify(ranking), 200

    except Exception as e:
        print("Erro ranking:", e)
        return jsonify({"erro": str(e)}), 500
    

@bp.route("/operador/<cpf>/estado-metas", methods=["PUT"])
def salvar_estado_metas(cpf):
    try:
        dados = request.get_json()
        metas = dados.get("metas_concluidas_dia")
        uso = dados.get("uso_de_enfeites")

        if metas is None or uso is None:
            return jsonify({"erro": "metas_concluidas_dia e uso_de_enfeites são obrigatórios"}), 400

        query = f"""
            UPDATE TB_OPERADORES
            SET METAS_CONCLUIDAS_DIA = '{metas}',
                USO_DE_ENFEITES = '{uso}'
            WHERE CPF = '{cpf}'
        """

        banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query)
        banco.executa()

        return jsonify({"sucesso": True}), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@bp.route("/operador/<cpf>/estado-metas", methods=["GET"])
def obter_estado_metas(cpf):
    try:
        query = f"""
            SELECT METAS_CONCLUIDAS_DIA, USO_DE_ENFEITES
            FROM TB_OPERADORES
            WHERE CPF = '{cpf}'
        """

        banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query)
        rows = banco.executa()

        if not rows:
            return jsonify({
                "metas_concluidas_dia": None,
                "uso_de_enfeites": None
            }), 200

        return jsonify({
            "metas_concluidas_dia": rows[0][0],
            "uso_de_enfeites": rows[0][1]
        }), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500



@bp.route("/operador/<cpf>/estado-arvore", methods=["PUT"])
def salvar_estado_arvore(cpf):
    try:
        dados = request.get_json()
        estado = dados.get("estado_arvore")

        if estado is None:
            return jsonify({"erro": "estado_arvore é obrigatório"}), 400

        query = f"""
            UPDATE TB_OPERADORES
            SET ESTADO_ARVORE = '{estado}'
            WHERE CPF = '{cpf}'
        """

        banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query)
        banco.executa()

        return jsonify({"sucesso": True}), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@bp.route("/operador/<cpf>/estado-arvore", methods=["GET"])
def obter_estado_arvore(cpf):
    try:
        query = f"""
            SELECT ESTADO_ARVORE
            FROM TB_OPERADORES
            WHERE CPF = '{cpf}'
        """

        banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query)
        rows = banco.executa()

        if not rows:
            return jsonify({"estado_arvore": None}), 200

        return jsonify({"estado_arvore": rows[0][0]}), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500






@bp.route("/meta/<cpf>/atingiu", methods=["POST"])
def meta_atingida(cpf):
    try:

        if not cpf:
            return jsonify({"erro": "cpf é obrigatório"}), 400

        query = f"""
            UPDATE mo
SET 
    mo.VALOR_ATINGIDO = m.VALOR_META,
    mo.CUMPRIU = 1,
    mo.DT_ATUALIZACAO = GETDATE()
FROM TB_METAS_OPERADOR mo
JOIN TB_METAS m ON m.ID_META = mo.ID_META
join TB_OPERADORES o ON mo.ID_OPERADOR = o.ID_OPERADOR
WHERE o.CPF  = '{cpf}'
  AND mo.USADA_NO_SORTEIO = 0
  AND mo.CUMPRIU= 0
  AND mo.OBJETIVO >= m.OBJETIVO

        """

        banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query)
        banco.executa()

        return jsonify({"sucesso": True}), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500



@bp.route("/sorteio/<cpf>", methods=["GET"])
def sortear_presente(cpf):
    try:
        # 1. Buscar operador e carteira
        query_op = f"""
            SELECT ID_OPERADOR, ID_CARTEIRA
            FROM TB_OPERADORES
            WHERE CPF = '{cpf}'
        """

        banco = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query_op)
        rows = banco.executa()

        if not rows:
            return jsonify({"erro": "Operador não encontrado"}), 404

        id_operador = rows[0][0]
        id_carteira = rows[0][1]

        # 2. Buscar metas válidas para sorteio
        query_metas = f"""
SELECT
    MO.ID_META,
    CA.TOTAL_BOLINHAS,
    CA.PRESENTES_CONSUMIDOS,
    (CA.TOTAL_BOLINHAS - (CA.PRESENTES_CONSUMIDOS * 4)) AS BOLINHAS_SOBRANDO
FROM TB_OPERADORES O
JOIN TB_METAS_OPERADOR MO 
     ON MO.ID_OPERADOR = O.ID_OPERADOR
CROSS APPLY (
    SELECT 
        (SELECT COUNT(*) 
         FROM OPENJSON(O.ESTADO_ARVORE, '$.ornaments')) AS TOTAL_BOLINHAS,

        (SELECT COUNT(*) 
         FROM TB_METAS_CONSUMIDAS 
         WHERE ID_OPERADOR = O.ID_OPERADOR) AS PRESENTES_CONSUMIDOS
) CA
WHERE O.ID_OPERADOR = '{id_operador}'
    AND (CA.TOTAL_BOLINHAS - (CA.PRESENTES_CONSUMIDOS * 4)) >= 4;
        """

        banco_metas = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query_metas)
        metas_disponiveis = banco_metas.executa()

        if not metas_disponiveis:
            return jsonify({"erro": "Nenhuma meta disponível para sorteio"}), 403

        id_meta_a_usar = metas_disponiveis[0][0]

        # 3. Buscar presentes ativos
        query_presentes = f"""
            SELECT ID_PRESENTE, PREMIO, PROBABILIDADE, SORTEIOS, INDICE
            FROM TB_PRESENTES
            WHERE ID_CARTEIRA = '{id_carteira}'
              AND ATIVO = 1;
        """

        banco2 = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query_presentes)
        presentes = banco2.executa()

        if not presentes:
            return jsonify({"erro": "Nenhum presente ativo nesta carteira"}), 404

        # 4. Tabela de probabilidades
        tabela = [
            {
                "id": p[0],
                "premio": p[1],
                "probabilidade": p[2],
                "sorteios": p[3],
                "indice": p[4],
            }
            for p in presentes
        ]

        # 5. Sorteio
        import random
        rand_val = random.randint(0, 99)

        acumulado = 0
        premio_sorteado = None

        for item in tabela:
            acumulado += item["probabilidade"]
            if rand_val < acumulado:
                premio_sorteado = item
                break

        if not premio_sorteado:
            premio_sorteado = tabela[-1]

        # 6. Atualizar quantidade disponível do presente
        novo_sorteios = premio_sorteado["sorteios"] - 1
        novo_ativo = 1 if novo_sorteios > 0 else 0

        query_update_presente = f"""
            UPDATE TB_PRESENTES
            SET 
                SORTEIOS = {max(novo_sorteios, 0)},
                ATIVO = {novo_ativo}
            WHERE ID_PRESENTE = '{premio_sorteado["id"]}';
        """

        banco3 = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query_update_presente)
        banco3.executa()

        # 7. Marcar meta como usada no sorteio
        query_update_meta = f"""
            UPDATE TB_METAS_OPERADOR
            SET USADA_NO_SORTEIO = 1
            WHERE ID_META = '{id_meta_a_usar}'
              AND ID_OPERADOR = '{id_operador}';
        """

        banco5 = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query_update_meta)
        banco5.executa()

        # 8. Registrar consumo
        query_insert_consumo = f"""
            INSERT INTO TB_METAS_CONSUMIDAS (ID_OPERADOR, ID_META, ID_PRESENTE, DATA_CONSUMO)
            VALUES ('{id_operador}', '{id_meta_a_usar}', '{premio_sorteado["id"]}', GETDATE());
        """

        banco4 = AcaoBancoDados(ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query_insert_consumo)
        banco4.executa()

        return jsonify({
            "sucesso": True,
            "meta_usada": id_meta_a_usar,
            "sorteado": {
                "id": premio_sorteado["id"],
                "premio": premio_sorteado["premio"],
                "indice": premio_sorteado["indice"],
                "probabilidade": premio_sorteado["probabilidade"],
                "restantes": max(novo_sorteios, 0),
                "ativo": novo_ativo
            }
        }), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500


@bp.route("/premios", methods=["GET"])
def listar_premios():
    centroCusto = request.args.get("centroCusto").strip().upper()

    query = """
        SELECT
	        a.ID_CONSUMO,
            o.CENTRO_CUSTO,
            o.NOME AS OPERADOR,
            m.NOME_META,
            p.PREMIO,
            a.DATA_CONSUMO,
	        a.ENTREGUE
        FROM TB_METAS_CONSUMIDAS a
        JOIN TB_OPERADORES o 
            ON a.ID_OPERADOR = o.ID_OPERADOR
        JOIN TB_METAS m  
            ON a.ID_META = m.ID_META
        JOIN TB_PRESENTES p 
            ON a.ID_PRESENTE = p.ID_PRESENTE
        WHERE o.CENTRO_CUSTO = ?
        ORDER BY a.DATA_CONSUMO DESC;
    """

    banco = AcaoBancoDados(
        ip_servidor_66,
        banco_desenvolvimento,
        user_66,
        banco_senha_66,
        query
    )

    resultado = banco.executa([centroCusto])

    if not resultado or isinstance(resultado, Exception):
        return jsonify([]), 200

    colunas = [
        "ID_CONSUMO",
        "CENTRO_CUSTO",
        "OPERADOR",
        "NOME_META",
        "PREMIO",
        "DATA_CONSUMO",
        "ENTREGUE"
    ]

    dados = [dict(zip(colunas, linha)) for linha in resultado]

    return jsonify(dados), 200

@bp.patch("/premios/entregue")
def marcar_entregue():
    dados = request.get_json()

    id_consumo = dados.get("id")
    entregue = 1 if dados.get("entregue") else 0

    if id_consumo is None:
        return jsonify({"erro": "ID não informado"}), 400

    try:
        query = f"""
            UPDATE TB_METAS_CONSUMIDAS
            SET ENTREGUE = {entregue}
            WHERE ID_CONSUMO = ?
        """
        parametros = [id_consumo]

        banco = AcaoBancoDados(
            ip_servidor_66,
            banco_desenvolvimento,
            user_66,
            banco_senha_66,
            query,
        )

        linhas = banco.executa(parametros)

        if linhas == 0:
            return jsonify({"mensagem": "Registro não encontrado"}), 404

        return jsonify({"mensagem": "Entregue com sucesso"}), 200

    except Exception as e:
        import traceback
        print("Erro no PATCH /premios/entregue:")
        traceback.print_exc()
        return jsonify({"erro": "Falha interna"}), 500

#reset das metas


import pyodbc
from apscheduler.schedulers.background import BackgroundScheduler


def executar_reset_metas():
    try:
        query = "EXEC SP_RESET_METAS"
        
        banco = AcaoBancoDados(
            ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query
        )

        banco.executa()  # já executa e fecha conexão internamente

        print("[RESET] Metas verificadas e reset aplicados (se necessário)")
    except Exception as e:
        print("[RESET-ERRO]", str(e))


def atualizar_todas_metas():
    try:

        query = "EXEC SP_ATUALIZAR_TODAS_METAS"

        banco = AcaoBancoDados(
            ip_servidor_66, banco_desenvolvimento, user_66, banco_senha_66, query
        )

        banco.executa()  

        print("[RESET] Metas verificadas e reset aplicados (se necessário)")
    except Exception as e:
        print("[RESET-ERRO]", str(e))


def iniciar_scheduler():
    scheduler = BackgroundScheduler()

    scheduler.add_job(executar_reset_metas, "interval", minutes=15)

    scheduler.add_job(atualizar_todas_metas, "interval", minutes=60)

    scheduler.start()
    print("[SCHEDULER] Scheduler iniciado com sucesso!")


