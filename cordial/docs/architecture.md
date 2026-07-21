# Architecture

## Runtime

- React, TypeScript, Vite, and Tailwind provide the authenticated workspace.
- FastAPI owns authentication, authorization, validation, domain services, and provider boundaries.
- MongoDB stores existing community features and the networking domain. Every networking document has `owner_id`; compound indexes lead with it.
- Provider behavior is local and deterministic by default. Live services must implement the same boundaries without changing campaign logic.

## Data flow

```text
authorized CSV -> preview/mapping -> normalized contact + raw snapshot
                                      |
campaign criteria -> hard constraints + weighted scoring -> bounded shortlist
                                      |
employment evidence -> confidence ----+
contact evidence -> permitted channel -+
                                      v
two grounded drafts -> quality review -> exact human approval
                                      |
                     mock email / LinkedIn assisted mode
                                      |
events -> replies -> suppression/follow-up stopping -> relationship timeline + analytics
```

## Service boundaries

- Import service: parsing, validation, mapping, normalization, consent, and import audit.
- Matching service: transparent scoring and breakdowns. `algorithm_version` makes results reproducible.
- Evidence service: independent observations and confidence aggregation; conflicts remain visible.
- Draft service: deterministic fallback and future LLM adapter with minimal, retrieved fields only.
- Approval service: immutable approved recipient/channel/subject/body snapshot.
- Delivery service: mock provider now; Gmail/Outlook OAuth adapters later. Raw passwords are never accepted.
- Policy service: suppression, duplicate detection, cooldowns, daily limits, reply stops, and jurisdiction settings.

## Background jobs

The local MVP executes synchronously. Delivery and verification are shaped as durable records (`message_approvals`, `message_events`, evidence) so a worker queue can claim work later without changing UI contracts. Production should use idempotency keys, leases, retry policies, and a dead-letter queue.

## Tenant isolation

All reads and writes include the authenticated user's `owner_id`. Related objects are loaded through an owned lookup before mutation. Database indexes support these predicates. Production defense-in-depth should add repository objects that make unscoped reads impossible and automated cross-tenant tests.
