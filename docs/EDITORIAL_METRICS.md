# Editorial metrics (GA4)

Status: Active
Scope: Noticiencias frontend (GA4 `G-BP9KG11S3W`) + newsletter backend (Buttondown)
Source of truth for events: `src/utils/browser/analytics-events.ts`

This document defines the retention and editorial KPIs of the program and how
each one is reconstructed from the site's custom events. Event names and params
are the contract: if an event is renamed, this document moves with it in the
same change.

## Funnel events

| Event                   | Fires when                                                 | Key params                                    |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| `article_view`          | an article page loads (once per article per session)       | `article_path`                                |
| `article_50`            | 50 % of the article body scrolled past the viewport bottom | `article_path`                                |
| `article_90`            | 90 % of the article body scrolled past the viewport bottom | `article_path`                                |
| `primary_source_click`  | click on a primary-source link                             | `link_domain`, `article_path`                 |
| `outbound_source_click` | click on a coverage/secondary source link                  | `link_domain`, `link_url`                     |
| `related_impression`    | the related block is at least 50 % visible                 | `related_kind`                                |
| `related_article_click` | click inside the related block                             | `article_path`, `target_path`, `related_kind` |
| `newsletter_impression` | the capture form is at least 50 % visible                  | `form_id`                                     |
| `newsletter_start`      | first focus or keystroke in the email field                | `form_id`                                     |
| `newsletter_submit`     | form submit (intent; not a confirmed subscription)         | `method`, `form_id`                           |
| `series_click`          | click on a series link                                     | `series_slug`                                 |
| `topic_click`           | click on a topic link                                      | `topic_slug`                                  |
| `search`                | a search is executed                                       | `search_term`, `results_count`                |

Reconstruction order (funnel exploration): `article_view` → `article_50` →
`article_90` → `primary_source_click` / `related_impression` →
`related_article_click` →
`newsletter_impression` → `newsletter_start` → `newsletter_submit`.

## KPIs

### 1. Returning visitor rate

- **Definition**: share of users with at least one prior session in the window.
- **Formula**: returning users ÷ total users (GA4 retention report).
- **Source**: GA4 user identity; no custom event.
- **Interpretation**: loyalty signal. Compare month over month, never as an
  absolute quality score.
- **Limitations**: device-scoped identity; cross-device and cookie-cleared
  users count as new; consent-denied users are not identified.

### 2. 7-day return

- **Definition**: share of a user cohort that starts a session within 7 days of
  their first session.
- **Formula**: cohort users with a session in days 1–7 ÷ cohort size (GA4
  retention report, "Week 1").
- **Source**: GA4 retention cohorts.
- **Interpretation**: whether the weekly edition brings people back inside the
  publishing rhythm.
- **Limitations**: needs cohort volume; GA4 hides small cohorts; identity
  caveats as in KPI 1.

### 3. 28-day return

- **Definition**: same as KPI 2 with days 1–28.
- **Formula**: cohort users with a session in days 1–28 ÷ cohort size ("Week 4"
  column or a custom cohort).
- **Limitations**: same as KPI 2; a 28-day window needs ~2 months of data
  before it is readable.

### 4. Newsletter conversion

- **Definition**: share of sessions that saw the capture and submitted it.
- **Formula**: sessions with `newsletter_submit` ÷ sessions with
  `newsletter_impression`. Split by `form_id` (hero, final, landing).
- **Source events**: `newsletter_impression`, `newsletter_submit`.
- **Interpretation**: submit is intent, not a confirmed subscription
  (Buttondown uses double opt-in). Pair with the Buttondown subscriber count
  for confirmed conversion.
- **Limitations**: impression requires the form to be at least half visible; a
  session can see several forms (dedupe by session before dividing);
  consent-denied traffic is missing.

### 5. Related-content CTR

- **Definition**: clicks on the related block per impression of that block.
- **Formula**: `related_article_click` ÷ `related_impression`.
- **Source events**: `related_impression` and `related_article_click`
  (`related_kind` splits `related` from `recent`).
- **Interpretation**: whether the related/“Más reciente” block actually moves
  readers to a second story, and whether real relations beat the fallback.
- **Limitations**: an impression requires the block to be at least half
  visible; readers who never reached it are excluded by design. Compare with
  KPI 8 for the session-level effect.

### 6. Primary-source CTR

- **Definition**: clicks on primary sources per article view.
- **Formula**: `primary_source_click` ÷ `article_view`.
- **Source events**: `primary_source_click`, `article_view`.
- **Interpretation**: trust proxy — how often readers open the paper or
  original source. Coverage clicks are `outbound_source_click` and are not
  part of this KPI.
- **Limitations**: only sources marked `role: primary` produce the event;
  legacy posts with a flat source list have no primary link to click.

### 7. Article completion

- **Definition**: share of article views that reach 90 % of the body.
- **Formula**: `article_90` ÷ `article_view`, per `article_path` for
  per-article reads.
- **Source events**: `article_view`, `article_50`, `article_90`.
- **Interpretation**: body length versus real interest; compare within similar
  lengths and categories, not across the whole corpus.
- **Limitations**: scrolling is not reading; short articles that already fit
  the viewport never fire the thresholds (deliberate: no immediate check on
  load); a fast scroll to the footer counts as completion.

### 8. Second-article rate

- **Definition**: share of sessions with an article view that view a second
  article.
- **Formula**: sessions with ≥ 2 distinct `article_view` events ÷ sessions
  with ≥ 1 `article_view` (GA4 exploration, event count per session).
- **Source events**: `article_view`.
- **Interpretation**: discovery health — whether related, topics and series
  produce a second read.
- **Limitations**: `article_view` is deduplicated per article per session by
  design, so revisiting the same story does not inflate the rate;
  consent-denied sessions are missing.

## GA4 caveats (apply to every KPI)

- **Consent Mode v2 advanced**: users who deny consent send cookieless pings;
  their event-level data is unavailable and GA4 may model it. Every total is a
  floor, not a census.
- **Retention**: 14 months (operator checklist). Comparisons older than that
  are impossible in-product.
- **No PII**: events carry paths, slugs, domains and form ids. The only
  free-text param is the search term, disclosed in `privacidad.md`.
- **Thresholds and sampling**: GA4 hides low-volume segments; use Explorations
  with enough date range before drawing conclusions from small numbers.
- **Provider authority**: Buttondown is the authority for confirmed
  subscriptions; GA4 measures intent.
