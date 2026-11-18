from src.shared import JsonException
from functools import wraps
from flask import request


def require_fields(*fields):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            data = request.get_json(silent=True) or {}
            for field in fields:
                if not data.get(field):
                    raise JsonException(f"Campo obrigatório '{field}' não foi enviado", 400)
            return f(*args, **kwargs)
        return wrapper
    return decorator