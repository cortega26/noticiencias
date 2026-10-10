# Search SEO program — implementation ledger

**Source of task specifications:** [BACKLOG.md](BACKLOG.md). **Goal and baseline:** [README.md](README.md). **Operating contract:** [AGENT_HANDOFF.md](AGENT_HANDOFF.md).

This ledger is the durable state store for the execution program, not a dashboard or an extra approval gate. Update only the entries actually affected by each merged PR or verified account/editorial action. Never mark a task DONE because a PR was opened, a job started or an external account action was merely proposed.

## Current program state

- **Recorded:** 2026-10-10.
- **State:** PLAN_PROPOSED.
- **Execution branch/PR:** To be linked after the documentation PR opens.
- **Implementation work completed by this documentation PR:** None. All SEO work items below remain unstarted.
- **Known external blockers:** Production backend editorial queue/runtime availability is unverified; Chrome UX Report integration lacks an API key; actual sitemap submission still needs a current GSC recheck. These are limitations, not proof the website is broken.
- **Already tracked elsewhere:** [Cadence #233](https://github.com/cortega26/noticiencias/issues/233); [Discover #234](https://github.com/cortega26/noticiencias/issues/234). Do not reset or duplicate their progress here.

## Work-item status

Valid values: NOT_STARTED, IN_PROGRESS, BLOCKED, DONE, NOT_NEEDED. Do not use DONE without exact evidence.

- [ ] SEO-01 — Reproducible baseline and tracking — **NOT_STARTED**
- [ ] SEO-02 — Sitemap submission diagnostics — **NOT_STARTED**
- [ ] SEO-03 — Canonical/indexability/structured-data triage — **NOT_STARTED**
- [ ] SEO-04 — Reader intent and opportunity matrix — **NOT_STARTED**
- [ ] SEO-05 — Existing topic hub pilot — **NOT_STARTED**
- [ ] SEO-06 — Editorial internal-link improvement — **NOT_STARTED**
- [ ] SEO-07 — Original evergreen/synthesis article pilot — **NOT_STARTED**
- [ ] SEO-08 — Selective legacy improvements — **NOT_STARTED**
- [ ] SEO-09 — Title and snippet relevance pilot — **NOT_STARTED**
- [ ] SEO-10 — Discover/image eligibility triage — **NOT_STARTED**
- [ ] SEO-11 — Structured metadata and author identity validation — **NOT_STARTED**
- [ ] SEO-12 — Mobile UX and performance evidence — **NOT_STARTED**
- [ ] SEO-13 — Earned authority and distribution — **NOT_STARTED**
- [ ] SEO-14 — Coordinate cadence/Discover — **NOT_STARTED**
- [ ] SEO-15 — Evaluate, decide and prevent drift — **NOT_STARTED**

## Original baseline and measurement dates

**Search Console:** sc-domain:noticiencias.com; settled through 2026-10-06.

- **28-day window:** 21 clicks, 121 impressions, 17.36% CTR, mean position 16.62.
- **90-day window:** 55 clicks, 648 impressions, 8.49% CTR, mean position 19.07.
- **Brand query share:** 20 of 21 clicks in the 28-day site total were attributed to “noticiencias” or “noticiencia” in the query report. Exact query decomposition is incomplete because of anonymization/aggregation.
- **Outlier:** 19 MIT/AI topic clicks occurred on 2026-08-22 and 2026-08-23.
- **10-page technical audit:** 10 indexable, 0 critical, 0 high, 2 medium, 18 low scanner observations. No code defects established solely by these counts.
- **Sitemap at observation:** 77 public URLs; sitemap linked in robots; no submitted entry returned by connected GSC property's list.
- **Index inspections at observation:** four PASS samples; do not extrapolate to all URLs.

These numbers are **historical evidence**. Use fresh, same-length, settled windows when assessing an intervention, preserving this snapshot for comparison.

## Incremental execution record template

Append entries below as work is actually completed:

### YYYY-MM-DD — SEO-XX — TASK NAME

- **Status:** NOT_STARTED / IN_PROGRESS / BLOCKED / DONE / NOT_NEEDED
- **Baseline ref and date range:** ...
- **Hypothesis / reader benefit:** ...
- **Changed paths and URLs / account action:** ...
- **PR and commit SHA (if code):** ...
- **CI / manual smoke / validation:** ...
- **Publication source approval / scientific review (if relevant):** ...
- **Search Console evidence and latency caveats:** ...
- **Result and counter-evidence:** ...
- **Cost, regression risk, decision:** ...
- **Next smallest action / blocker owner:** ...

## Checkpoint log

Use settled data and stable cohorts. An unanswered metric is **UNAVAILABLE**, not zero.

### Day 30 / week 4 — PENDING

- Search non-brand impressions/clicks, distinct relevant queries and landing URLs:
- Top 2 topic hypotheses and observed performance:
- Editorial originality and corrections:
- Indexation samples and sitemap state:
- Engineering/editorial hours:
- **Decision:** CONTINUE / ADJUST / STOP / INSUFFICIENT DATA
- Evidence:

### Day 60 / week 8 — PENDING

- Same metrics and comparable cohorts:
- Pilot hub/article results:
- Confounders, outliers, negative results:
- **Decision:** CONTINUE / ADJUST / STOP / INSUFFICIENT DATA
- Evidence:

### Day 90 / week 12 — PENDING

- Same metrics and comparable cohorts:
- Sustainable non-branded visibility versus August spike:
- Editorial cost and factual integrity:
- Technical defects fixed versus suspected-only warnings:
- **Decision:** CONTINUE / ADJUST / STOP / INSUFFICIENT DATA
- Recommended follow-up:
- Evidence:
