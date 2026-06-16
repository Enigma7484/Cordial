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
    item.setdefault("description", "")
    item.setdefault("location", "")
    item.setdefault("starts_at", None)
    item.setdefault("ends_at", None)
    item.setdefault("event_url", "")
    item.setdefault("host_note", "")
    item.setdefault("links", [])
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


@router.get("/{event_id}/recap")
async def event_recap(event_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    event = await db.events.find_one({"_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user["_id"] not in event.get("attendees", []) and event.get("host_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="You are not part of this event")

    attendee_ids = event.get("attendees", [])
    is_host = event.get("host_id") == current_user["_id"]
    connections = await db.connections.find(
        {"event_id": event_id}
        if is_host
        else {"$or": [{"user_a": current_user["_id"]}, {"user_b": current_user["_id"]}]}
    ).to_list(length=100)
    connected_ids = {
        connection["user_b"] if connection["user_a"] == current_user["_id"] else connection["user_a"]
        for connection in connections
        if current_user["_id"] in [connection["user_a"], connection["user_b"]]
    }
    event_connection_ids = [connection["_id"] for connection in connections if connection.get("event_id") == event_id]
    followups = await db.followups.find({"connection_id": {"$in": event_connection_ids}}).to_list(length=100)
    attendees = await db.users.find({"_id": {"$in": attendee_ids}}).to_list(length=100)
    attendee_profiles = [public_user(user) for user in attendees if user["_id"] != current_user["_id"]]
    not_connected = [user for user in attendee_profiles if user and user["id"] not in connected_ids]
    open_followups = [followup for followup in followups if followup.get("status") == "open"]
    completed_followups = [followup for followup in followups if followup.get("status") == "completed"]
    attendee_terms = []
    for user in attendee_profiles:
        attendee_terms.extend((user or {}).get("skills", [])[:2])
        attendee_terms.extend((user or {}).get("open_to", [])[:2])
    suggested_actions = []
    if not_connected:
        suggested_actions.append(f"Connect with {len(not_connected)} attendee(s) you have not saved yet.")
    if open_followups:
        suggested_actions.append(f"Close the loop on {len(open_followups)} event follow-up(s).")
    if not suggested_actions:
        suggested_actions.append("Create one follow-up from the strongest conversation before the event goes cold.")

    return {
        "event": await serialize_event(event),
        "attendees_seen": len(attendee_ids),
        "connections_from_event": len(event_connection_ids),
        "open_followups": len(open_followups),
        "completed_followups": len(completed_followups),
        "not_connected": not_connected[:8],
        "top_terms": sorted(set(attendee_terms))[:10],
        "suggested_actions": suggested_actions,
    }


@router.post("")
async def create_event(payload: EventCreateIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    for _ in range(5):
        event = {
            "_id": str(uuid4()),
            "name": payload.name,
            "description": payload.description,
            "location": payload.location,
            "starts_at": payload.starts_at,
            "ends_at": payload.ends_at,
            "event_url": payload.event_url,
            "host_note": payload.host_note,
            "links": [link.model_dump() for link in payload.links],
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
        {
            "$set": {
                "name": payload.name,
                "description": payload.description,
                "location": payload.location,
                "starts_at": payload.starts_at,
                "ends_at": payload.ends_at,
                "event_url": payload.event_url,
                "host_note": payload.host_note,
                "links": [link.model_dump() for link in payload.links],
                "updated_at": now_utc(),
            }
        },
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
