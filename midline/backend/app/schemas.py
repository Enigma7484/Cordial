from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RequestOtpIn(BaseModel):
    email: EmailStr


class RequestOtpOut(BaseModel):
    message: str
    dev_otp: str | None = None


class VerifyOtpIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class AuthOut(BaseModel):
    token: str
    user: dict


class Link(BaseModel):
    label: str = ""
    url: str = ""


class ProjectCard(BaseModel):
    title: str = ""
    description: str = ""
    url: str = ""


class ProfileUpdate(BaseModel):
    name: str = ""
    handle: str = Field(default="", pattern=r"^[a-zA-Z0-9_]{3,24}$")
    title: str = ""
    bio: str = ""
    skills: list[str] = []
    projects: list[ProjectCard] = []
    links: list[Link] = []
    interests: list[str] = []
    open_to: list[str] = []


class ConnectIn(BaseModel):
    note: str = Field(default="", max_length=280)
    event: str = Field(default="", max_length=120)


class FollowupIn(BaseModel):
    connection_id: str
    text: str = Field(min_length=1, max_length=280)
    due_date: datetime | None = None
    status: Literal["open", "completed"] = "open"


class FollowupStatusIn(BaseModel):
    status: Literal["open", "completed"]


class EventCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class AskCreateIn(BaseModel):
    type: Literal["ask", "offer"]
    text: str = Field(min_length=1, max_length=240)
    tags: list[str] = []
