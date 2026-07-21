from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global client, database
    settings = get_settings()
    settings.validate_runtime()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    database = client[settings.mongodb_db]

    await database.users.create_index("email", unique=True)
    await database.users.create_index("handle", unique=True)
    await database.otps.create_index("email")
    await database.otps.create_index("expires_at", expireAfterSeconds=0)
    await database.otp_attempts.create_index("email")
    await database.otp_attempts.create_index("created_at", expireAfterSeconds=3600)
    await database.connections.create_index([("user_a", 1), ("user_b", 1)], unique=True)
    await database.events.create_index("code", unique=True)
    await database.asks.create_index("created_at")
    # Networking automation records are always queried through their owner. These
    # indexes are the persistence-level companion to route-level tenant checks.
    for collection_name in [
        "network_contacts",
        "connection_imports",
        "campaigns",
        "campaign_candidates",
        "contact_channels",
        "contact_evidence",
        "message_drafts",
        "message_approvals",
        "message_events",
        "replies",
        "campaign_followups",
        "relationship_events",
        "suppression_entries",
        "audit_events",
        "provider_connections",
        "compliance_rules",
        "outreach_outcomes",
    ]:
        await database[collection_name].create_index("owner_id")
    await database.network_contacts.create_index([("owner_id", 1), ("profile_url", 1)])
    await database.campaign_candidates.create_index([("owner_id", 1), ("campaign_id", 1), ("rank", 1)])
    await database.contact_evidence.create_index([("owner_id", 1), ("contact_id", 1), ("observed_at", -1)])
    await database.contact_channels.create_index([("owner_id", 1), ("contact_id", 1), ("channel_type", 1)])
    await database.message_events.create_index([("owner_id", 1), ("campaign_id", 1), ("contact_id", 1)])
    await database.relationship_events.create_index([("owner_id", 1), ("contact_id", 1), ("created_at", -1)])


async def close_mongo_connection() -> None:
    global client, database
    if client:
        client.close()
    client = None
    database = None


def get_db() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("Database is not connected")
    return database
