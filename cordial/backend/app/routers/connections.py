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


@router.get("/{connection_id}/timeline")
async def connection_timeline(connection_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    connection = await db.connections.find_one({"_id": connection_id})
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    if current_user["_id"] not in [connection["user_a"], connection["user_b"]]:
        raise HTTPException(status_code=403, detail="You are not part of this connection")

    other_id = connection["user_b"] if connection["user_a"] == current_user["_id"] else connection["user_a"]
    other = await db.users.find_one({"_id": other_id})
    followups = await db.followups.find(
        {"connection_id": connection_id, "user_id": current_user["_id"]}
    ).sort("created_at", -1).to_list(length=50)
    signal_replies = await db.signal_replies.find({"connection_id": connection_id}).sort("created_at", -1).to_list(
        length=50
    )

    timeline = [
        {
            "id": connection["_id"],
            "type": "connection",
            "title": "Connected",
            "text": connection.get("note", ""),
            "created_at": connection.get("created_at"),
        }
    ]
    if connection.get("event_name"):
        timeline.append(
            {
                "id": f"{connection['_id']}-event",
                "type": "event",
                "title": f"Met at {connection.get('event_name', '')}",
                "text": connection.get("event_code", ""),
                "created_at": connection.get("created_at"),
            }
        )
    for followup in followups:
        timeline.append(
            {
                "id": followup["_id"],
                "type": "followup",
                "title": "Follow-up completed" if followup.get("status") == "completed" else "Follow-up open",
                "text": followup.get("text", ""),
                "status": followup.get("status", ""),
                "created_at": followup.get("created_at"),
            }
        )
    for reply in signal_replies:
        ask = await db.asks.find_one({"_id": reply["ask_id"]})
        timeline.append(
            {
                "id": reply["_id"],
                "type": "signal_reply",
                "title": "Signal reply",
                "text": reply.get("message") or (ask or {}).get("text", ""),
                "created_at": reply.get("created_at"),
            }
        )
    timeline.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)

    open_followups = [item for item in followups if item.get("status") == "open"]
    return {
        "connection": await serialize_connection(connection, current_user["_id"]),
        "other_user": public_user(other),
        "open_followups": len(open_followups),
        "completed_followups": len([item for item in followups if item.get("status") == "completed"]),
        "signal_reply_count": len(signal_replies),
        "next_action": open_followups[0].get("text") if open_followups else "",
        "timeline": serialize_doc({"_id": "timeline", "items": timeline})["items"],
    }


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

    user_a, user_b = sorted([current_user["_id"], other["_id"]])
    existing = await db.connections.find_one({"user_a": user_a, "user_b": user_b})
    if existing:
        updates = dict(event_context)
        if body.note:
            updates["note"] = body.note
        if body.event:
            updates["event"] = body.event
        if updates:
            updates["updated_at"] = now_utc()
            await db.connections.update_one({"_id": existing["_id"]}, {"$set": updates})
            existing = await db.connections.find_one({"_id": existing["_id"]})
        return await serialize_connection(existing, current_user["_id"])

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
