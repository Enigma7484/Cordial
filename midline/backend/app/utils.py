import random
import re
import string
from datetime import datetime, timezone


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def make_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def make_event_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(6))


def slugify_handle(value: str) -> str:
    base = value.split("@")[0].lower()
    base = re.sub(r"[^a-z0-9_]", "", base)
    return base[:18] or "user"


def serialize_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_value(item) for key, item in value.items()}
    return value


def serialize_doc(doc: dict | None) -> dict | None:
    if not doc:
        return None
    item = dict(doc)
    item["id"] = str(item.pop("_id"))
    return serialize_value(item)


def serialize_docs(docs: list[dict]) -> list[dict]:
    return [serialize_doc(doc) for doc in docs if doc]


def public_user(user: dict | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user["_id"],
        "name": user.get("name", ""),
        "handle": user.get("handle", ""),
        "title": user.get("title", ""),
        "bio": user.get("bio", ""),
        "skills": user.get("skills", []),
        "interests": user.get("interests", []),
        "open_to": user.get("open_to", []),
    }
