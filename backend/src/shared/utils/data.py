from datetime import datetime

def formatar_data(data_str: str):
    formatos = ["%Y-%m-%d", "%d/%m/%Y"]
    for fmt in formatos:
        try:
            return datetime.strptime(data_str, fmt).date()
        except ValueError:
            continue

    raise ValueError(f"Formato de data inválido: {data_str}")