from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global client, database
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    database = client[settings.mongodb_db]

    await database.users.create_index("email", unique=True)
    await database.users.create_index("handle", unique=True)
    await database.otps.create_index("email")
    await database.otps.create_index("expires_at", expireAfterSeconds=0)
    await database.connections.create_index([("user_a", 1), ("user_b", 1)], unique=True)
    await database.events.create_index("code", unique=True)
    await database.asks.create_index("created_at")


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
