# Cordial networking automation product specification

## Product promise

Cordial helps a user find a small number of relevant people in an authorized professional network, verify what is known about them, prepare grounded outreach, and remember the relationship. AI prepares and recommends; the user reviews and authorizes.

## End-to-end MVP

1. Import a LinkedIn connections export or generic CSV with explicit user consent and column mapping.
2. Preserve raw values while normalizing company, title, school, skills, location, dates, role family, and seniority.
3. Create a campaign with an objective, hard filters, ranking preferences, intended ask, channel policy, shortlist size, and sending limits.
4. Rank a bounded candidate set using deterministic weighted scoring. Semantic and LLM reranking are optional adapters, never prerequisites.
5. Attach discrete employment evidence and label the result `VERIFIED_CURRENT`, `LIKELY_CURRENT`, `POSSIBLY_OUTDATED`, or `UNVERIFIED`.
6. Attach a professional contact channel with source, verification, confidence, permitted-use status, and risk flags.
7. Generate exactly two substantively different drafts: shared context and direct relevance. Show their grounding evidence and quality review.
8. Let the user edit and approve the exact recipient, channel, subject, and body. Shortlisting never implies approval.
9. Send email through a configured provider (mock by default), or use LinkedIn assisted mode: copy, open, manually send, and record.
10. Record delivery, replies, outcomes, one separately approved follow-up, suppression, and a relationship timeline.
11. Report restrained analytics focused on positive conversations, meetings, referrals, bounce rate, opt-outs, and time saved.

## Non-goals and prohibitions

- No LinkedIn scraping, browser bots, automated DMs, connection automation, credential collection, CAPTCHA bypass, or access-control evasion.
- No private, leaked, gated, or sensitive-trait data.
- No guessed email is called verified; pattern-generated addresses must remain `POSSIBLE` until verified.
- No live send without exact human approval. No bulk approval.
- No invented shared history, employment, achievements, openings, mutual contacts, or interests.
- No optimization for volume sent.

## MVP acceptance criteria

- A signed-in user can seed 30 synthetic people and an example campaign.
- A user can preview and commit an authorized CSV, create and rank a campaign, and see a transparent score breakdown.
- The approval dashboard shows employment and contact confidence, warnings, two editable drafts, evidence, and timeline history.
- The API blocks unsupported drafts, suppressed recipients, duplicate sends, and daily-limit breaches.
- Mock email returns a provider message ID. LinkedIn remains assisted/manual.
- Recording a reply, bounce, or opt-out stops pending follow-up automation; bounce and opt-out create suppression.

## Future production work

Provider adapters will add embeddings, LLM drafting/reranking, email OAuth, reply webhooks, permitted enrichment, email verification, jurisdiction policies, background queues, encrypted field storage, and PostgreSQL only if scale or relational reporting justifies migration.
