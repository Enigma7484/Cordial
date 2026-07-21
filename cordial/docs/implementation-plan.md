# Implementation plan

## Phase 1 — foundation

- Preserve React/FastAPI/MongoDB and existing community functionality.
- Define the cumulative product, architecture, collections, states, scoring, confidence, compliance, and indexes.
- Add owner-scoped domain services and routes.

## Phase 2 — import

- CSV preview, suggested mapping, validation, explicit consent, deduplication, raw and normalized storage.
- UI file picker and quality preview.

## Phase 3 — campaigns and ranking

- Campaign builder, editable criteria/weights, deterministic shortlist, score breakdown, evidence confidence.

## Phase 4 — approval and outreach

- Two grounded variants, quality review, editing, exact approval, mock email, LinkedIn assisted mode, duplicate/suppression/limits.

## Phase 5 — memory and analytics

- Relationship timeline, reply outcomes, one separately approved follow-up, stopping rules, restrained analytics.

## Phase 6 — production integrations

- OAuth email providers, webhook reply/bounce handling, permitted enrichment, email verification, embedding/LLM adapters, background queue, encryption and retention jobs.

## Verification gates

Every material phase must pass backend unit tests, Python compilation, frontend TypeScript build, responsive review, and documentation checks. Live providers remain disabled until credentials, scopes, webhook security, and jurisdiction policies are configured.
