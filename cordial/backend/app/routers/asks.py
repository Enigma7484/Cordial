from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.schemas import AskCreateIn, AskUpdateIn, SignalReplyIn
from app.security import get_current_user
from app.utils import now_utc, public_user, serialize_doc, serialize_docs

router = APIRouter(prefix="/asks", tags=["asks"])


@router.post("")
async def create_ask(payload: AskCreateIn, current_user: dict = Depends(get_current_user)) -> dict:
    ask = {
        "_id": str(uuid4()),
        "type": payload.type,
        "text": payload.text,
        "tags": payload.tags,
        "user_id": current_user["_id"],
        "reply_count": 0,
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


def match_profile(user: dict, ask: dict) -> dict:
    ask_terms = {tag.lower() for tag in ask.get("tags", [])}
    ask_terms.update(word.lower().strip(".,!?") for word in ask.get("text", "").split() if len(word) > 3)
    user_terms = set()
    for field in ("skills", "open_to", "interests"):
        user_terms.update(str(item).lower() for item in user.get(field, []))
    matched_terms = sorted(term for term in ask_terms if any(term in user_term or user_term in term for user_term in user_terms))
    score = min(100, len(matched_terms) * 24 + len(user.get("open_to", [])) * 4 + len(user.get("skills", [])) * 3)
    if ask.get("type") == "ask" and any("help" in term or "review" in term or "mock" in term for term in user_terms):
        score += 12
    return {
        "user": public_user(user),
        "score": min(score, 100),
        "reasons": matched_terms[:4] or user.get("open_to", [])[:2] or user.get("skills", [])[:2],
    }


@router.get("/{ask_id}/matches")
async def signal_matches(ask_id: str, current_user: dict = Depends(get_current_user)) -> list[dict]:
    db = get_db()
    ask = await db.asks.find_one({"_id": ask_id})
    if not ask:
        raise HTTPException(status_code=404, detail="Signal not found")

    users = await db.users.find({"_id": {"$ne": ask["user_id"]}}).to_list(length=100)
    matches = [match_profile(user, ask) for user in users if user["_id"] != current_user["_id"] or ask["user_id"] == current_user["_id"]]
    matches = [match for match in matches if match["score"] > 0 or match["reasons"]]
    matches.sort(key=lambda item: item["score"], reverse=True)
    return matches[:8]


async def serialize_signal_reply(reply: dict) -> dict:
    db = get_db()
    item = serialize_doc(reply)
    item["ask"] = serialize_doc(await db.asks.find_one({"_id": reply["ask_id"]}))
    item["ask_user"] = public_user(await db.users.find_one({"_id": reply["ask_user_id"]}))
    item["responder"] = public_user(await db.users.find_one({"_id": reply["responder_id"]}))
    if reply.get("connection_id"):
        item["connection"] = serialize_doc(await db.connections.find_one({"_id": reply["connection_id"]}))
    if reply.get("followup_id"):
        item["followup"] = serialize_doc(await db.followups.find_one({"_id": reply["followup_id"]}))
    return item


@router.get("/replies/mine")
async def my_signal_replies(current_user: dict = Depends(get_current_user)) -> list[dict]:
    cursor = get_db().signal_replies.find(
        {"$or": [{"ask_user_id": current_user["_id"]}, {"responder_id": current_user["_id"]}]}
    ).sort("created_at", -1)
    replies = await cursor.to_list(length=100)
    return [await serialize_signal_reply(reply) for reply in replies]


@router.post("/{ask_id}/replies")
async def reply_to_signal(
    ask_id: str,
    payload: SignalReplyIn,
    current_user: dict = Depends(get_current_user),
) -> dict:
    db = get_db()
    ask = await db.asks.find_one({"_id": ask_id})
    if not ask:
        raise HTTPException(status_code=404, detail="Signal not found")
    if ask["user_id"] == current_user["_id"]:
        raise HTTPException(status_code=400, detail="You cannot reply to your own signal")

    ask_user = await db.users.find_one({"_id": ask["user_id"]})
    if not ask_user:
        raise HTTPException(status_code=404, detail="Signal owner not found")

    user_a, user_b = sorted([current_user["_id"], ask_user["_id"]])
    connection = await db.connections.find_one({"user_a": user_a, "user_b": user_b})
    note = f"Responded to {ask['type']}: {ask['text']}"
    if connection:
        await db.connections.update_one(
            {"_id": connection["_id"]},
            {"$set": {"note": note, "updated_at": now_utc()}},
        )
        connection = await db.connections.find_one({"_id": connection["_id"]})
    else:
        connection = {
            "_id": str(uuid4()),
            "user_a": user_a,
            "user_b": user_b,
            "created_by": current_user["_id"],
            "created_at": now_utc(),
            "note": note,
            "event": "",
        }
        await db.connections.insert_one(connection)

    reply = {
        "_id": str(uuid4()),
        "ask_id": ask["_id"],
        "ask_user_id": ask_user["_id"],
        "responder_id": current_user["_id"],
        "connection_id": connection["_id"],
        "message": payload.message,
        "status": "open",
        "created_at": now_utc(),
    }
    await db.signal_replies.insert_one(reply)

    followup_text = payload.message or f"Follow up with @{ask_user.get('handle', '')} about their {ask['type']}"
    followup = {
        "_id": str(uuid4()),
        "connection_id": connection["_id"],
        "user_id": current_user["_id"],
        "text": followup_text,
        "due_date": None,
        "status": "open",
        "created_at": now_utc(),
        "source": "signal_reply",
        "signal_reply_id": reply["_id"],
    }
    await db.followups.insert_one(followup)
    await db.signal_replies.update_one({"_id": reply["_id"]}, {"$set": {"followup_id": followup["_id"]}})
    reply["followup_id"] = followup["_id"]
    await db.asks.update_one({"_id": ask["_id"]}, {"$inc": {"reply_count": 1}, "$set": {"updated_at": now_utc()}})
    return await serialize_signal_reply(reply)


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
