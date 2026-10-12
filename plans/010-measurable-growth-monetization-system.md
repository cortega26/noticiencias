# Plan 010: Noticiencias measurable growth + monetization operating system

> **Executor instructions:** Read docs/strategy/2026-10-03-strategic-operating-system-v1.md and, in the portfolio-control-plane repository, advisor-plans/spike-reports/006-distribution-findings.md first. This is a bounded direction/measurement plan, not authorization to deploy ads, spend money, change billing or redesign unrelated systems. Preserve current in-flight UX work.

## Status

- **Priority:** P1
- **Effort:** M for measurement/design spike; future builds separately scoped
- **Risk:** MEDIUM — Goodhart, UX degradation, platform dependence, premature infrastructure
- **Depends on:** Plan 006 evidence; current Noticiencias UX/editorial hardening must not be interrupted
- **Category:** direction + measurement
- **Added:** 2026-10-03 from owner-approved strategy discussion
- **Origin:** moved 2026-10-04 from the portfolio control plane (`advisor-plans/008`) per its DEC-013 (product decisions live in the owning repository); the control plane keeps only a pointer.

## Objective

Turn the Noticiencias strategy into a periodically reviewed operating system that can:

- build scientific/editorial seriousness over time;
- generate revenue as early as practical;
- detect material distribution/product changes;
- scale only winning formats;
- stop losing initiatives quickly;
- avoid premature B2B/knowledge-graph/platform work.

## Strategic contract

North Star: **Returning Engaged Readers — 28 days (RER28).**

Supporting scorecard:

- authority/quality
- audience
- distribution
- owned audience
- revenue
- efficiency

AdSense is an immediate **controlled monetization experiment**, never a presumed Google News/Search ranking advantage.

## Step 0 — Recon + baseline

Before implementation:

- record current frontend/collector HEAD and dirty-state summary;
- confirm current GA4/GSC/newsletter state from live project evidence;
- identify available analytics events and current 7/28-day return, read depth, second-article and newsletter metrics;
- record current Search/News/Discover/referral/direct shares where available;
- record current monetization baseline as zero only if verified; otherwise unknown;
- confirm current UX wave status so this plan does not collide with in-flight work.

Unknown values remain unknown.

## Step 1 — Measurement contract

Design the smallest additive analytics contract required to measure:

- RER28
- second-article rate
- article 50/90 completion
- primary-source clicks
- newsletter impression/start/submit
- 7/28-day return
- branded/direct share
- revenue per 1,000 engaged sessions
- revenue per returning reader
- format: news / state_of_evidence / paper_vs_hype / experiment

No PII in analytics events. Version metric definitions so changes do not silently corrupt trends.

## Step 2 — Quality gates

Specify automated/manual evidence for:

- primary-source coverage >=95% when applicable
- evidence-type completeness >=95% when applicable
- 0 fabricated sources/metadata
- 0 materially unsupported claims target
- correction disclosure policy

A failing quality gate prevents **volume scaling**, not necessarily all publication.

## Step 3 — AdSense experiment design

Design a reversible, low-density experiment:

- no placement inside Evidence Passport / sources / limitations / corrections;
- measure Page RPM and revenue per 1,000 engaged sessions;
- compare read completion, second-article rate, newsletter CVR, return and Core Web Vitals;
- define rollback/reduction trigger for sustained material harm; roughly 10% is only the initial working threshold;
- document that AdSense does not confer Google News/Search ranking advantage.

No account, billing or deployment action occurs in this spike unless separately authorized.

## Step 4 — 90-day editorial experiment portfolio

Design bounded experiments:

- Evidence Layer v1
- newsletter product v1
- internal Radar v0
- 3 State-of-the-Evidence pages
- 5–10 Paper-vs-Hype items

For each define hypothesis, metrics, cheapest valid implementation, sample/window, success condition, kill/rework condition and maximum engineering/editorial budget.

Do not propose generic Evidence API, full knowledge graph, expert-network build or B2B product.

## Step 5 — Review cadence and triggers

Prepare:

- weekly tactical review template
- monthly business review scorecard
- quarterly thesis review
- event-driven trigger rules

Initial triggers are hypotheses:

- Search/Discover +/-30% sustained about 2 weeks
- format +30% vs relevant baseline across >=10 comparable pieces -> scale candidate
- persistent -20% -> reduce/rework/kill
- material ad engagement/CWV harm -> reduce
- quality-gate failure -> freeze volume scaling

## Step 6 — Capacity discipline

Represent planned work under 70/20/10:

- 70% core/proven
- 20% adjacent
- 10% experiments

Every large initiative must displace something or explicitly consume available capacity. Agents do not create infinite portfolio capacity.

## Step 7 — 90-day gate

At the end produce a decision memo with one outcome per experiment:

- scale
- hold
- redesign
- kill

No B2B/API/graph build is promoted solely from technical feasibility. Promotion requires observed consumer value or independent customer-demand evidence.

## Deliverables

1. Baseline/unknowns table.
2. Versioned metric/event contract.
3. Quality-gate specification.
4. AdSense controlled-experiment design.
5. 90-day experiment registry.
6. Weekly/monthly/quarterly review templates.
7. 90-day decision memo template.
8. Bounded follow-up build plans only for selected, owner-approved implementations.

## STOP conditions

Stop and report rather than improvise if:

- current UX work would be overwritten/conflicted;
- required baseline is inaccessible and the plan would require invented numbers;
- analytics would collect PII;
- monetization requires account/billing action not explicitly authorized;
- a proposed change degrades scientific-quality guardrails;
- a large platform/B2B build appears necessary before the 90-day gate.

## Done criteria

- [ ] strategy review read and cited
- [ ] plan 006 evidence reconciled
- [ ] baseline known/unknown explicitly recorded
- [ ] metrics and definitions versioned
- [ ] AdSense treated as measured revenue experiment, not ranking lever
- [ ] editorial experiments have success + kill criteria
- [ ] review cadence operationalized
- [ ] quality gates block volume scaling on failure
- [ ] 70/20/10 capacity rule represented
- [ ] no premature B2B/graph/API build
- [ ] follow-up work remains bounded and separately approvable
