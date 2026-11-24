# Intermittent axe `target-size` failure in the accessibility e2e suite

> Status: **Resolved 2026-09-23** — deterministic helper fix + load verification
> Recorded: 2026-09-18 (found while building plan 009 phase 1)
> Resolved in: `tests/playwright/accessibility.test.ts` (`checkA11y`)

## Resolution (2026-09-23)

`checkA11y` no longer measures geometry mid-layout: it waits for `load` and
`document.fonts.ready`, injects the animation-killing style, scrolls to the
bottom to fire lazy content, waits for the body height to stabilise across
animation frames, then returns to the top and waits for stability again
before running axe. The failing nodes were topic pills measured while lazy
images/fonts were still changing the page height ("partially obscured",
"insufficient space to closest neighbors").

Verification: `npx playwright test tests/playwright/accessibility.test.ts`
8 consecutive runs under CPU load (4 busy `yes` processes) → 8/8 clean,
14/14 audits each. Hypotheses 1 and 2 in this file were the cause; hypothesis
3 (real overlap) is ruled out by the same runs.

The original record follows.

## Symptom

`tests/playwright/accessibility.test.ts` occasionally fails one or two audits with the axe rule `target-size` (WCAG 2.2, 24px minimum touch target). Which page fails varies between runs:

- `article page has no a11y violations` (desktop-1280) on `/2026-01-15-cursos-en-linea-abren-puertas-a-nuevas-carreras/`
- `blog archive page has no a11y violations` (mobile-375)

Captured failure (article page):

```text
id: target-size   impact: serious
node: <a href="/temas/cursos-en-linea/" class="group inline-flex items-center text-xs font-semibold px-3 py-1 rounded-full ...">cursos en línea</a>
Target has insufficient size because it is partially obscured (smallest space is 107px by 13.7px, should be at least 24px by 24px)
Target has insufficient space to its closest neighbors. Safe clickable space has a diameter of 16.8px instead of at least 24px.
```

The element is a topic pill. The phrase "partially obscured" means something was painted over part of it at the moment axe measured.

## What is known

| Build under test                                                                      | Local runs | Runs with a failure |
| ------------------------------------------------------------------------------------- | ---------- | ------------------- |
| Plan 009 phase 1 branch, first 13 runs (machine busy with other builds and test runs) | ~13        | ~3                  |
| Same branch, rerun on an idle machine                                                 | 10         | 0                   |
| Commit before phase 1 (`53c8f87`), built in a throwaway worktree                      | 10         | 0                   |

- The failing pages are built with `googleAnalytics.id: null`, so they contain **no consent banner, no footer consent control and no gtag.js**. Phase 1 adds nothing visible to them, which argues against it being the cause.
- The failure rate correlated with machine load, not with the code under test.
- 3/13 against 0/10 is **not statistically distinguishable** at this sample size, so a small effect of phase 1 is not ruled out either. Treat "pre-existing" as the working hypothesis, not a finding.

## Hypotheses (none tested)

1. **Scroll position races layout.** `checkA11y` calls `window.scrollTo(0, document.body.scrollHeight)` right after `domcontentloaded`, then waits a fixed 100 ms before running axe. If images or fonts land after the scroll, the page height changes and the final scroll position differs run to run, which could leave a pill sitting under the sticky header when axe measures it. That fits "partially obscured" and the load correlation.
2. **Intersection-observer animation state.** Elements use `intersect` fade-in classes. The helper zeroes animation and transition durations through an injected style tag, but only after `domcontentloaded`; an element mid-transition could still be measured translated or clipped.
3. **A real overlap** between the sticky header and the tag pills at some scroll offsets, which the suite only catches when the offset happens to line up. If so this is a genuine (if narrow) accessibility issue, not test noise.

## How to reproduce

Needs Playwright's Chromium (`npx playwright install chromium`) and a built site. Starts the preview server, loops the suite, and reports runs with failures. Run it while something else is loading the CPU (a parallel build works); an idle machine did not reproduce it.

```bash
npm run build && npm run preview
for i in $(seq 1 20); do
  npx playwright test tests/playwright/accessibility.test.ts 2>&1 | grep -E "✘|passed|failed"
done
npx astro preview stop
```

Do not decide "it passed" from the absence of `✘` alone: if the preview server is not up, Playwright aborts without printing one. Check for a `passed` count.

## Suggested next steps

1. Reproduce under load and capture the full axe node, including `getBoundingClientRect()` of the pill and of the sticky header at the moment of the audit.
2. Test hypothesis 1 directly: wait for `load` (or network idle) and scroll back to the top before running axe, then loop 20+ runs under load. If the flake disappears, the suite was measuring layout noise.
3. If the overlap survives a settled layout, fix it in the component (topic pill spacing or header offset) rather than in the test, and keep the assertion.
4. Do not "fix" it by excluding the `target-size` rule or by adding retries: that would hide a possible real defect.
