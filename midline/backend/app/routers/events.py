from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.schemas import EventCreateIn
from app.security import get_current_user
from app.utils import make_event_code, now_utc, serialize_doc

router = APIRouter(prefix="/events", tags=["events"])


@router.post("")
async def create_event(payload: EventCreateIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    for _ in range(5):
        event = {
            "_id": str(uuid4()),
            "name": payload.name,
            "code": make_event_code(),
            "host_id": current_user["_id"],
            "attendees": [current_user["_id"]],
            "created_at": now_utc(),
        }
        try:
            await db.events.insert_one(event)
            return serialize_doc(event)
        except DuplicateKeyError:
            continue
    raise HTTPException(status_code=500, detail="Could not generate an event code")


@router.post("/join/{event_code}")
async def join_event(event_code: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    await db.events.update_one(
        {"code": event_code.upper()},
        {"$addToSet": {"attendees": current_user["_id"]}},
    )
    event = await db.events.find_one({"code": event_code.upper()})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return serialize_doc(event)
