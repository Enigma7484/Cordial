# Cordial

Cordial is a human-approved networking intelligence and relationship-memory application. It imports professional connections the user is authorized to process, creates narrow networking campaigns, ranks a small candidate set, keeps employment and contact evidence visible, prepares two grounded outreach strategies, and records what happens next.

The safety rule is simple: **AI prepares and recommends; the user reviews and authorizes.**

## Working MVP

- Existing community profiles, connections, rooms, signals, and follow-ups remain intact.
- CSV preview, consent, validation, normalization, deduplication, and import-quality reporting.
- Campaign creation with target companies, roles, schools, skills, locations, ask, shortlist size, channels, and sending limit.
- Deterministic 0–100 ranking with a stored component and points breakdown.
- Employment evidence with `VERIFIED_CURRENT`, `LIKELY_CURRENT`, `POSSIBLY_OUTDATED`, and `UNVERIFIED` states.
- Contact channels with provenance, verification, permitted-use status, confidence, and risk flags.
- Exactly two grounded message strategies, quality review, exact-copy editing, and explicit approval.
- Mock email sending and LinkedIn assisted/manual mode. No automated LinkedIn interaction.
- Duplicate prevention, daily limit, suppression, reply stops, one-follow-up policy, audit events, relationship history, and campaign analytics.
- Idempotent synthetic demo with 30 fictional people. Demo email addresses use `.invalid` and cannot reach real recipients.

## Architecture

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: FastAPI with domain service and provider boundaries
- Database: MongoDB 7 through Motor
- Authentication: development email OTP and JWT
- Delivery: mock provider by default; live OAuth adapters are future integrations
- Background work: synchronous local adapter; durable records are ready for a queue-backed worker

The pre-existing stack is retained deliberately. Networking collections are additive and every document is owner-scoped. See [architecture](docs/architecture.md) and [data model](docs/data-model.md).

## Local setup

Requirements: Docker, Python 3.11+, and Node.js 20+.

The fastest path runs the complete stack:

```bash
cd cordial
docker compose up -d --build
```

Open `http://127.0.0.1:5174`. The API is available at `http://127.0.0.1:8010`, and MongoDB at port 27017. Use `docker compose logs -f backend frontend` to follow startup. `docker compose down` stops the application without deleting its database volume.

For a host-based development loop, start only MongoDB with `docker compose up -d mongo`, then run:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8010
```

In a second terminal:

```bash
cd cordial/frontend
cp .env.example .env
npm ci
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174`, sign in with any development email, and use the returned development OTP. Open **Campaigns** and choose **Build demo workspace**.

For frontend-only visual work when MongoDB is unavailable, run `npm run mock-api` from `cordial/frontend` in a separate terminal. It serves only synthetic fixture responses on port 8010 and never sends network outreach; do not run it beside the real backend.

## Verification

```bash
cd cordial/backend
PYTHONPATH=. python3 -m unittest discover -s tests -v
python3 -m compileall -q app

cd ../frontend
npm run build
```

## CSV import

Use [the sample/template](samples/connections-template.csv), or a LinkedIn connections export. Exact matching headers are mapped automatically in the MVP. The API also accepts an explicit mapping for other formats. Raw input values remain alongside normalized fields.

The import endpoint is JSON-based: the browser reads the selected CSV locally and submits its text for preview or commit. Files are limited to 2 MB and 5,000 rows.

## Scoring

Deterministic v1 uses target company (25%), role (15%), shared experience (15%), education (10%), career trajectory (10%), skills (10%), location (5%), relationship strength (5%), and evidence freshness (5%). Campaign weights are persisted and editable through the API. Each candidate stores the full breakdown and algorithm version. See [scoring and confidence](docs/scoring-and-confidence.md).

## Privacy and data-source restrictions

- Import requires an explicit authorization confirmation.
- Every networking query includes the authenticated owner's ID.
- Imported employment is never presented as verified without separate evidence.
- No sensitive-trait inference is modeled.
- No LinkedIn scraping, browser automation, credential sharing, CAPTCHA bypass, automated connection requests, or unauthorized DMs.
- No private, leaked, or gated data sources.
- Public professional contact details still require a stored permitted-use decision.
- The full contacts database is never sent to an LLM. The current fallback uses no LLM at all.
- Every real send requires approval of the exact recipient, channel, subject, and body.

See the [compliance and threat model](docs/compliance-and-threat-model.md).

## API highlights

- `POST /network/imports/preview`, `POST /network/imports/commit`
- `GET/POST /network/campaigns`
- `GET /network/contacts`, `POST /network/contacts/{id}/evidence`, `POST /network/contacts/{id}/channels`
- `PATCH /network/channels/{id}/review`, `PATCH /network/candidates/{id}/review`
- `POST /network/campaigns/{id}/rank`
- `POST /network/campaigns/{id}/pause`
- `GET /network/campaigns/{id}/candidates`
- `POST /network/candidates/{id}/drafts`
- `PATCH /network/drafts/{id}`
- `POST /network/drafts/{id}/approve`
- `POST /network/approvals/{id}/send`
- `POST /network/approvals/{id}/record-assisted-sent`
- `POST /network/candidates/{id}/reply`
- `POST /network/candidates/{id}/follow-up`
- `POST /network/follow-ups/{id}/approve`, `POST /network/follow-ups/{id}/send`
- `GET /network/campaigns/{id}/analytics`
- `GET /network/export`, `DELETE /network/imports/{id}`
- `POST /network/demo/seed`

## Current limitations

- Gmail/Outlook OAuth, inbox reply detection, bounces, and webhooks are adapter-ready but not configured.
- LinkedIn is assisted/manual only.
- External enrichment, email verification, embeddings, and LLM reranking/drafting are not live.
- MongoDB changes are additive startup index creation rather than versioned migrations.
- The UI automatically maps exact CSV headers; custom mappings are exposed by the API but need a richer drag-and-drop mapper.
- Follow-up eligibility can be validated and drafted by the API, but the current dashboard focuses on first-message approval.
- Scheduled jobs and jurisdiction-specific unsubscribe rendering need a production queue and configured compliance rules.

## Production path

Add encrypted OAuth token storage, Gmail/Outlook provider adapters, signed webhook processing, an idempotent worker queue, configurable retention/export/deletion, provider provenance monitoring, custom CSV mapping UI, ordered career-sequence comparison, embeddings over the bounded shortlist, and an optional grounded LLM adapter. Complete a jurisdiction-specific legal and deliverability review before enabling live delivery.

## Product documents

- [Product specification](docs/product-spec.md)
- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Scoring and confidence](docs/scoring-and-confidence.md)
- [Compliance and threat model](docs/compliance-and-threat-model.md)
- [Implementation plan](docs/implementation-plan.md)
