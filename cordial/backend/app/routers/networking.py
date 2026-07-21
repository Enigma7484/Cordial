from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import get_db
from app.security import get_current_user
from app.services.networking import (
    DEFAULT_WEIGHTS,
    employment_confidence,
    message_variants,
    normalize_contact,
    review_message,
    score_candidate,
)
from app.services.providers import ManualContactDiscoveryProvider, get_email_provider
from app.utils import now_utc, serialize_doc, serialize_docs


router = APIRouter(prefix="/network", tags=["network automation"])


class ImportPreviewIn(BaseModel):
    filename: str = "connections.csv"
    csv_text: str = Field(min_length=1, max_length=2_000_000)
    mapping: dict[str, str] = {}
    consent_confirmed: bool = False


class ImportCommitIn(ImportPreviewIn):
    pass


class CampaignIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    objective: str = Field(min_length=5, max_length=1000)
    target_companies: list[str] = []
    target_roles: list[str] = []
    target_industries: list[str] = []
    preferred_locations: list[str] = []
    relevant_schools: list[str] = []
    graduation_year_range: list[int] = []
    shared_employers: list[str] = []
    relevant_skills: list[str] = []
    preferred_seniority: list[str] = []
    required_attributes: dict[str, list[str]] = {}
    excluded_attributes: dict[str, list[str]] = {}
    intended_ask: str = "Would you be open to a brief 15-minute conversation?"
    maximum_candidate_count: int = Field(default=8, ge=1, le=50)
    allowed_outreach_channels: list[str] = ["EMAIL", "LINKEDIN_ASSISTED"]
    daily_sending_limit: int = Field(default=5, ge=1, le=25)
    weekly_sending_limit: int = Field(default=20, ge=1, le=100)
    follow_up_wait_days: int = Field(default=7, ge=2, le=30)
    weights: dict[str, float] = DEFAULT_WEIGHTS


class DraftUpdateIn(BaseModel):
    subject: str = Field(max_length=200)
    body: str = Field(min_length=10, max_length=4000)


class ApprovalIn(BaseModel):
    channel: Literal["EMAIL", "LINKEDIN_ASSISTED"]
    contact_channel_id: str
    scheduled_at: str | None = None


class ReplyIn(BaseModel):
    outcome: Literal[
        "POSITIVE_REPLY", "NEUTRAL_REPLY", "DECLINED", "REFERRAL_OFFERED", "MEETING_SCHEDULED",
        "ADVICE_RECEIVED", "BOUNCED", "OPTED_OUT", "WRONG_PERSON", "EMPLOYMENT_DATA_OUTDATED"
    ]
    notes: str = Field(default="", max_length=1000)


class FollowUpIn(BaseModel):
    body: str = Field(min_length=10, max_length=2000)


class EvidenceIn(BaseModel):
    source_type: str = Field(min_length=2, max_length=80)
    source_url: str = Field(default="", max_length=1000)
    observed_value: str = Field(min_length=2, max_length=500)
    observed_at: str
    reliability_weight: float = Field(ge=0, le=1)
    extraction_method: str = Field(default="MANUAL", max_length=80)
    supports_current: bool = True
    notes: str = Field(default="", max_length=1000)


class ContactChannelIn(BaseModel):
    channel_type: Literal["EMAIL", "LINKEDIN_ASSISTED"]
    address_or_profile_url: str = Field(min_length=3, max_length=1000)
    source_type: str = Field(min_length=2, max_length=80)
    source_url: str = Field(default="", max_length=1000)
    verification_status: Literal["VERIFIED", "HIGH_CONFIDENCE", "POSSIBLE", "UNVERIFIED", "CONFLICTING", "DO_NOT_USE"] = "UNVERIFIED"
    confidence_score: int = Field(default=0, ge=0, le=100)
    professional_or_personal: Literal["PROFESSIONAL", "PERSONAL", "UNKNOWN"] = "UNKNOWN"
    permitted_use_status: Literal["PERMITTED", "NEEDS_REVIEW", "PROHIBITED"] = "NEEDS_REVIEW"
    risk_flags: list[str] = []


class ChannelReviewIn(BaseModel):
    verification_status: Literal["VERIFIED", "HIGH_CONFIDENCE", "POSSIBLE", "UNVERIFIED", "CONFLICTING", "DO_NOT_USE"]
    confidence_score: int = Field(ge=0, le=100)
    professional_or_personal: Literal["PROFESSIONAL", "PERSONAL", "UNKNOWN"]
    permitted_use_status: Literal["PERMITTED", "NEEDS_REVIEW", "PROHIBITED"]
    notes: str = Field(default="", max_length=1000)


class CandidateReviewIn(BaseModel):
    status: Literal["NEEDS_REVIEW", "APPROVED", "DISMISSED", "NEEDS_VERIFICATION", "PINNED", "DEFERRED", "REJECTED", "SUPPRESSED"]
    notes: str = Field(default="", max_length=500)


CANONICAL_FIELDS = [
    "first_name", "last_name", "name", "profile_url", "email", "company", "position",
    "connected_on", "school", "graduation_year", "location", "skills", "notes",
]


def _parse_csv(payload: ImportPreviewIn) -> tuple[list[dict[str, Any]], list[str]]:
    try:
        reader = csv.DictReader(io.StringIO(payload.csv_text.lstrip("\ufeff")))
        headers = reader.fieldnames or []
        rows = list(reader)
    except csv.Error as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}") from exc
    if not headers:
        raise HTTPException(status_code=400, detail="CSV must include a header row")
    if len(rows) > 5000:
        raise HTTPException(status_code=400, detail="Imports are limited to 5,000 contacts per file")
    normalized_headers = {header.lower().strip(): header for header in headers}
    mapping = payload.mapping or {field: normalized_headers[field] for field in CANONICAL_FIELDS if field in normalized_headers}
    parsed = []
    for row_number, row in enumerate(rows, start=2):
        raw = {field: row.get(source, "") for field, source in mapping.items() if source in headers}
        contact = normalize_contact(raw)
        contact["row_number"] = row_number
        parsed.append(contact)
    return parsed, headers


async def _audit(owner_id: str, action: str, entity_type: str, entity_id: str, metadata: dict | None = None) -> None:
    await get_db().audit_events.insert_one({
        "_id": str(uuid4()), "owner_id": owner_id, "action": action, "entity_type": entity_type,
        "entity_id": entity_id, "metadata": metadata or {}, "created_at": now_utc(),
    })


async def _relationship_event(owner_id: str, contact_id: str, event_type: str, title: str, metadata: dict | None = None) -> None:
    await get_db().relationship_events.insert_one({
        "_id": str(uuid4()), "owner_id": owner_id, "contact_id": contact_id, "event_type": event_type,
        "title": title, "metadata": metadata or {}, "created_at": now_utc(),
    })


async def _owned(collection: str, entity_id: str, owner_id: str) -> dict:
    item = await get_db()[collection].find_one({"_id": entity_id, "owner_id": owner_id})
    if not item:
        raise HTTPException(status_code=404, detail="Record not found")
    return item


async def _enforce_send_limits(owner_id: str, campaign: dict) -> None:
    db = get_db()
    day_ago = now_utc() - timedelta(days=1)
    week_ago = now_utc() - timedelta(days=7)
    base = {"owner_id": owner_id, "event_type": "SENT"}
    campaign_base = {**base, "campaign_id": campaign["_id"]}
    campaign_daily = await db.message_events.count_documents({**campaign_base, "created_at": {"$gte": day_ago}})
    campaign_weekly = await db.message_events.count_documents({**campaign_base, "created_at": {"$gte": week_ago}})
    account_daily = await db.message_events.count_documents({**base, "created_at": {"$gte": day_ago}})
    account_weekly = await db.message_events.count_documents({**base, "created_at": {"$gte": week_ago}})
    if campaign_daily >= campaign.get("daily_sending_limit", 5):
        raise HTTPException(status_code=429, detail="Campaign daily sending limit reached")
    if campaign_weekly >= campaign.get("weekly_sending_limit", 20):
        raise HTTPException(status_code=429, detail="Campaign weekly sending limit reached")
    if account_daily >= 25 or account_weekly >= 100:
        raise HTTPException(status_code=429, detail="Account outreach safety limit reached")


@router.post("/imports/preview")
async def preview_import(payload: ImportPreviewIn, current_user: dict = Depends(get_current_user)) -> dict:
    rows, headers = _parse_csv(payload)
    errors = []
    for row in rows:
        if not row["name"]:
            errors.append({"row": row["row_number"], "field": "name", "message": "A name is required"})
        if row["email"] and "@" not in row["email"]:
            errors.append({"row": row["row_number"], "field": "email", "message": "Email format is invalid"})
    return {
        "headers": headers,
        "suggested_mapping": {field: field for field in CANONICAL_FIELDS if field in headers},
        "row_count": len(rows),
        "valid_count": len(rows) - len({error["row"] for error in errors}),
        "errors": errors[:100],
        "sample": rows[:5],
        "consent_required": not payload.consent_confirmed,
    }


@router.post("/imports/commit")
async def commit_import(payload: ImportCommitIn, current_user: dict = Depends(get_current_user)) -> dict:
    if not payload.consent_confirmed:
        raise HTTPException(status_code=400, detail="Confirm that you are authorized to import this data")
    rows, headers = _parse_csv(payload)
    if any(not row["name"] for row in rows):
        raise HTTPException(status_code=400, detail="Every contact must include a name")
    db = get_db()
    import_id = str(uuid4())
    created = 0
    for row in rows:
        contact_id = str(uuid4())
        existing_query = {"owner_id": current_user["_id"]}
        if row["profile_url"]:
            existing_query["profile_url"] = row["profile_url"]
        elif row["email"]:
            existing_query["email"] = row["email"].lower()
        else:
            existing_query.update({"name": row["name"], "company": row["company"]})
        existing = await db.network_contacts.find_one(existing_query)
        document = {
            **row, "owner_id": current_user["_id"], "connection_import_id": import_id,
            "email": row["email"].lower(), "updated_at": now_utc(),
        }
        document.pop("row_number", None)
        if existing:
            await db.network_contacts.update_one({"_id": existing["_id"]}, {"$set": document})
            contact_id = existing["_id"]
        else:
            contact_id = str(uuid4())
            await db.network_contacts.insert_one({"_id": contact_id, **document, "created_at": now_utc()})
            created += 1
            await _relationship_event(current_user["_id"], contact_id, "IMPORTED", f"Imported from {payload.filename}")
        for channel in await ManualContactDiscoveryProvider().discover(document):
            await db.contact_channels.update_one(
                {"owner_id": current_user["_id"], "contact_id": contact_id, "channel_type": channel["channel_type"], "address_or_profile_url": channel["address_or_profile_url"]},
                {"$set": {**channel, "source_url": "", "discovered_at": now_utc(), "last_verified_at": None,
                    "discovery_method": "USER_IMPORT", "verification_provider": "NONE", "professional_or_personal": "UNKNOWN",
                    "risk_flags": ["REQUIRES_MANUAL_REVIEW"], "updated_at": now_utc()},
                 "$setOnInsert": {"_id": str(uuid4()), "owner_id": current_user["_id"], "contact_id": contact_id, "created_at": now_utc()}},
                upsert=True,
            )
    await db.connection_imports.insert_one({
        "_id": import_id, "owner_id": current_user["_id"], "filename": payload.filename,
        "headers": headers, "row_count": len(rows), "created_count": created,
        "consent_confirmed": True, "created_at": now_utc(),
    })
    await _audit(current_user["_id"], "IMPORT_COMMITTED", "ConnectionImport", import_id, {"row_count": len(rows)})
    return {"id": import_id, "row_count": len(rows), "created_count": created, "updated_count": len(rows) - created}


@router.post("/contacts/{contact_id}/evidence")
async def add_contact_evidence(contact_id: str, payload: EvidenceIn, current_user: dict = Depends(get_current_user)) -> dict:
    await _owned("network_contacts", contact_id, current_user["_id"])
    evidence = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "contact_id": contact_id,
        **payload.model_dump(), "created_at": now_utc(), "updated_at": now_utc(),
    }
    await get_db().contact_evidence.insert_one(evidence)
    await _relationship_event(current_user["_id"], contact_id, "EMPLOYMENT_VERIFIED", "Employment evidence added", {"source_type": payload.source_type})
    await _audit(current_user["_id"], "EVIDENCE_ADDED", "ContactEvidence", evidence["_id"])
    return serialize_doc(evidence)


@router.post("/contacts/{contact_id}/channels")
async def add_contact_channel(contact_id: str, payload: ContactChannelIn, current_user: dict = Depends(get_current_user)) -> dict:
    await _owned("network_contacts", contact_id, current_user["_id"])
    channel = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "contact_id": contact_id,
        **payload.model_dump(), "discovered_at": now_utc(), "last_verified_at": now_utc() if payload.verification_status == "VERIFIED" else None,
        "discovery_method": "MANUAL", "verification_provider": "MANUAL", "created_at": now_utc(), "updated_at": now_utc(),
    }
    await get_db().contact_channels.insert_one(channel)
    await _relationship_event(current_user["_id"], contact_id, "CONTACT_DISCOVERED", f"{payload.channel_type.replace('_', ' ').title()} channel added")
    await _audit(current_user["_id"], "CONTACT_CHANNEL_ADDED", "ContactChannel", channel["_id"])
    return serialize_doc(channel)


@router.patch("/channels/{channel_id}/review")
async def review_contact_channel(channel_id: str, payload: ChannelReviewIn, current_user: dict = Depends(get_current_user)) -> dict:
    channel = await _owned("contact_channels", channel_id, current_user["_id"])
    if payload.professional_or_personal == "PERSONAL" and payload.permitted_use_status == "PERMITTED":
        raise HTTPException(status_code=400, detail="Personal channels cannot be marked permitted in the MVP")
    updates = {**payload.model_dump(), "last_verified_at": now_utc(), "verification_provider": "MANUAL", "updated_at": now_utc()}
    await get_db().contact_channels.update_one({"_id": channel_id}, {"$set": updates})
    await _relationship_event(current_user["_id"], channel["contact_id"], "CONTACT_VERIFIED", f"Contact channel reviewed as {payload.verification_status}")
    await _audit(current_user["_id"], "CONTACT_CHANNEL_REVIEWED", "ContactChannel", channel_id, {"permitted_use_status": payload.permitted_use_status})
    return serialize_doc(await get_db().contact_channels.find_one({"_id": channel_id}))


@router.get("/campaigns")
async def list_campaigns(current_user: dict = Depends(get_current_user)) -> list[dict]:
    rows = await get_db().campaigns.find({"owner_id": current_user["_id"]}).sort("created_at", -1).to_list(length=100)
    return serialize_docs(rows)


@router.get("/contacts")
async def list_contacts(current_user: dict = Depends(get_current_user)) -> list[dict]:
    rows = await get_db().network_contacts.find({"owner_id": current_user["_id"]}, {"raw": 0}).sort("name", 1).to_list(length=5000)
    return serialize_docs(rows)


@router.get("/export")
async def export_network_data(current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    owner_id = current_user["_id"]
    collections = [
        "network_contacts", "connection_imports", "campaigns", "campaign_candidates", "contact_channels",
        "contact_evidence", "message_drafts", "message_approvals", "message_events", "replies",
        "campaign_followups", "relationship_events", "suppression_entries", "audit_events",
    ]
    export = {"exported_at": now_utc().isoformat(), "owner_id": owner_id, "schema_version": "network-v1", "data": {}}
    for name in collections:
        export["data"][name] = serialize_docs(await db[name].find({"owner_id": owner_id}).to_list(length=10000))
    await _audit(owner_id, "DATA_EXPORTED", "User", owner_id)
    return export


@router.delete("/imports/{import_id}")
async def delete_import(import_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    await _owned("connection_imports", import_id, current_user["_id"])
    contacts = await db.network_contacts.find({"owner_id": current_user["_id"], "connection_import_id": import_id}, {"_id": 1}).to_list(length=5000)
    contact_ids = [item["_id"] for item in contacts]
    if contact_ids:
        candidate_ids = [item["_id"] for item in await db.campaign_candidates.find(
            {"owner_id": current_user["_id"], "contact_id": {"$in": contact_ids}}, {"_id": 1}
        ).to_list(length=5000)]
        for name in [
            "contact_channels", "contact_evidence", "relationship_events", "suppression_entries",
            "message_drafts", "message_approvals", "message_events", "replies", "campaign_followups",
            "outreach_outcomes",
        ]:
            await db[name].delete_many({"owner_id": current_user["_id"], "contact_id": {"$in": contact_ids}})
        if candidate_ids:
            await db.campaign_candidates.delete_many({"owner_id": current_user["_id"], "_id": {"$in": candidate_ids}})
        await db.network_contacts.delete_many({"owner_id": current_user["_id"], "_id": {"$in": contact_ids}})
    await db.connection_imports.delete_one({"_id": import_id, "owner_id": current_user["_id"]})
    await _audit(current_user["_id"], "IMPORT_DELETED", "ConnectionImport", import_id, {"contacts_deleted": len(contact_ids)})
    return {"ok": True, "contacts_deleted": len(contact_ids)}


@router.post("/campaigns")
async def create_campaign(payload: CampaignIn, current_user: dict = Depends(get_current_user)) -> dict:
    campaign = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], **payload.model_dump(),
        "status": "DRAFT", "emergency_paused": False, "created_at": now_utc(), "updated_at": now_utc(),
    }
    await get_db().campaigns.insert_one(campaign)
    await _audit(current_user["_id"], "CAMPAIGN_CREATED", "Campaign", campaign["_id"])
    return serialize_doc(campaign)


@router.post("/campaigns/{campaign_id}/rank")
async def rank_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    campaign = await _owned("campaigns", campaign_id, current_user["_id"])
    contacts = await db.network_contacts.find({"owner_id": current_user["_id"]}).to_list(length=5000)
    scored = []
    for contact in contacts:
        required = campaign.get("required_attributes", {})
        excluded = campaign.get("excluded_attributes", {})
        fails_required = any(
            allowed and str(contact.get(field, "")).lower() not in {str(value).lower() for value in allowed}
            for field, allowed in required.items()
        )
        hits_excluded = any(
            blocked and str(contact.get(field, "")).lower() in {str(value).lower() for value in blocked}
            for field, blocked in excluded.items()
        )
        if fails_required or hits_excluded:
            continue
        evidence = await db.contact_evidence.find({"owner_id": current_user["_id"], "contact_id": contact["_id"]}).to_list(length=50)
        confidence = employment_confidence(evidence)
        score = score_candidate({**contact, "employment_confidence": confidence}, campaign, current_user)
        scored.append((contact, confidence, score))
    scored.sort(key=lambda item: item[2]["score"], reverse=True)
    limit = campaign.get("maximum_candidate_count", 8)
    await db.campaign_candidates.update_many(
        {"owner_id": current_user["_id"], "campaign_id": campaign_id},
        {"$set": {"active": False, "updated_at": now_utc()}},
    )
    for rank, (contact, confidence, score) in enumerate(scored[:limit], start=1):
        existing_candidate = await db.campaign_candidates.find_one({
            "owner_id": current_user["_id"], "campaign_id": campaign_id, "contact_id": contact["_id"],
        })
        scoring_fields = {
            "rank": rank, "relevance_score": score["score"],
            "score_breakdown": score["breakdown"], "score_components": score["components"],
            "algorithm_version": score["algorithm_version"], "employment_confidence": confidence,
            "active": True, "updated_at": now_utc(),
        }
        if existing_candidate:
            await db.campaign_candidates.update_one({"_id": existing_candidate["_id"]}, {"$set": scoring_fields})
        else:
            row = {
                "_id": str(uuid4()), "owner_id": current_user["_id"], "campaign_id": campaign_id,
                "contact_id": contact["_id"], **scoring_fields, "review_status": "NEEDS_REVIEW", "created_at": now_utc(),
            }
            await db.campaign_candidates.insert_one(row)
            await _relationship_event(current_user["_id"], contact["_id"], "SHORTLISTED", f"Shortlisted for {campaign['name']}", {"score": score["score"]})
    await db.campaigns.update_one({"_id": campaign_id}, {"$set": {"status": "ACTIVE", "updated_at": now_utc()}})
    await _audit(current_user["_id"], "CAMPAIGN_RANKED", "Campaign", campaign_id, {"candidate_count": min(limit, len(scored))})
    return {"campaign_id": campaign_id, "candidate_count": min(limit, len(scored))}


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    campaign = await _owned("campaigns", campaign_id, current_user["_id"])
    await get_db().campaigns.update_one({"_id": campaign_id}, {"$set": {"status": "PAUSED", "emergency_paused": True, "updated_at": now_utc()}})
    await get_db().campaign_followups.update_many(
        {"owner_id": current_user["_id"], "campaign_id": campaign_id, "status": {"$in": ["FOLLOW_UP_ELIGIBLE", "FOLLOW_UP_DRAFTED", "APPROVED"]}},
        {"$set": {"status": "PAUSED", "updated_at": now_utc()}},
    )
    await _audit(current_user["_id"], "CAMPAIGN_PAUSED", "Campaign", campaign_id)
    return serialize_doc(await get_db().campaigns.find_one({"_id": campaign_id}))


async def _candidate_detail(row: dict, owner_id: str) -> dict:
    db = get_db()
    contact = await db.network_contacts.find_one({"_id": row["contact_id"], "owner_id": owner_id})
    channels = await db.contact_channels.find({"contact_id": row["contact_id"], "owner_id": owner_id}).to_list(length=20)
    evidence = await db.contact_evidence.find({"contact_id": row["contact_id"], "owner_id": owner_id}).sort("observed_at", -1).to_list(length=20)
    drafts = await db.message_drafts.find({"campaign_candidate_id": row["_id"], "owner_id": owner_id}).sort("created_at", 1).to_list(length=10)
    timeline = await db.relationship_events.find({"contact_id": row["contact_id"], "owner_id": owner_id}).sort("created_at", -1).to_list(length=50)
    return serialize_doc({
        **row,
        "contact": serialize_doc(contact),
        "channels": [serialize_doc(item) for item in channels],
        "evidence": [serialize_doc(item) for item in evidence],
        "drafts": [serialize_doc(item) for item in drafts],
        "timeline": [serialize_doc(item) for item in timeline],
    })


@router.get("/campaigns/{campaign_id}/candidates")
async def campaign_candidates(campaign_id: str, current_user: dict = Depends(get_current_user)) -> list[dict]:
    await _owned("campaigns", campaign_id, current_user["_id"])
    rows = await get_db().campaign_candidates.find({"owner_id": current_user["_id"], "campaign_id": campaign_id, "active": {"$ne": False}}).sort("rank", 1).to_list(length=100)
    return [await _candidate_detail(row, current_user["_id"]) for row in rows]


@router.patch("/candidates/{candidate_id}/review")
async def review_candidate(candidate_id: str, payload: CandidateReviewIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    candidate = await _owned("campaign_candidates", candidate_id, current_user["_id"])
    await db.campaign_candidates.update_one({"_id": candidate_id}, {"$set": {
        "review_status": payload.status, "review_notes": payload.notes, "updated_at": now_utc(),
    }})
    if payload.status == "SUPPRESSED":
        await db.suppression_entries.update_one(
            {"owner_id": current_user["_id"], "contact_id": candidate["contact_id"]},
            {"$set": {"reason": "MANUAL_SUPPRESSION", "scope": "GLOBAL", "updated_at": now_utc()},
             "$setOnInsert": {"_id": str(uuid4()), "created_at": now_utc()}}, upsert=True,
        )
        await db.campaign_followups.update_many(
            {"owner_id": current_user["_id"], "contact_id": candidate["contact_id"], "status": {"$in": ["FOLLOW_UP_ELIGIBLE", "FOLLOW_UP_DRAFTED", "APPROVED"]}},
            {"$set": {"status": "PAUSED", "updated_at": now_utc()}},
        )
    await _relationship_event(current_user["_id"], candidate["contact_id"], payload.status, f"Candidate marked {payload.status.replace('_', ' ').lower()}", {"notes": payload.notes})
    await _audit(current_user["_id"], "CANDIDATE_REVIEWED", "CampaignCandidate", candidate_id, {"status": payload.status})
    return await _candidate_detail(await db.campaign_candidates.find_one({"_id": candidate_id}), current_user["_id"])


@router.post("/candidates/{candidate_id}/drafts")
async def generate_drafts(candidate_id: str, current_user: dict = Depends(get_current_user)) -> list[dict]:
    db = get_db()
    candidate = await _owned("campaign_candidates", candidate_id, current_user["_id"])
    campaign = await _owned("campaigns", candidate["campaign_id"], current_user["_id"])
    contact = await _owned("network_contacts", candidate["contact_id"], current_user["_id"])
    await db.message_drafts.delete_many({"owner_id": current_user["_id"], "campaign_candidate_id": candidate_id, "status": "DRAFTING"})
    created = []
    for variant in message_variants(contact, campaign, current_user):
        quality = review_message(variant["body"], variant["evidence_used"])
        draft = {
            "_id": str(uuid4()), "owner_id": current_user["_id"], "campaign_id": campaign["_id"],
            "campaign_candidate_id": candidate_id, "contact_id": contact["_id"], **variant,
            "quality_review": quality, "status": "NEEDS_REVIEW", "version": 1,
            "created_at": now_utc(), "updated_at": now_utc(),
        }
        await db.message_drafts.insert_one(draft)
        created.append(draft)
    await _relationship_event(current_user["_id"], contact["_id"], "MESSAGE_GENERATED", f"Generated two drafts for {campaign['name']}")
    await _audit(current_user["_id"], "DRAFTS_GENERATED", "CampaignCandidate", candidate_id, {"count": 2})
    return serialize_docs(created)


@router.patch("/drafts/{draft_id}")
async def update_draft(draft_id: str, payload: DraftUpdateIn, current_user: dict = Depends(get_current_user)) -> dict:
    draft = await _owned("message_drafts", draft_id, current_user["_id"])
    quality = review_message(payload.body, draft.get("evidence_used", []))
    await get_db().message_drafts.update_one({"_id": draft_id}, {"$set": {
        **payload.model_dump(), "quality_review": quality, "status": "NEEDS_REVIEW",
        "version": draft.get("version", 1) + 1, "updated_at": now_utc(),
    }})
    await _audit(current_user["_id"], "DRAFT_EDITED", "MessageDraft", draft_id, {"version": draft.get("version", 1) + 1})
    return serialize_doc(await get_db().message_drafts.find_one({"_id": draft_id}))


@router.post("/drafts/{draft_id}/approve")
async def approve_draft(draft_id: str, payload: ApprovalIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    draft = await _owned("message_drafts", draft_id, current_user["_id"])
    candidate = await _owned("campaign_candidates", draft["campaign_candidate_id"], current_user["_id"])
    campaign = await _owned("campaigns", draft["campaign_id"], current_user["_id"])
    if draft.get("quality_review", {}).get("status") == "BLOCKED":
        raise HTTPException(status_code=400, detail="Resolve the quality-review issues before approval")
    if campaign.get("emergency_paused"):
        raise HTTPException(status_code=409, detail="Account or campaign outreach is paused")
    if payload.channel not in campaign.get("allowed_outreach_channels", []):
        raise HTTPException(status_code=400, detail="This channel is not allowed by the campaign")
    if await db.suppression_entries.find_one({"owner_id": current_user["_id"], "contact_id": draft["contact_id"]}):
        raise HTTPException(status_code=409, detail="This contact is suppressed")
    if await db.message_events.find_one({"owner_id": current_user["_id"], "campaign_id": draft["campaign_id"], "contact_id": draft["contact_id"], "event_type": "SENT"}):
        raise HTTPException(status_code=409, detail="Duplicate send prevented for this campaign and contact")
    channel = await db.contact_channels.find_one({
        "_id": payload.contact_channel_id, "owner_id": current_user["_id"],
        "contact_id": draft["contact_id"], "channel_type": payload.channel,
        "permitted_use_status": "PERMITTED",
    })
    if not channel:
        raise HTTPException(status_code=400, detail="Select a permitted, stored contact channel before approval")
    if channel.get("verification_status") not in {"VERIFIED", "HIGH_CONFIDENCE"}:
        raise HTTPException(status_code=400, detail="Contact channel must be verified or high confidence before approval")
    if channel.get("professional_or_personal") != "PROFESSIONAL":
        raise HTTPException(status_code=400, detail="Only a reviewed professional contact channel can be approved")
    approval_status = "APPROVED"
    if payload.scheduled_at:
        try:
            scheduled_at = datetime.fromisoformat(payload.scheduled_at.replace("Z", "+00:00"))
            if scheduled_at.tzinfo is None:
                scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="scheduled_at must be an ISO-8601 timestamp") from exc
        if scheduled_at <= now_utc():
            raise HTTPException(status_code=400, detail="Scheduled sending time must be in the future")
        approval_status = "SCHEDULED"
    approval = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "draft_id": draft_id,
        "campaign_id": draft["campaign_id"], "campaign_candidate_id": candidate["_id"], "contact_id": draft["contact_id"],
        "channel": payload.channel, "contact_channel_id": channel["_id"], "approved_subject": draft["subject"],
        "approved_body": draft["body"], "scheduled_at": payload.scheduled_at, "status": approval_status, "created_at": now_utc(),
    }
    await db.message_approvals.insert_one(approval)
    await db.message_drafts.update_many({"campaign_candidate_id": candidate["_id"], "owner_id": current_user["_id"]}, {"$set": {"status": "REJECTED", "updated_at": now_utc()}})
    await db.message_drafts.update_one({"_id": draft_id}, {"$set": {"status": approval_status, "updated_at": now_utc()}})
    await db.campaign_candidates.update_one({"_id": candidate["_id"]}, {"$set": {"review_status": "APPROVED", "updated_at": now_utc()}})
    await _relationship_event(current_user["_id"], draft["contact_id"], "MESSAGE_APPROVED", "Exact recipient, channel, subject and body approved")
    await _audit(current_user["_id"], "MESSAGE_APPROVED", "MessageDraft", draft_id, {"channel": payload.channel})
    return serialize_doc(approval)


@router.post("/approvals/{approval_id}/send")
async def send_approved(approval_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    approval = await _owned("message_approvals", approval_id, current_user["_id"])
    if approval["status"] not in {"APPROVED", "SCHEDULED"}:
        raise HTTPException(status_code=409, detail="Only a currently approved or scheduled message can be sent")
    if approval.get("scheduled_at"):
        scheduled_at = datetime.fromisoformat(approval["scheduled_at"].replace("Z", "+00:00"))
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
        if now_utc() < scheduled_at:
            raise HTTPException(status_code=409, detail=f"Message is scheduled for {scheduled_at.isoformat()}")
    if await db.message_events.find_one({"owner_id": current_user["_id"], "approval_id": approval_id}):
        raise HTTPException(status_code=409, detail="This approval has already completed its send step")
    campaign = await _owned("campaigns", approval["campaign_id"], current_user["_id"])
    if campaign.get("emergency_paused"):
        raise HTTPException(status_code=409, detail="Campaign sending is paused")
    if approval["channel"] == "LINKEDIN_ASSISTED":
        event_type = "ASSISTED_SEND_READY"
        result_status = "APPROVED"
        provider_id = None
    else:
        await _enforce_send_limits(current_user["_id"], campaign)
        channel = await _owned("contact_channels", approval["contact_channel_id"], current_user["_id"])
        provider_result = await get_email_provider().send(
            recipient=channel["address_or_profile_url"], subject=approval["approved_subject"],
            body=approval["approved_body"], sender_id=current_user["_id"],
        )
        event_type = "SENT"
        result_status = provider_result["status"]
        provider_id = provider_result["provider_message_id"]
    event = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "campaign_id": approval["campaign_id"],
        "contact_id": approval["contact_id"], "draft_id": approval["draft_id"], "approval_id": approval_id,
        "event_type": event_type, "provider": "LINKEDIN_ASSISTED" if approval["channel"] == "LINKEDIN_ASSISTED" else "MOCK_EMAIL",
        "provider_message_id": provider_id, "created_at": now_utc(),
    }
    await db.message_events.insert_one(event)
    await db.message_approvals.update_one({"_id": approval_id}, {"$set": {"status": result_status, "sent_at": now_utc(), "provider_message_id": provider_id}})
    await db.message_drafts.update_one({"_id": approval["draft_id"]}, {"$set": {"status": result_status, "updated_at": now_utc()}})
    await _relationship_event(current_user["_id"], approval["contact_id"], event_type, "Email sent through mock provider" if event_type == "SENT" else "LinkedIn message ready for manual sending")
    await _audit(current_user["_id"], event_type, "MessageApproval", approval_id)
    return {
        "approval": serialize_doc(await db.message_approvals.find_one({"_id": approval_id})),
        "event": serialize_doc(event),
    }


@router.post("/approvals/{approval_id}/record-assisted-sent")
async def record_assisted_send(approval_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    approval = await _owned("message_approvals", approval_id, current_user["_id"])
    if approval["channel"] != "LINKEDIN_ASSISTED" or approval["status"] != "APPROVED":
        raise HTTPException(status_code=409, detail="Only a ready LinkedIn-assisted approval can be recorded as sent")
    ready = await db.message_events.find_one({"owner_id": current_user["_id"], "approval_id": approval_id, "event_type": "ASSISTED_SEND_READY"})
    if not ready:
        raise HTTPException(status_code=409, detail="Complete the assisted send preparation step first")
    if await db.message_events.find_one({"owner_id": current_user["_id"], "approval_id": approval_id, "event_type": "SENT"}):
        raise HTTPException(status_code=409, detail="This assisted message is already recorded as sent")
    campaign = await _owned("campaigns", approval["campaign_id"], current_user["_id"])
    await _enforce_send_limits(current_user["_id"], campaign)
    event = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "campaign_id": approval["campaign_id"],
        "contact_id": approval["contact_id"], "draft_id": approval["draft_id"], "approval_id": approval_id,
        "event_type": "SENT", "provider": "LINKEDIN_ASSISTED_MANUAL", "provider_message_id": None, "created_at": now_utc(),
    }
    await db.message_events.insert_one(event)
    await db.message_approvals.update_one({"_id": approval_id}, {"$set": {"status": "SENT", "sent_at": now_utc()}})
    await db.message_drafts.update_one({"_id": approval["draft_id"]}, {"$set": {"status": "SENT", "updated_at": now_utc()}})
    await _relationship_event(current_user["_id"], approval["contact_id"], "SENT", "LinkedIn message manually recorded as sent")
    await _audit(current_user["_id"], "ASSISTED_SEND_RECORDED", "MessageApproval", approval_id)
    return {"approval": serialize_doc(await db.message_approvals.find_one({"_id": approval_id})), "event": serialize_doc(event)}


@router.post("/candidates/{candidate_id}/reply")
async def record_reply(candidate_id: str, payload: ReplyIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    candidate = await _owned("campaign_candidates", candidate_id, current_user["_id"])
    reply = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "campaign_id": candidate["campaign_id"],
        "contact_id": candidate["contact_id"], "campaign_candidate_id": candidate_id, **payload.model_dump(), "created_at": now_utc(),
    }
    await db.replies.insert_one(reply)
    await db.campaign_followups.update_many({"owner_id": current_user["_id"], "contact_id": candidate["contact_id"], "status": {"$in": ["FOLLOW_UP_ELIGIBLE", "FOLLOW_UP_DRAFTED", "APPROVED"]}}, {"$set": {"status": "PAUSED", "updated_at": now_utc()}})
    if payload.outcome in {"OPTED_OUT", "BOUNCED"}:
        await db.suppression_entries.update_one(
            {"owner_id": current_user["_id"], "contact_id": candidate["contact_id"]},
            {"$set": {"reason": payload.outcome, "scope": "GLOBAL", "updated_at": now_utc()}, "$setOnInsert": {"_id": str(uuid4()), "created_at": now_utc()}}, upsert=True,
        )
    await _relationship_event(current_user["_id"], candidate["contact_id"], "REPLIED", f"Reply recorded: {payload.outcome}", {"notes": payload.notes})
    await _audit(current_user["_id"], "REPLY_RECORDED", "Reply", reply["_id"], {"outcome": payload.outcome})
    return serialize_doc(reply)


@router.post("/candidates/{candidate_id}/follow-up")
async def draft_follow_up(candidate_id: str, payload: FollowUpIn, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    candidate = await _owned("campaign_candidates", candidate_id, current_user["_id"])
    sent = await db.message_events.find_one({"owner_id": current_user["_id"], "campaign_id": candidate["campaign_id"], "contact_id": candidate["contact_id"], "event_type": "SENT"})
    if not sent:
        raise HTTPException(status_code=409, detail="A follow-up requires a successfully sent original email")
    campaign = await _owned("campaigns", candidate["campaign_id"], current_user["_id"])
    eligible_at = sent["created_at"] + timedelta(days=campaign.get("follow_up_wait_days", 7))
    if eligible_at.tzinfo is None:
        eligible_at = eligible_at.replace(tzinfo=timezone.utc)
    if now_utc() < eligible_at:
        raise HTTPException(status_code=409, detail=f"Follow-up is not eligible until {eligible_at.date().isoformat()}")
    if await db.replies.find_one({"owner_id": current_user["_id"], "campaign_id": candidate["campaign_id"], "contact_id": candidate["contact_id"]}):
        raise HTTPException(status_code=409, detail="Follow-up stopped because a reply or outcome was recorded")
    if await db.campaign_followups.find_one({"owner_id": current_user["_id"], "campaign_id": candidate["campaign_id"], "contact_id": candidate["contact_id"]}):
        raise HTTPException(status_code=409, detail="Only one follow-up is allowed by default")
    quality = review_message(payload.body, ["original approved outreach"])
    follow_up = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "campaign_id": candidate["campaign_id"],
        "contact_id": candidate["contact_id"], "campaign_candidate_id": candidate_id, "body": payload.body,
        "quality_review": quality, "status": "FOLLOW_UP_DRAFTED", "requires_separate_approval": True,
        "created_at": now_utc(), "updated_at": now_utc(),
    }
    await db.campaign_followups.insert_one(follow_up)
    await _relationship_event(current_user["_id"], candidate["contact_id"], "FOLLOW_UP_DRAFTED", "One follow-up drafted; separate approval required")
    return serialize_doc(follow_up)


@router.post("/follow-ups/{follow_up_id}/approve")
async def approve_follow_up(follow_up_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    follow_up = await _owned("campaign_followups", follow_up_id, current_user["_id"])
    if follow_up["status"] != "FOLLOW_UP_DRAFTED":
        raise HTTPException(status_code=409, detail="Only a drafted follow-up can be approved")
    if follow_up.get("quality_review", {}).get("status") == "BLOCKED":
        raise HTTPException(status_code=400, detail="Resolve quality-review issues before approval")
    if await db.replies.find_one({"owner_id": current_user["_id"], "campaign_id": follow_up["campaign_id"], "contact_id": follow_up["contact_id"]}):
        raise HTTPException(status_code=409, detail="Follow-up stopped because a reply or outcome was recorded")
    if await db.suppression_entries.find_one({"owner_id": current_user["_id"], "contact_id": follow_up["contact_id"]}):
        raise HTTPException(status_code=409, detail="Follow-up stopped because the contact is suppressed")
    await db.campaign_followups.update_one({"_id": follow_up_id}, {"$set": {"status": "APPROVED", "approved_at": now_utc(), "updated_at": now_utc()}})
    await _relationship_event(current_user["_id"], follow_up["contact_id"], "FOLLOW_UP_APPROVED", "Follow-up separately approved")
    await _audit(current_user["_id"], "FOLLOW_UP_APPROVED", "FollowUp", follow_up_id)
    return serialize_doc(await db.campaign_followups.find_one({"_id": follow_up_id}))


@router.post("/follow-ups/{follow_up_id}/send")
async def send_follow_up(follow_up_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    follow_up = await _owned("campaign_followups", follow_up_id, current_user["_id"])
    if follow_up["status"] != "APPROVED":
        raise HTTPException(status_code=409, detail="Follow-up requires its own approval before sending")
    campaign = await _owned("campaigns", follow_up["campaign_id"], current_user["_id"])
    if campaign.get("emergency_paused"):
        raise HTTPException(status_code=409, detail="Campaign sending is paused")
    await _enforce_send_limits(current_user["_id"], campaign)
    if await db.replies.find_one({"owner_id": current_user["_id"], "campaign_id": follow_up["campaign_id"], "contact_id": follow_up["contact_id"]}):
        raise HTTPException(status_code=409, detail="Follow-up stopped because a reply or outcome was recorded")
    if await db.suppression_entries.find_one({"owner_id": current_user["_id"], "contact_id": follow_up["contact_id"]}):
        raise HTTPException(status_code=409, detail="Follow-up stopped because the contact is suppressed")
    original = await db.message_approvals.find_one({
        "owner_id": current_user["_id"], "campaign_id": follow_up["campaign_id"],
        "contact_id": follow_up["contact_id"], "status": "SENT",
    })
    if not original:
        raise HTTPException(status_code=409, detail="Original approved delivery record is unavailable")
    channel = await _owned("contact_channels", original["contact_channel_id"], current_user["_id"])
    provider_result = await get_email_provider().send(
        recipient=channel["address_or_profile_url"], subject=f"Re: {original['approved_subject']}",
        body=follow_up["body"], sender_id=current_user["_id"],
    )
    event = {
        "_id": str(uuid4()), "owner_id": current_user["_id"], "campaign_id": follow_up["campaign_id"],
        "contact_id": follow_up["contact_id"], "follow_up_id": follow_up_id, "event_type": "SENT",
        "provider": "MOCK_EMAIL", "provider_message_id": provider_result["provider_message_id"], "created_at": now_utc(),
    }
    await db.message_events.insert_one(event)
    await db.campaign_followups.update_one({"_id": follow_up_id}, {"$set": {"status": "SENT", "sent_at": now_utc(), "updated_at": now_utc()}})
    await _relationship_event(current_user["_id"], follow_up["contact_id"], "FOLLOW_UP_SENT", "Approved follow-up sent through mock provider")
    await _audit(current_user["_id"], "FOLLOW_UP_SENT", "FollowUp", follow_up_id)
    return {
        "follow_up": serialize_doc(await db.campaign_followups.find_one({"_id": follow_up_id})),
        "event": serialize_doc(event),
    }


@router.get("/campaigns/{campaign_id}/analytics")
async def campaign_analytics(campaign_id: str, current_user: dict = Depends(get_current_user)) -> dict:
    await _owned("campaigns", campaign_id, current_user["_id"])
    db = get_db()
    query = {"owner_id": current_user["_id"], "campaign_id": campaign_id}
    reviewed = await db.campaign_candidates.count_documents(query)
    approved = await db.message_approvals.count_documents(query)
    sent = await db.message_events.count_documents({**query, "event_type": "SENT"})
    replies = await db.replies.find(query).to_list(length=1000)
    positive = sum(1 for row in replies if row["outcome"] in {"POSITIVE_REPLY", "REFERRAL_OFFERED", "MEETING_SCHEDULED", "ADVICE_RECEIVED"})
    meetings = sum(1 for row in replies if row["outcome"] == "MEETING_SCHEDULED")
    referrals = sum(1 for row in replies if row["outcome"] == "REFERRAL_OFFERED")
    bounces = sum(1 for row in replies if row["outcome"] == "BOUNCED")
    opt_outs = sum(1 for row in replies if row["outcome"] == "OPTED_OUT")
    return {
        "candidates_reviewed": reviewed, "candidates_approved": approved, "messages_sent": sent,
        "response_rate": round(100 * len(replies) / sent, 1) if sent else 0,
        "positive_response_rate": round(100 * positive / sent, 1) if sent else 0,
        "meetings_generated": meetings, "referrals_generated": referrals,
        "bounce_rate": round(100 * bounces / sent, 1) if sent else 0,
        "opt_out_rate": round(100 * opt_outs / sent, 1) if sent else 0,
    }


@router.get("/overview")
async def overview(current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    owner_id = current_user["_id"]
    return {
        "contacts": await db.network_contacts.count_documents({"owner_id": owner_id}),
        "campaigns": await db.campaigns.count_documents({"owner_id": owner_id}),
        "needs_review": await db.campaign_candidates.count_documents({"owner_id": owner_id, "review_status": "NEEDS_REVIEW"}),
        "sent": await db.message_events.count_documents({"owner_id": owner_id, "event_type": "SENT"}),
        "suppressed": await db.suppression_entries.count_documents({"owner_id": owner_id}),
    }


DEMO_NAMES = [
    "Avery Morgan", "Noor Hassan", "Priya Desai", "Eli Turner", "Sofia Reyes", "Marcus Liu",
    "Leila Haddad", "Jonah Brooks", "Nadia Rahman", "Theo Martin", "Amara Okafor", "Lucas Tremblay",
    "Zara Khan", "Miles Carter", "Anika Sharma", "Owen Park", "Mina Saleh", "Caleb Wright",
    "Iris Chen", "Ravi Mehta", "Talia Green", "Dylan Kim", "Farah Ali", "Nico Santos",
    "Ada Mensah", "Ben Novak", "Lina Costa", "Evan Clarke", "Maya Singh", "Sam Wilson",
]
DEMO_COMPANIES = ["Intuit", "Intuit", "RBC", "Shopify", "Microsoft", "Amazon", "Intuit", "Google", "RBC", "Ada Labs"]
DEMO_ROLES = ["Software Engineer", "Senior Software Engineer", "DevOps Engineer", "AI Platform Engineer", "Full-Stack Developer", "Machine Learning Engineer"]
DEMO_SKILLS = [["TypeScript", "React"], ["Python", "AI agents"], ["DevOps", "Kubernetes"], ["RAG", "platform engineering"], ["geospatial systems", "Python"]]


@router.post("/demo/seed")
async def seed_network_demo(current_user: dict = Depends(get_current_user)) -> dict:
    db = get_db()
    owner_id = current_user["_id"]
    demo_key = "network-v1"
    contact_ids = []
    for index, name in enumerate(DEMO_NAMES):
        first_name, last_name = name.split(" ", 1)
        company = DEMO_COMPANIES[index % len(DEMO_COMPANIES)]
        role = DEMO_ROLES[index % len(DEMO_ROLES)]
        raw = {
            "first_name": first_name, "last_name": last_name, "company": company, "position": role,
            "school": "York University" if index % 3 != 2 else "University of Toronto",
            "graduation_year": 2019 + (index % 7), "location": "Toronto, ON" if index % 4 else "Waterloo, ON",
            "skills": DEMO_SKILLS[index % len(DEMO_SKILLS)], "connected_on": f"202{index % 5}-0{(index % 8) + 1}-12",
            "notes": "Synthetic demo contact with shared professional context.",
            "profile_url": f"https://example.com/profiles/demo-{index + 1}",
        }
        contact = normalize_contact(raw)
        existing = await db.network_contacts.find_one({"owner_id": owner_id, "demo_key": f"{demo_key}-{index}"})
        document = {**contact, "owner_id": owner_id, "demo_key": f"{demo_key}-{index}", "updated_at": now_utc()}
        if existing:
            await db.network_contacts.update_one({"_id": existing["_id"]}, {"$set": document})
            contact_id = existing["_id"]
        else:
            contact_id = str(uuid4())
            await db.network_contacts.insert_one({"_id": contact_id, **document, "created_at": now_utc()})
            await _relationship_event(owner_id, contact_id, "IMPORTED", "Imported from synthetic demo dataset")
        contact_ids.append(contact_id)
        if index < 12:
            source_type = "OFFICIAL_COMPANY" if index % 4 == 0 else "PUBLIC_BIO" if index % 4 in {1, 2} else "IMPORTED_PROFILE"
            supports = index % 4 != 2
            observed_days = 700 if index % 4 == 3 else 40
            reliability = [0.95, 0.75, 0.75, 0.4][index % 4]
            await db.contact_evidence.update_one(
                {"owner_id": owner_id, "contact_id": contact_id, "demo_key": demo_key},
                {"$set": {"source_type": source_type, "source_url": f"https://example.com/evidence/{index + 1}",
                    "observed_value": f"{role} at {company}", "observed_at": now_utc() - timedelta(days=observed_days),
                    "reliability_weight": reliability, "extraction_method": "SYNTHETIC_DEMO",
                    "supports_current": supports, "notes": "Synthetic evidence; never a live claim.", "updated_at": now_utc()},
                 "$setOnInsert": {"_id": str(uuid4()), "created_at": now_utc()}}, upsert=True,
            )
        channel_type = "EMAIL" if index % 5 != 0 else "LINKEDIN_ASSISTED"
        address = f"{first_name.lower()}.{last_name.lower()}@demo.invalid" if channel_type == "EMAIL" else raw["profile_url"]
        await db.contact_channels.update_one(
            {"owner_id": owner_id, "contact_id": contact_id, "demo_key": demo_key},
            {"$set": {"channel_type": channel_type, "address_or_profile_url": address, "source_type": "SYNTHETIC_DEMO",
                "source_url": "https://example.com/demo-source", "discovered_at": now_utc(), "last_verified_at": now_utc(),
                "discovery_method": "SYNTHETIC_DEMO", "verification_provider": "MOCK", "verification_status": "VERIFIED",
                "confidence_score": 99, "professional_or_personal": "PROFESSIONAL", "permitted_use_status": "PERMITTED",
                "risk_flags": ["SYNTHETIC_ONLY"], "updated_at": now_utc()}, "$setOnInsert": {"_id": str(uuid4()), "created_at": now_utc()}}, upsert=True,
        )
    campaign = await db.campaigns.find_one({"owner_id": owner_id, "demo_key": demo_key})
    campaign_data = CampaignIn(
        name="Intuit software-engineering networking",
        objective="learn how engineers build reliable AI and platform systems at Intuit",
        target_companies=["Intuit"], target_roles=["software engineering", "platform engineering"],
        preferred_locations=["Toronto", "Waterloo"], relevant_schools=["York University"],
        graduation_year_range=[2019, 2025], shared_employers=["RBC"],
        relevant_skills=["Python", "TypeScript", "AI agents", "DevOps", "platform engineering"],
        intended_ask="Would you be open to a brief 15-minute conversation about your engineering path?",
        maximum_candidate_count=8,
    ).model_dump()
    if campaign:
        await db.campaigns.update_one({"_id": campaign["_id"]}, {"$set": {**campaign_data, "updated_at": now_utc()}})
        campaign_id = campaign["_id"]
    else:
        campaign_id = str(uuid4())
        await db.campaigns.insert_one({"_id": campaign_id, "owner_id": owner_id, "demo_key": demo_key, **campaign_data, "status": "DRAFT", "emergency_paused": False, "created_at": now_utc(), "updated_at": now_utc()})
    result = await rank_campaign(campaign_id, current_user)
    rows = await db.campaign_candidates.find({"owner_id": owner_id, "campaign_id": campaign_id, "active": True}).sort("rank", 1).to_list(length=8)
    for row in rows:
        if not await db.message_drafts.find_one({"owner_id": owner_id, "campaign_candidate_id": row["_id"]}):
            await generate_drafts(row["_id"], current_user)
    return {"ok": True, "contacts": len(contact_ids), "campaign_id": campaign_id, **result}
