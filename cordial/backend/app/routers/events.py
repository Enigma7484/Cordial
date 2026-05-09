from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.schemas import EventCreateIn, EventUpdateIn
from app.security import get_current_user
from app.utils import make_event_code, now_utc, public_user, serialize_doc

router = APIRouter(prefix="/events", tags=["events"])


async def serialize_event(event: dict) -> dict:
    db = get_db()
    item = serialize_doc(event)
    attendees = await db.users.find({"_id": {"$in": event.get("attendees", [])}}).to_list(length=100)
    item["attendee_profiles"] = [public_user(user) for user in attendees]
    return item


@router.get("/mine")
async def my_events(current_user: dict = Depends(get_current_user)) -> list[dict]:
    cursor = get_db().events.find(
        {"$or": [{"host_id": current_user["_id"]}, {"attendees": current_user["_id"]}]}
    ).sort("created_at", -1)
    events = await cursor.to_list(length=100)
    return [await serialize_event(event) for event in events]


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
            return await serialize_event(event)
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
    return await serialize_event(event)


@router.put("/{event_id}")
async def update_event(
    event_id: str,
    payload: EventUpdateIn,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db = get_db()
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["host_id"] != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Only the host can edit this event")

    await db.events.update_one(
        {"_id": event_id},
        {"$set": {"name": payload.name, "updated_at": now_utc()}},
    )
    updated = await db.events.find_one({"_id": event_id})
    return await serialize_event(updated)


@router.post("/{event_id}/leave")
async def leave_event(event_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event["host_id"] == current_user["_id"]:
        raise HTTPException(status_code=400, detail="Hosts cannot leave their own event. Delete it instead.")

    await db.events.update_one({"_id": event_id}, {"$pull": {"attendees": current_user["_id"]}})
    updated = await db.events.find_one({"_id": event_id})
    return await serialize_event(updated)


@router.delete("/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    result = await get_db().events.delete_one({"_id": event_id, "host_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found or you are not the host")
    return {"ok": True}
