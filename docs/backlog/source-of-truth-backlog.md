# Source-Of-Truth Backlog

## Critical

### Cross-repo frontend schema parity gate

Problem: The backend mirrors the frontend post contract, but there is no single shared CI gate spanning both repos.  
Impact: Schema drift can be detected late and publication failures can surface only when a repo is updated independently.  
Recommendation: Add a coordinated contract check that validates `news_collector/contracts/frontend_schema.py` against `src/content/config.ts` on every cross-repo contract change.  
Affected repo(s): frontend, backend  
Suggested priority: critical

## High

### Remove render-time legacy title repair from `PostLayout.astro`

Problem: [`src/components/template/PostLayout.astro`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/components/template/PostLayout.astro) still sanitizes malformed legacy title strings during rendering.  
Impact: Presentation code is compensating for source-data defects, which encourages more compatibility logic in the wrong layer.  
Recommendation: Fix malformed titles in source content or in the publishing pipeline, then delete the render-time repair path.  
Affected repo(s): frontend, backend  
Suggested priority: high

### Unify search index permalink generation with shared helpers

Problem: [`src/pages/search.json.js`](/home/carlos/VS_Code_Projects/noticiencias/noticiencias/src/pages/search.json.js) still has local fallback URL logic when `permalink` is absent.  
Impact: Search results can drift from canonical routed URLs if permalink generation rules change.  
Recommendation: Reuse shared permalink generation from `src/utils/blog.ts` or a smaller shared helper instead of local fallback strings.  
Affected repo(s): frontend  
Suggested priority: high

### Enforce tag quality for frontend-only manual edits

Problem: `npm run validate:content` validates shape and hero/image requirements, but not the full backend tag normalization contract.  
Impact: Manual edits in the frontend repo can bypass canonical tag hygiene until review catches them.  
Recommendation: Add a frontend tag validation check or a publish-time preflight that reuses the backend taxonomy rules.  
Affected repo(s): frontend, backend  
Suggested priority: high

## Medium

### Reduce generic helper sprawl in `src/utils/utils.ts`

Problem: `src/utils/utils.ts` remains a generic utility surface while the governance rules prefer domain-named helpers.  
Impact: New unrelated helpers can accumulate there and erode module clarity.  
Recommendation: Keep new helpers local or move them into domain files; backfill existing generic helpers only when actively touched.  
Affected repo(s): frontend  
Suggested priority: medium

### Add documentation drift checks for active governance docs

Problem: The repo has link checking in CI but not targeted drift checks for the active governance stack.  
Impact: README and docs can become stale again even when code contracts change.  
Recommendation: Add a lightweight docs check covering active file paths, commands, and authority-order references.  
Affected repo(s): frontend  
Suggested priority: medium
