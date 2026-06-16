from datetime import timedelta
from uuid import uuid4

from fastapi import APIRouter, Depends

from app.db import get_db
from app.security import get_current_user
from app.utils import now_utc, serialize_doc

router = APIRouter(prefix="/demo", tags=["demo"])


DEMO_PEOPLE = [
    {
        "handle": "maya_founders",
        "name": "Maya Chen",
        "email": "maya.demo@cordial.local",
        "title": "Founder, Campus Cart",
        "bio": "Building lightweight commerce tools for student-run markets.",
        "skills": ["marketplaces", "ops", "student founders"],
        "interests": ["coffee chats", "early users"],
        "open_to": ["beta testers", "warm intros", "pitch feedback"],
    },
    {
        "handle": "devon_design",
        "name": "Devon Brooks",
        "email": "devon.demo@cordial.local",
        "title": "Product Designer",
        "bio": "Designs practical onboarding and event experiences for community products.",
        "skills": ["ux research", "prototyping", "community"],
        "interests": ["design systems", "career pivots"],
        "open_to": ["portfolio reviews", "collabs"],
    },
    {
        "handle": "sam_bsa",
        "name": "Samir Patel",
        "email": "samir.demo@cordial.local",
        "title": "Senior BSA",
        "bio": "Turns messy ideas into requirements, workflows, and revenue-ready releases.",
        "skills": ["requirements", "stakeholders", "process mapping"],
        "interests": ["saas", "automation", "pilot design"],
        "open_to": ["scope reviews", "mvp planning"],
    },
]


async def upsert_demo_user(person: dict) -> dict:
    db = get_db()
    existing = await db.users.find_one({"handle": person["handle"]})
    data = {
        "email": person["email"],
        "handle": person["handle"],
        "name": person["name"],
        "title": person["title"],
        "bio": person["bio"],
        "skills": person["skills"],
        "projects": [
            {
                "title": "Community follow-up pilot",
                "description": "A small event workflow designed to create measurable next steps.",
                "url": "",
            }
        ],
        "links": [],
        "interests": person["interests"],
        "open_to": person["open_to"],
        "updated_at": now_utc(),
    }
    if existing:
        await db.users.update_one({"_id": existing["_id"]}, {"$set": data})
        return await db.users.find_one({"_id": existing["_id"]})

    user = {"_id": str(uuid4()), "created_at": now_utc(), **data}
    await db.users.insert_one(user)
    return user


@router.post("/seed")
async def seed_demo(current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    people = [await upsert_demo_user(person) for person in DEMO_PEOPLE]

    event_code = "PITCH1"
    event = await db.events.find_one({"code": event_code})
    event_data = {
        "name": "Cordial Founder Coffee",
        "description": "A demo networking room where every good conversation becomes a saved relationship and a follow-up.",
        "location": "Demo Room",
        "starts_at": now_utc() + timedelta(days=3),
        "ends_at": now_utc() + timedelta(days=3, hours=2),
        "event_url": "",
        "host_note": "Use the attendee list to connect, then open the recap to show relationship outcomes.",
        "links": [
            {"label": "Pitch deck", "url": "https://example.com/cordial-pitch"},
            {"label": "Pilot notes", "url": "https://example.com/pilot"},
        ],
        "host_id": current_user["_id"],
        "attendees": [current_user["_id"], *[person["_id"] for person in people]],
        "updated_at": now_utc(),
    }
    if event and event.get("host_id") == current_user["_id"]:
        await db.events.update_one({"_id": event["_id"]}, {"$set": event_data})
        event = await db.events.find_one({"_id": event["_id"]})
    else:
        if event:
            event_code = f"P{str(current_user['_id']).replace('-', '')[:5].upper()}"
        event = {"_id": str(uuid4()), "code": event_code, "created_at": now_utc(), **event_data}
        await db.events.insert_one(event)

    connection_ids = []
    for index, person in enumerate(people[:2]):
        user_a, user_b = sorted([current_user["_id"], person["_id"]])
        connection = await db.connections.find_one({"user_a": user_a, "user_b": user_b})
        connection_data = {
            "user_a": user_a,
            "user_b": user_b,
            "created_by": current_user["_id"],
            "note": f"Met at {event['name']}; talked about {person['open_to'][0]}.",
            "event": event["name"],
            "event_id": event["_id"],
            "event_code": event["code"],
            "event_name": event["name"],
            "updated_at": now_utc(),
        }
        if connection:
            await db.connections.update_one({"_id": connection["_id"]}, {"$set": connection_data})
            connection_id = connection["_id"]
        else:
            connection_id = str(uuid4())
            await db.connections.insert_one({"_id": connection_id, "created_at": now_utc(), **connection_data})
        connection_ids.append(connection_id)

        await db.followups.update_one(
            {"connection_id": connection_id, "user_id": current_user["_id"], "demo_key": f"seed-{index}"},
            {
                "$set": {
                    "connection_id": connection_id,
                    "user_id": current_user["_id"],
                    "text": "Send pilot invite and ask for one specific intro." if index == 0 else "Book a 20-minute product feedback call.",
                    "due_date": now_utc() + timedelta(days=index + 1),
                    "status": "open" if index == 0 else "completed",
                    "demo_key": f"seed-{index}",
                    "updated_at": now_utc(),
                },
                "$setOnInsert": {"_id": str(uuid4()), "created_at": now_utc()},
            },
            upsert=True,
        )

    await db.asks.update_one(
        {"user_id": people[2]["_id"], "demo_key": "bsa-review"},
        {
            "$set": {
                "user_id": people[2]["_id"],
                "type": "offer",
                "text": "I can pressure-test MVP scope and map the pilot workflow.",
                "tags": ["requirements", "mvp", "pilot"],
                "reply_count": 0,
                "demo_key": "bsa-review",
                "updated_at": now_utc(),
            },
            "$setOnInsert": {"_id": str(uuid4()), "created_at": now_utc()},
        },
        upsert=True,
    )

    return {
        "ok": True,
        "event": serialize_doc(event),
        "people": [serialize_doc(person) for person in people],
        "connections_created": len(connection_ids),
    }
