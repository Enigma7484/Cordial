from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.schemas import ProfileUpdate
from app.security import get_current_user
from app.utils import now_utc, public_user, serialize_doc

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)) -> dict:
    return serialize_doc(current_user)


@router.get("/{handle}")
async def get_profile_by_handle(handle: str) -> dict:
    user = await get_db().users.find_one({"handle": handle.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="Profile not found")
    return public_user(user)


@router.put("/me")
async def update_my_profile(payload: ProfileUpdate, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    data = payload.model_dump()
    data["handle"] = data["handle"].lower()
    data["updated_at"] = now_utc()

    try:
        await db.users.update_one({"_id": current_user["_id"]}, {"$set": data})
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Handle is already taken") from exc

    updated = await db.users.find_one({"_id": current_user["_id"]})
    return serialize_doc(updated)
