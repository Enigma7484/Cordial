from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.schemas import ConnectIn
from app.security import get_current_user
from app.utils import now_utc, serialize_doc

router = APIRouter(prefix="/connections", tags=["connections"])


@router.post("/connect/{handle}")
async def connect_by_handle(
    handle: str,
    payload: ConnectIn | None = None,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db = get_db()
    other = await db.users.find_one({"handle": handle.lower()})
    if not other:
        raise HTTPException(status_code=404, detail="No user found with that handle")
    if other["_id"] == current_user["_id"]:
        raise HTTPException(status_code=400, detail="You cannot connect with yourself")

    user_a, user_b = sorted([current_user["_id"], other["_id"]])
    existing = await db.connections.find_one({"user_a": user_a, "user_b": user_b})
    if existing:
        return serialize_doc(existing)

    body = payload or ConnectIn()
    connection = {
        "_id": str(uuid4()),
        "user_a": user_a,
        "user_b": user_b,
        "created_by": current_user["_id"],
        "created_at": now_utc(),
        "note": body.note,
        "event": body.event,
    }

    try:
        await db.connections.insert_one(connection)
    except DuplicateKeyError:
        connection = await db.connections.find_one({"user_a": user_a, "user_b": user_b})

    return serialize_doc(connection)
