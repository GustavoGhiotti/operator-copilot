import os
import logging
from datetime import timedelta

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

from src.routes import *
from src.extensions.socketio import get_socketio_options, socketio


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIST = os.path.abspath(
    os.path.join(BASE_DIR, "..", "frontend", "dist")
)


def create_app():
    load_dotenv()

    app = Flask(__name__)

    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)

    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        supports_credentials=True
    )

    socketio.init_app(app, **get_socketio_options())

    JWTManager(app)

    app.register_blueprint(bp_acordo)
    app.register_blueprint(bp_academia)
    app.register_blueprint(bp_arena)
    app.register_blueprint(bp_admin)
    app.register_blueprint(bp_agendamentos)
    app.register_blueprint(bp_analytics)
    app.register_blueprint(bp_anotacoes)
    app.register_blueprint(bp_gama)
    app.register_blueprint(bp_crmweb)
    app.register_blueprint(bp_tabulacoes)
    app.register_blueprint(bp_chat)
    app.register_blueprint(bp_cliente)
    app.register_blueprint(bp_operador)
    app.register_blueprint(bp_login)
    app.register_blueprint(bp_digital)
    app.register_blueprint(bp_preventivo)
    app.register_blueprint(bp_quebra)
    app.register_blueprint(bp_quiz)
    app.register_blueprint(bp_simulacao)
    app.register_blueprint(bp_tarefas)
    app.register_blueprint(bp_matriculas)
    app.register_blueprint(bp_feedbacks)
    app.register_blueprint(bp_ia)
    app.register_blueprint(bp_ia_conhecimento)
    app.register_blueprint(bp_monitoria_whatsapp)
    app.register_blueprint(bp_qualidade)
    app.register_blueprint(bp_roteiro)
    app.register_blueprint(bp_auditoria)
    app.register_blueprint(bp_copilot_feedback)
    app.register_blueprint(bp_copilot_tour)
    app.register_blueprint(bp_permissoes)
    app.register_blueprint(bp_gestao_resultados)

    if os.getenv("AUDITORIA_EMBEDDED_WORKER", "true").lower() in {"1", "true", "yes", "on"}:
        from src.workers.auditoria_worker import start_embedded_worker
        start_embedded_worker()

    return app


app = create_app()


@socketio.on("connect")
def handle_connect():
    pass


@socketio.on("disconnect")
def handle_disconnect():
    pass


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(message)s"
    )

    socketio.run(
        app,
        host="0.0.0.0",
        port=8001,
        debug=True,
        use_reloader=False,
        allow_unsafe_werkzeug=os.getenv(
            "ALLOW_UNSAFE_WERKZEUG", "true"
        ).lower() in {"1", "true", "yes", "on"}
    )
