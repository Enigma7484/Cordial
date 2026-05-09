from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.schemas import AskCreateIn, AskUpdateIn
from app.security import get_current_user
from app.utils import now_utc, serialize_doc, serialize_docs

router = APIRouter(prefix="/asks", tags=["asks"])


@router.post("")
async def create_ask(payload: AskCreateIn, current_user: dict = Depends(get_current_user)) -> dict:
    ask = {
        "_id": str(uuid4()),
        "type": payload.type,
        "text": payload.text,
        "tags": payload.tags,
        "user_id": current_user["_id"],
        "user": {
            "name": current_user.get("name", ""),
            "handle": current_user.get("handle", ""),
            "title": current_user.get("title", ""),
        },
        "created_at": now_utc(),
    }
    await get_db().asks.insert_one(ask)
    return serialize_doc(ask)


@router.get("")
async def list_asks() -> list[dict]:
    cursor = get_db().asks.find().sort("created_at", -1)
    return serialize_docs(await cursor.to_list(length=100))


@router.put("/{ask_id}")
async def update_ask(ask_id: str, payload: AskUpdateIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    ask = await db.asks.find_one({"_id": ask_id, "user_id": current_user["_id"]})
    if not ask:
        raise HTTPException(status_code=404, detail="Signal not found")

    await db.asks.update_one(
        {"_id": ask_id},
        {
            "$set": {
                "type": payload.type,
                "text": payload.text,
                "tags": payload.tags,
                "user": {
                    "name": current_user.get("name", ""),
                    "handle": current_user.get("handle", ""),
                    "title": current_user.get("title", ""),
                },
                "updated_at": now_utc(),
            }
        },
    )
    updated = await db.asks.find_one({"_id": ask_id})
    return serialize_doc(updated)


@router.delete("/{ask_id}")
async def delete_ask(ask_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    result = await get_db().asks.delete_one({"_id": ask_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Signal not found")
    return {"ok": True}
