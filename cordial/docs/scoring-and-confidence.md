# Scoring and confidence

## Candidate ranking

The deterministic v1 score is 0–100:

```text
25% target company + 15% role + 15% shared experience + 10% education
+ 10% career trajectory + 10% skills + 5% location
+ 5% relationship strength + 5% evidence freshness
```

Weights are stored on the campaign and remain editable. Each component is retained as a 0–1 value and a human-readable points entry. Hard constraints should run before scoring when marked required; the MVP UI treats supplied criteria as preferences and exposes the breakdown.

Career trajectory v1 averages role relevance, skill overlap, and graduation-range proximity. It is intentionally simple and explainable. It does not yet perform edit-distance comparison over ordered employment sequences; when histories are imported, v2 will encode role family, industry, seniority, company type, duration, and transition type and compare aligned sequences.

Semantic retrieval and LLM reranking are optional future adapters. They may rerank only a bounded deterministic candidate set and must not receive the full contact database.

## Employment confidence

Evidence is scored by source reliability and recency. Recent user confirmation, official-company material, or a personal professional site can produce `VERIFIED_CURRENT`. Recent but non-conclusive professional evidence produces `LIKELY_CURRENT`. Conflicting evidence produces `POSSIBLY_OUTDATED`. Missing, old, or weak evidence produces `UNVERIFIED`.

Each label displays its numerical confidence, reasoning, observation date, source, and conflicts. Imported employment alone never verifies current employment.

## Contact confidence

Contact channels use `VERIFIED`, `HIGH_CONFIDENCE`, `POSSIBLE`, `UNVERIFIED`, `CONFLICTING`, and `DO_NOT_USE`. A separate `permitted_use_status` gates approval. Generated company-pattern emails are `POSSIBLE` and cannot be represented as verified.
