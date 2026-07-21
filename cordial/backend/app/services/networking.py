from __future__ import annotations

import re
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any


COMPANY_ALIASES = {
    "royal bank of canada": "RBC",
    "rbc royal bank": "RBC",
    "rbc": "RBC",
    "intuit canada": "Intuit",
    "intuit inc": "Intuit",
    "intuit": "Intuit",
    "shopify inc": "Shopify",
    "shopify": "Shopify",
    "microsoft canada": "Microsoft",
    "microsoft": "Microsoft",
    "amazon web services": "Amazon",
    "amazon": "Amazon",
    "google canada": "Google",
    "google": "Google",
}

SCHOOL_ALIASES = {
    "york university": "York University",
    "york u": "York University",
    "university of toronto": "University of Toronto",
    "uoft": "University of Toronto",
    "toronto metropolitan university": "Toronto Metropolitan University",
    "ryerson university": "Toronto Metropolitan University",
    "university of waterloo": "University of Waterloo",
}

ROLE_RULES = [
    ("ai_ml_engineering", ("machine learning", "ml engineer", "ai engineer", "artificial intelligence")),
    ("platform_engineering", ("platform", "site reliability", "sre", "devops", "cloud engineer")),
    ("software_engineering", ("software", "full stack", "full-stack", "backend", "frontend", "developer")),
    ("product", ("product manager", "product lead")),
    ("data", ("data scientist", "data engineer", "analytics")),
    ("research", ("research", "scientist")),
    ("founder", ("founder", "co-founder")),
]

SENIORITY_RULES = [
    ("executive", ("chief", "vp ", "vice president", "head of")),
    ("director", ("director",)),
    ("manager", ("manager", "lead")),
    ("senior", ("senior", "staff", "principal")),
    ("entry", ("junior", "associate", "new grad")),
    ("student", ("intern", "co-op", "student")),
]

DEFAULT_WEIGHTS = {
    "target_company_match": 0.25,
    "role_relevance": 0.15,
    "shared_experience": 0.15,
    "education_overlap": 0.10,
    "career_trajectory_similarity": 0.10,
    "skill_similarity": 0.10,
    "location_relevance": 0.05,
    "relationship_strength": 0.05,
    "data_freshness": 0.05,
}


def _clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _tokens(value: str | None) -> set[str]:
    return set(re.findall(r"[a-z0-9+#.]+", (value or "").lower()))


def normalize_company(value: str | None) -> str:
    cleaned = _clean(value)
    key = re.sub(r"[,\.]", "", cleaned.lower())
    return COMPANY_ALIASES.get(key, cleaned)


def normalize_school(value: str | None) -> str:
    cleaned = _clean(value)
    return SCHOOL_ALIASES.get(cleaned.lower(), cleaned)


def normalize_title(value: str | None) -> dict[str, str]:
    cleaned = _clean(value)
    lowered = cleaned.lower()
    role_family = "other"
    for family, terms in ROLE_RULES:
        if any(term in lowered for term in terms):
            role_family = family
            break
    seniority = "mid"
    for level, terms in SENIORITY_RULES:
        if any(term in lowered for term in terms):
            seniority = level
            break
    return {"title": cleaned, "role_family": role_family, "seniority": seniority}


def normalize_contact(raw: dict[str, Any]) -> dict[str, Any]:
    title = normalize_title(str(raw.get("position") or raw.get("title") or ""))
    skills = raw.get("skills", [])
    if isinstance(skills, str):
        skills = [part.strip() for part in re.split(r"[,;|]", skills) if part.strip()]
    graduation_year = raw.get("graduation_year")
    try:
        graduation_year = int(graduation_year) if graduation_year else None
    except (TypeError, ValueError):
        graduation_year = None
    return {
        "first_name": _clean(str(raw.get("first_name") or "")),
        "last_name": _clean(str(raw.get("last_name") or "")),
        "name": _clean(str(raw.get("name") or "")) or _clean(f"{raw.get('first_name', '')} {raw.get('last_name', '')}"),
        "profile_url": _clean(str(raw.get("profile_url") or "")),
        "email": _clean(str(raw.get("email") or "")),
        "company": normalize_company(str(raw.get("company") or "")),
        "position": title["title"],
        "role_family": title["role_family"],
        "seniority": title["seniority"],
        "school": normalize_school(str(raw.get("school") or "")),
        "graduation_year": graduation_year,
        "location": _clean(str(raw.get("location") or "")),
        "skills": sorted(set(skills), key=str.lower),
        "connected_on": _clean(str(raw.get("connected_on") or "")),
        "notes": _clean(str(raw.get("notes") or "")),
        "raw": raw,
    }


def employment_confidence(evidence: list[dict[str, Any]]) -> dict[str, Any]:
    if not evidence:
        return {"status": "UNVERIFIED", "confidence": 0, "reason": "No employment evidence has been reviewed."}
    now = datetime.now(timezone.utc)
    supporting = 0.0
    conflicting = 0.0
    recent_first_party = False
    for item in evidence:
        observed_at = item.get("observed_at")
        if isinstance(observed_at, str):
            try:
                observed_at = datetime.fromisoformat(observed_at.replace("Z", "+00:00"))
            except ValueError:
                observed_at = None
        if isinstance(observed_at, datetime) and observed_at.tzinfo is None:
            # MongoDB stores UTC timestamps but Motor returns naive datetimes by
            # default. Attach UTC before comparing them with aware timestamps.
            observed_at = observed_at.replace(tzinfo=timezone.utc)
        age_days = (now - observed_at).days if observed_at else 9999
        recency = 1.0 if age_days <= 120 else 0.7 if age_days <= 365 else 0.3
        weight = float(item.get("reliability_weight", 0.5)) * recency
        if item.get("supports_current", True):
            supporting += weight
            if item.get("source_type") in {"USER_CONFIRMED", "OFFICIAL_COMPANY", "PERSONAL_WEBSITE"} and age_days <= 180:
                recent_first_party = True
        else:
            conflicting += weight
    if conflicting >= 0.5:
        return {"status": "POSSIBLY_OUTDATED", "confidence": round(min(95, 45 + conflicting * 30)), "reason": "Recent evidence conflicts with the imported employment record."}
    if recent_first_party and supporting >= 0.8:
        return {"status": "VERIFIED_CURRENT", "confidence": round(min(99, 75 + supporting * 12)), "reason": "Recent first-party evidence supports the current role."}
    if supporting >= 0.55:
        return {"status": "LIKELY_CURRENT", "confidence": round(min(90, 50 + supporting * 30)), "reason": "Recent professional evidence supports the role, but it is not fully verified."}
    return {"status": "UNVERIFIED", "confidence": round(min(49, supporting * 60)), "reason": "The available evidence is too old or weak to confirm the role."}


def _list_similarity(candidate: list[str], targets: list[str]) -> float:
    if not targets:
        return 0.5
    left = {item.lower() for item in candidate if item}
    right = {item.lower() for item in targets if item}
    if not right:
        return 0.5
    return len(left & right) / len(right)


def score_candidate(contact: dict[str, Any], campaign: dict[str, Any], user_profile: dict[str, Any] | None = None) -> dict[str, Any]:
    weights = {**DEFAULT_WEIGHTS, **campaign.get("weights", {})}
    target_companies = [normalize_company(item) for item in campaign.get("target_companies", [])]
    target_roles = [item.lower() for item in campaign.get("target_roles", [])]
    schools = [normalize_school(item) for item in campaign.get("relevant_schools", [])]
    shared_employers = [normalize_company(item) for item in campaign.get("shared_employers", [])]
    relevant_skills = campaign.get("relevant_skills", [])
    locations = campaign.get("preferred_locations", [])
    profile = user_profile or {}

    company = normalize_company(contact.get("company"))
    company_match = 1.0 if target_companies and company.lower() in {item.lower() for item in target_companies} else 0.0
    title_text = f"{contact.get('position', '')} {contact.get('role_family', '')}".lower()
    role_relevance = max((SequenceMatcher(None, role, title_text).ratio() if role else 0 for role in target_roles), default=0.0)
    if any(role in title_text or title_text in role for role in target_roles):
        role_relevance = 1.0
    shared_experience = 1.0 if company.lower() in {item.lower() for item in shared_employers} else 0.0
    if profile.get("company") and normalize_company(profile.get("company")).lower() == company.lower():
        shared_experience = 1.0
    education_overlap = 1.0 if schools and normalize_school(contact.get("school")).lower() in {item.lower() for item in schools} else 0.0
    skill_similarity = _list_similarity(contact.get("skills", []), relevant_skills)
    location_relevance = 1.0 if locations and any(item.lower() in contact.get("location", "").lower() for item in locations) else 0.0
    relationship_strength = min(1.0, 0.35 + (0.25 if contact.get("connected_on") else 0) + (0.25 if contact.get("notes") else 0))

    year_range = campaign.get("graduation_year_range") or []
    grad_match = 0.5
    if len(year_range) == 2 and contact.get("graduation_year"):
        grad_match = 1.0 if year_range[0] <= contact["graduation_year"] <= year_range[1] else 0.0
    trajectory = (role_relevance + skill_similarity + grad_match) / 3

    freshness = float(contact.get("employment_confidence", {}).get("confidence", 0)) / 100
    components = {
        "target_company_match": company_match,
        "role_relevance": role_relevance,
        "shared_experience": shared_experience,
        "education_overlap": education_overlap,
        "career_trajectory_similarity": trajectory,
        "skill_similarity": skill_similarity,
        "location_relevance": location_relevance,
        "relationship_strength": relationship_strength,
        "data_freshness": freshness,
    }
    breakdown = []
    score = 0.0
    labels = {
        "target_company_match": f"target company: {company}",
        "role_relevance": f"role relevance: {contact.get('position', 'unknown')}",
        "shared_experience": "shared employer or experience",
        "education_overlap": f"shared education: {contact.get('school', 'unknown')}",
        "career_trajectory_similarity": "career trajectory similarity",
        "skill_similarity": "relevant skill overlap",
        "location_relevance": f"location relevance: {contact.get('location', 'unknown')}",
        "relationship_strength": "relationship context",
        "data_freshness": "employment evidence freshness",
    }
    for key, value in components.items():
        points = round(100 * weights[key] * value, 1)
        score += points
        if points >= 1:
            breakdown.append({"key": key, "label": labels[key], "points": points})
    if freshness < 0.35:
        breakdown.append({"key": "freshness_warning", "label": "employment information needs verification", "points": 0})
    breakdown.sort(key=lambda item: item["points"], reverse=True)
    return {"score": round(score, 1), "components": components, "breakdown": breakdown, "algorithm_version": "deterministic-v1"}


def message_variants(contact: dict[str, Any], campaign: dict[str, Any], sender: dict[str, Any]) -> list[dict[str, Any]]:
    first = contact.get("first_name") or contact.get("name", "there").split(" ")[0]
    sender_name = sender.get("name") or sender.get("handle") or ""
    school = contact.get("school")
    role = contact.get("position") or "work"
    company = contact.get("company") or "your team"
    ask = campaign.get("intended_ask") or "Would you be open to a brief 15-minute conversation?"
    objective = campaign.get("objective") or "learn more about this area"
    evidence = [item for item in [school, role, company] if item]
    sender_school = normalize_school(sender.get("school")) if sender.get("school") else ""
    if school and sender_school and normalize_school(school) == sender_school:
        context = f"our shared {school} background"
    elif school and school in campaign.get("relevant_schools", []):
        context = f"your {school} background"
    else:
        context = f"your work in {role}"
    return [
        {
            "strategy": "SHARED_CONTEXT",
            "subject": f"A quick note about {company}",
            "body": f"Hi {first},\n\nI came across your profile while looking to {objective.rstrip('.')}, and {context} stood out. I’m reaching out specifically to learn from your perspective as {role} at {company}.\n\n{ask}\n\nNo pressure at all if the timing isn’t right.\n\nBest,\n{sender_name}",
            "evidence_used": evidence,
        },
        {
            "strategy": "DIRECT_RELEVANCE",
            "subject": f"Question about {role} at {company}",
            "body": f"Hi {first},\n\nMy goal is to {objective.rstrip('.')}, and I noticed your relevant experience as {role} at {company}. {ask}\n\nThanks for considering it,\n{sender_name}",
            "evidence_used": evidence,
        },
    ]


def review_message(body: str, evidence: list[str]) -> dict[str, Any]:
    issues = []
    lowered = body.lower()
    if len(body) > 1000:
        issues.append("Message is too long for first outreach.")
    if any(phrase in lowered for phrase in ("i know you are busy", "final attempt", "haven't heard back", "urgent", "you owe", "must reply")):
        issues.append("Message contains pressuring or guilt-based language.")
    if not evidence:
        issues.append("Message has no stored evidence grounding.")
    if any(phrase in lowered for phrase in ("we met", "our mutual friend", "as you remember", "when we spoke")):
        issues.append("Message contains familiarity that is not supported by the selected evidence.")
    if any(term in lowered for term in ("your age", "your religion", "your ethnicity", "your disability", "your politics", "your health")):
        issues.append("Message references sensitive personal information.")
    if any(phrase in lowered for phrase in ("impressive background", "pick your brain", "dear sir or madam")):
        issues.append("Message contains generic or overly flattering language.")
    if body.count("!") > 2:
        issues.append("Message uses excessive praise or enthusiasm.")
    return {"status": "BLOCKED" if issues else "PASSED", "issues": issues}
