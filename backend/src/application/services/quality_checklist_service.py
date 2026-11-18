from src.infrastructure.repositories.sql_quality_checklist_repository import QualityChecklistRepository


class QualityChecklistService:
    def __init__(self):
        self.repo = QualityChecklistRepository()

    @staticmethod
    def _validate(definition):
        required = ("id", "label", "walletId", "walletLabel", "channelId", "channelLabel", "blocks")
        missing = [field for field in required if not definition.get(field)]
        if missing:
            return f"Campos obrigatórios ausentes: {', '.join(missing)}"
        if not isinstance(definition["blocks"], list) or not definition["blocks"]:
            return "O checklist precisa ter pelo menos um bloco."
        item_ids = set()
        for block in definition["blocks"]:
            if not block.get("id") or not block.get("title") or not block.get("items"):
                return "Todos os blocos precisam de identificador, título e itens."
            for item in block["items"]:
                if not item.get("id") or not item.get("title"):
                    return "Todos os itens precisam de identificador e título."
                if item["id"] in item_ids:
                    return f"O identificador de item '{item['id']}' está duplicado."
                item_ids.add(item["id"])
                try:
                    int(item.get("weight"))
                except (TypeError, ValueError):
                    return f"Peso inválido no item '{item['title']}'."
        return None

    def list(self, published_only=False):
        return self.repo.list_published() if published_only else self.repo.list_latest()

    def save(self, definition, actor):
        error = self._validate(definition)
        if error:
            return None, error
        return self.repo.save_draft(definition, actor), None

    def publish(self, version_id, actor):
        definition = self.repo.get_version(version_id)
        if not definition:
            return False, "Versão não encontrada."
        error = self._validate(definition)
        if error:
            return False, error
        return self.repo.publish(version_id, actor), None

    def deactivate(self, config_id, actor):
        return bool(self.repo.deactivate(config_id, actor))

    def delete_wallet(self, wallet_id, confirmation):
        items = self.repo.list_latest()
        wallet = next((item for item in items if item.get("walletId") == wallet_id), None)
        if not wallet:
            return {"status": "not_found"}

        expected = f"EXCLUIR {wallet.get('walletLabel', '')}".strip().upper()
        if str(confirmation or "").strip().upper() != expected:
            return {
                "status": "invalid_confirmation",
                "expected": f"EXCLUIR {wallet.get('walletLabel', '')}",
            }
        return self.repo.delete_wallet(wallet_id)
