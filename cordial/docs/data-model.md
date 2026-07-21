# Data model

All networking collections include `_id`, `owner_id`, and timestamps.

| Collection | Purpose and important fields |
| --- | --- |
| `network_contacts` | Raw and normalized identity, employment, education, skills, location, import provenance |
| `connection_imports` | Filename, headers, mapping, consent, counts, quality report |
| `campaigns` | Objective, targets, weights, ask, shortlist/channel/limit/follow-up policy, status |
| `campaign_candidates` | Campaign/contact link, rank, component scores, explanations, employment confidence, review status |
| `contact_evidence` | Source type/URL, observed value/time, reliability, extraction method, support/conflict flag |
| `contact_channels` | Address/profile, source, discovery and verification fields, confidence, professional/personal, permitted use, risk flags |
| `message_drafts` | Strategy, subject/body, evidence used, quality review, state, version |
| `message_approvals` | Immutable approved recipient/channel/subject/body snapshot and schedule |
| `message_events` | State transition, provider, provider message ID, timestamp |
| `replies` | Campaign/contact link, outcome, notes, timestamp |
| `campaign_followups` | One follow-up, quality review, separate approval state |
| `relationship_events` | Contact timeline events from import through outcomes |
| `suppression_entries` | Global or campaign scope and reason |
| `provider_connections` | OAuth/provider metadata only; secrets belong in encrypted secret storage |
| `compliance_rules` | Jurisdiction, identification/unsubscribe policy, limits |
| `outreach_outcomes` | Meeting, referral, advice, decline, wrong person, or data correction |
| `audit_events` | Actor-owned append-only action history and safe metadata |

Message states are `DRAFTING`, `NEEDS_REVIEW`, `APPROVED`, `SCHEDULED`, `SENDING`, `SENT`, `DELIVERY_FAILED`, `BOUNCED`, `REPLIED`, `FOLLOW_UP_ELIGIBLE`, `FOLLOW_UP_DRAFTED`, `PAUSED`, `REJECTED`, `OPTED_OUT`, and `SUPPRESSED`. The MVP records transitions as events rather than silently overwriting history.

MongoDB schema changes are additive. Index creation in `app/db.py` is the MVP migration mechanism; production deployments should version index/data migrations and run them separately from web startup.
