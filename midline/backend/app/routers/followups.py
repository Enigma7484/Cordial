from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.schemas import FollowupIn
from app.security import get_current_user
from app.utils import now_utc, serialize_doc, serialize_docs

router = APIRouter(prefix="/followups", tags=["followups"])


@router.post("")
async def create_followup(payload: FollowupIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    connection = await db.connections.find_one({"_id": payload.connection_id})
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    if current_user["_id"] not in [connection["user_a"], connection["user_b"]]:
        raise HTTPException(status_code=403, detail="You are not part of this connection")

    followup = {
        "_id": str(uuid4()),
        "connection_id": payload.connection_id,
        "user_id": current_user["_id"],
        "text": payload.text,
        "due_date": payload.due_date,
        "status": payload.status,
        "created_at": now_utc(),
    }
    await db.followups.insert_one(followup)
    return serialize_doc(followup)


@router.get("/mine")
async def my_followups(current_user: dict = Depends(get_current_user)) -> list[dict]:
    cursor = get_db().followups.find({"user_id": current_user["_id"]}).sort("created_at", -1)
    return serialize_docs(await cursor.to_list(length=100))
