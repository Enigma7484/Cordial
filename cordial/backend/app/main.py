from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_mongo_connection, connect_to_mongo, get_db
from app.routers import asks, auth, connections, events, followups, profiles


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    await get_db().command("ping")
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(profiles.router)
app.include_router(connections.router)
app.include_router(events.router)
app.include_router(asks.router)
app.include_router(followups.router)
