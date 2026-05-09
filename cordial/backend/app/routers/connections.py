from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.schemas import ConnectIn
from app.security import get_current_user
from app.utils import now_utc, public_user, serialize_doc

router = APIRouter(prefix="/connections", tags=["connections"])


async def serialize_connection(connection: dict, current_user_id: str) -> dict:
    db = get_db()
    other_id = connection["user_b"] if connection["user_a"] == current_user_id else connection["user_a"]
    other = await db.users.find_one({"_id": other_id})
    item = serialize_doc(connection)
    item["other_user"] = public_user(other)
    if connection.get("event_id"):
        event = await db.events.find_one({"_id": connection["event_id"]})
        if event:
            item["event_context"] = {
                "id": event["_id"],
                "name": event.get("name", ""),
                "code": event.get("code", ""),
            }
    return item


@router.get("/mine")
async def my_connections(current_user: dict = Depends(get_current_user)) -> list[dict]:
    db = get_db()
    cursor = db.connections.find(
        {"$or": [{"user_a": current_user["_id"]}, {"user_b": current_user["_id"]}]}
    ).sort("created_at", -1)
    connections = await cursor.to_list(length=100)
    return [await serialize_connection(connection, current_user["_id"]) for connection in connections]


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
        return await serialize_connection(existing, current_user["_id"])

    body = payload or ConnectIn()
    event_context = {}
    if body.event_id:
        event = await db.events.find_one({"_id": body.event_id})
        if not event:
            raise HTTPException(status_code=404, detail="Event context not found")
        if current_user["_id"] not in event.get("attendees", []) or other["_id"] not in event.get("attendees", []):
            raise HTTPException(status_code=400, detail="Both users must be attendees to connect through this event")
        event_context = {
            "event_id": event["_id"],
            "event_code": event.get("code", ""),
            "event_name": event.get("name", ""),
        }

    connection = {
        "_id": str(uuid4()),
        "user_a": user_a,
        "user_b": user_b,
        "created_by": current_user["_id"],
        "created_at": now_utc(),
        "note": body.note,
        "event": body.event,
        **event_context,
    }

    try:
        await db.connections.insert_one(connection)
    except DuplicateKeyError:
        connection = await db.connections.find_one({"user_a": user_a, "user_b": user_b})

    return await serialize_connection(connection, current_user["_id"])
