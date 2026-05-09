from datetime import timedelta
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from app.config import get_settings
from app.db import get_db
from app.schemas import AuthOut, RequestOtpIn, RequestOtpOut, VerifyOtpIn
from app.security import create_access_token
from app.utils import make_otp, normalize_email, now_utc, serialize_doc, slugify_handle

router = APIRouter(prefix="/auth", tags=["auth"])


async def unique_handle(email: str) -> str:
    db = get_db()
    base = slugify_handle(email)
    handle = base
    suffix = 1
    while await db.users.find_one({"handle": handle}):
        suffix += 1
        handle = f"{base}{suffix}"
    return handle


@router.post("/request-otp", response_model=RequestOtpOut)
async def request_otp(payload: RequestOtpIn) -> RequestOtpOut:
    settings = get_settings()
    db = get_db()
    email = normalize_email(payload.email)
    code = make_otp()

    await db.otps.insert_one(
        {
            "_id": str(uuid4()),
            "email": email,
            "code": code,
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(minutes=10),
            "used": False,
        }
    )

    return RequestOtpOut(
        message="OTP created. In development, use the returned code.",
        dev_otp=code if settings.env == "development" or settings.show_dev_otp else None,
    )


@router.post("/verify-otp", response_model=AuthOut)
async def verify_otp(payload: VerifyOtpIn) -> AuthOut:
    db = get_db()
    email = normalize_email(payload.email)
    otp = await db.otps.find_one(
        {
            "email": email,
            "code": payload.code,
            "used": False,
            "expires_at": {"$gt": now_utc()},
        },
        sort=[("created_at", -1)],
    )
    if not otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    await db.otps.update_one({"_id": otp["_id"]}, {"$set": {"used": True}})

    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "_id": str(uuid4()),
            "email": email,
            "handle": await unique_handle(email),
            "name": email.split("@")[0],
            "title": "",
            "bio": "",
            "skills": [],
            "projects": [],
            "links": [],
            "interests": [],
            "open_to": [],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        try:
            await db.users.insert_one(user)
        except DuplicateKeyError as exc:
            raise HTTPException(status_code=409, detail="User already exists") from exc

    token = create_access_token(user["_id"])
    return AuthOut(token=token, user=serialize_doc(user))
