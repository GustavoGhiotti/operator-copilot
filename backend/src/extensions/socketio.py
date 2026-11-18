import os

from flask_socketio import SocketIO


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def get_socketio_options(*, logger: bool = False, engineio_logger: bool = False):
    options = {
        "cors_allowed_origins": os.getenv("SOCKETIO_CORS_ORIGINS", "*"),
        "async_mode": os.getenv("SOCKETIO_ASYNC_MODE", "threading"),
        "allow_upgrades": _env_bool("SOCKETIO_ALLOW_UPGRADES", False),
        "logger": logger,
        "engineio_logger": engineio_logger,
    }

    redis_url = os.getenv("SOCKETIO_REDIS_URL")
    if redis_url:
        options["message_queue"] = redis_url

    return options


socketio = SocketIO()
