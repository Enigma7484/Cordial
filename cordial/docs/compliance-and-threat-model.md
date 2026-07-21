# Compliance and threat model

## Protected assets

Authorized contact exports, professional email addresses, profile URLs, OAuth tokens, drafts, relationship history, and user identity are sensitive. The system minimizes disclosure and retains source provenance.

## Controls in the MVP

- Authenticated owner scoping on every networking route and collection index.
- Explicit consent before import; CSV size/row validation and raw-value retention.
- Bounded shortlist generation and no full-database LLM transmission.
- Source, observed time, extraction method, reliability, and conflicts for evidence.
- Exact-message approval, immutable approval snapshot, duplicate-send detection, daily limits, and emergency-pause checks.
- Professional/permitted channel gating, global suppression, bounce/opt-out suppression, and reply-based follow-up cancellation.
- Deterministic drafts use stored facts only; quality review blocks unsupported or coercive messages.
- LinkedIn is assisted/manual. No scraping or simulated interaction exists.
- Synthetic demo addresses use the reserved `.invalid` domain and cannot reach real recipients.

## Threats and production hardening

| Threat | MVP treatment | Production requirement |
| --- | --- | --- |
| Cross-tenant access | Owner predicate and owned-object loader | Repository-enforced scoping, integration tests, monitoring |
| CSV formula injection | No spreadsheet export in MVP | Prefix dangerous cells on export and test all formats |
| Prompt injection in public text | No automatic retrieval; deterministic mock | Strip instructions, isolate content, schema-constrain extraction, cite source |
| Token/field disclosure | No live OAuth; minimum draft fields | Envelope encryption, secret manager, rotation, least scopes |
| Duplicate or mass outreach | Per-campaign duplicate and daily limit | Transactional idempotency, weekly/account limits, queue leases |
| Fabricated enrichment | Synthetic/mock clearly flagged | Provider provenance, confidence policy, user confirmation |
| Sensitive-trait inference | Not modeled | Provider filtering, prompt policies, audit sampling |
| Unauthorized LinkedIn automation | Assisted mode only | Enable API adapter only with written platform approval and scopes |
| Abuse of public email | Permitted-use gate and suppression | Jurisdiction rules, unsubscribe processing, legal review, retention schedules |

The MVP is not legal advice. Deployment owners must configure identification, lawful basis, retention, and unsubscribe behavior for their jurisdictions before live sending.
