from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.schemas import FollowupIn, FollowupStatusIn
from app.security import get_current_user
from app.utils import now_utc, public_user, serialize_doc

router = APIRouter(prefix="/followups", tags=["followups"])


async def serialize_followup(followup: dict) -> dict:
    db = get_db()
    connection = await db.connections.find_one({"_id": followup["connection_id"]})
    item = serialize_doc(followup)
    if connection:
        other_id = connection["user_b"] if connection["user_a"] == followup["user_id"] else connection["user_a"]
        item["connection"] = serialize_doc(connection)
        item["other_user"] = public_user(await db.users.find_one({"_id": other_id}))
    return item


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
    return await serialize_followup(followup)


@router.get("/mine")
async def my_followups(current_user: dict = Depends(get_current_user)) -> list[dict]:
    cursor = get_db().followups.find({"user_id": current_user["_id"]}).sort("created_at", -1)
    followups = await cursor.to_list(length=100)
    return [await serialize_followup(followup) for followup in followups]


@router.patch("/{followup_id}")
async def update_followup_status(
    followup_id: str,
    payload: FollowupStatusIn,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db = get_db()
    followup = await db.followups.find_one({"_id": followup_id, "user_id": current_user["_id"]})
    if not followup:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    await db.followups.update_one(
        {"_id": followup_id},
        {"$set": {"status": payload.status, "updated_at": now_utc()}},
    )
    updated = await db.followups.find_one({"_id": followup_id})
    return await serialize_followup(updated)
