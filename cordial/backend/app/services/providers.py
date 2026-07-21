"""Replaceable provider boundaries.

The local implementations are deliberately non-networked. Production adapters must
preserve the same approval, provenance, and minimum-data contracts.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import uuid4


class EmailProvider(Protocol):
    name: str

    async def send(self, *, recipient: str, subject: str, body: str, sender_id: str) -> dict[str, Any]: ...


class ContactDiscoveryProvider(Protocol):
    name: str

    async def discover(self, contact: dict[str, Any]) -> list[dict[str, Any]]: ...


class LanguageModelProvider(Protocol):
    name: str

    async def generate(self, *, instructions: str, grounded_fields: dict[str, Any]) -> str: ...


class EmbeddingProvider(Protocol):
    name: str

    async def embed(self, text: str) -> list[float]: ...


@dataclass
class MockEmailProvider:
    name: str = "MOCK_EMAIL"

    async def send(self, *, recipient: str, subject: str, body: str, sender_id: str) -> dict[str, Any]:
        # Never connects to a mail server. The digest makes local runs traceable
        # without placing message content in provider logs.
        digest = hashlib.sha256(f"{sender_id}:{recipient}:{subject}:{body}".encode()).hexdigest()[:12]
        return {"provider_message_id": f"mock-{digest}-{uuid4()}", "status": "SENT", "network_request_made": False}


@dataclass
class ManualContactDiscoveryProvider:
    name: str = "MANUAL_OR_IMPORTED"

    async def discover(self, contact: dict[str, Any]) -> list[dict[str, Any]]:
        channels = []
        if contact.get("email"):
            channels.append({
                "channel_type": "EMAIL", "address_or_profile_url": contact["email"],
                "verification_status": "UNVERIFIED", "permitted_use_status": "NEEDS_REVIEW",
                "source_type": "USER_IMPORT", "confidence_score": 0,
            })
        if contact.get("profile_url"):
            channels.append({
                "channel_type": "LINKEDIN_ASSISTED", "address_or_profile_url": contact["profile_url"],
                "verification_status": "UNVERIFIED", "permitted_use_status": "NEEDS_REVIEW",
                "source_type": "USER_IMPORT", "confidence_score": 0,
            })
        return channels


@dataclass
class MockLanguageModelProvider:
    name: str = "MOCK_LLM"

    async def generate(self, *, instructions: str, grounded_fields: dict[str, Any]) -> str:
        return "Mock generation is disabled; use the deterministic grounded drafting service."


@dataclass
class LocalTokenEmbeddingProvider:
    """Small dependency-free fallback for retrieval tests, not semantic claims."""

    dimensions: int = 64
    name: str = "LOCAL_TOKEN_HASH"

    async def embed(self, text: str) -> list[float]:
        vector = [0.0] * self.dimensions
        tokens = re.findall(r"[a-z0-9+#.]+", text.lower())
        for token in tokens:
            index = int(hashlib.sha256(token.encode()).hexdigest()[:8], 16) % self.dimensions
            vector[index] += 1.0
        magnitude = sum(value * value for value in vector) ** 0.5 or 1.0
        return [value / magnitude for value in vector]


def get_email_provider() -> EmailProvider:
    return MockEmailProvider()
