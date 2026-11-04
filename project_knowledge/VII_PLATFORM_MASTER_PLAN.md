# VII platform source of truth

This file was reconstructed on 3 November 2026 after the required project path was found missing. It contains only verified stabilization facts and release rules. It does not claim to reconstruct undocumented business decisions.

## Verified product scope

VII is a multi-world discovery and booking product covering vacations, events, spa, hourly rooms, attractions, trails, providers, holidays, editorial pages and administration. Supplier data is authoritative for availability, prices, contacts, rooms, amenities and media. Editorial and generated layers may organize or explain supplier facts but must not invent them.

## Canonical current source

The cumulative release worktree audited on 3 November 2026 is:

`C:\Users\Adir\Documents\vii.co.il\.release-v786-home-state`

The public release at audit time is v788 with source:

`9e324b6636f31a87475f7057d513f743c09c7332`

The cumulative local branch contains three later verified fixes that are not public at audit time:

- `58ce9ed8f060762467df836e4565bc1889cf192e`
- `66f15f522a42fc46fdb534cb6a41ccba93de45f7`
- `8a05b5817da79ca07d8ad9c531d8fb0610052532`

Future work must discover the actual latest cumulative descendant before using this snapshot as current truth.

## Mandatory release protocol

1. A release candidate must be a clean Git worktree.
2. It must pass `pnpm qa:release-source` and be a descendant of every protected capability commit in `project_knowledge/release_controls/vii-accepted-capabilities.json`.
3. It must pass `pnpm qa:release-baseline` and the affected-family tests.
4. QQQAAA is the broad fail-closed suite. It includes release-source integrity, administration, accessibility and Hebrew/directionality contracts.
5. Local code, a passing build, a pushed commit or a queued deployment is not public evidence.
6. Publication requires current explicit authorization, one frozen source commit, one known rollback and uncertain-result protection.
7. The exact public Version, Deployment, source, managed commit, tree and environment revision must be recorded and opened at the natural destination.
8. A stale branch, missing protected ancestor, dirty tree or failed required family blocks release.

## Product invariants

- Availability, price, online booking and CTA state must come from one shared truth model.
- A place may have multiple accommodation types; primary and secondary types participate in search.
- Media keeps supplier identity. General and unit galleries may not borrow from each other to hide missing media.
- Approved semantic searches use clean ASCII canonical pages. Transactional state such as dates, guests and sorting remains parameterized.
- Desktop search may apply choices immediately. Mobile preserves the staged flow.
- Permanent editorial intents such as last minute, spa today/tomorrow and the four near-weekend periods have unique real pages.
- WhatsApp routing uses the supplier field and is not blocked by optional lead persistence.
- A phone-only place never shows false online availability.
- Administration, public shutdown state and Professor answers use real connected data and explicit unavailable states.
- Public Hebrew uses approved sans-serif typography, correct RTL isolation and stable first paint.

## Current open verification items

The normalized closure ledger is:

`C:\Users\Adir\Documents\vii.co.il\.release-v786-home-state\project_knowledge\release_evidence\vii-72h-regression-root-audit-20261103\requirements.json`

Open items include supplier video contract discovery, the archived 10 dated plus 10 undated old/new search and redirect matrix, full live administration click-through, real-device performance evidence and post-release public verification of the unpublished fixes.

## Approved Cloudflare authority, 4 November 2026

Adir explicitly confirmed that VII remains on Cloudflare. D1 is the single canonical database for public and administration state, reporting and scheduled maintenance. R2 remains the bound media store and the existing Images service remains the image transformation route where available. Historical AWS migration configuration is not authorization to switch providers or request AWS access. Production selection must ignore stale AWS primary variables. This decision describes approved architecture; exact deployed readiness still requires release evidence and authenticated read/write verification.

Implementation and incident evidence: `.release-v790-candidate/project_knowledge/diagnoses/admin-primary-connection-20261104.md` in the VII workspace. Do not claim the repair is public until the deployment and live checks succeed.

## Verified Cloudflare recovery release, 4 November 2026

Public v794 succeeded with source17add00d9dd0cc1e87d9528e3741520c15618001, managed2115443f106bd4ed63cf798956df634dd3327163, deployment appgdep_6aeb05de79508191821890ccbf64d383 and environment32. Eleven failed administration APIs recovered and an unchanged geography save survived a fresh read and reload. Public catalogs report cloudflare-d1 and degraded=false. See the cumulative release worktree release_evidence/v794-cloudflare-recovery.json for exact scope and remaining verification. This is not full launch approval: image optimization errors, catalog performance, scheduled-execution evidence and backup/restore coverage remain open. The authenticated direct Cloudflare account inventory was checked; matching production Site resource identities were not established there. Do not confuse historical staging workers or the supplier outbox with the active Site database.

## Scoped v798 release evidence, 4 November 2026

Public v798 succeeded from source0fe4ed2a6ecc2982c7be60faaedcb8304b38b4a9, tree50e7ce31d7a0a83adad4c9004bf1e8114871a49b, managedb186b0d084dc2579f981bf950c5944f59b67da00, deploymentappgdep_6aeb402dda308191b3bac4377d520767, environment32. Seven permanent SPA weekday pages, optional browser-origin nearest ordering across seven result families and progressive business reports are included cumulatively.

Actual desktop Friday grid102single/130couple/62group offers matched selected-day API generation checkedAt2026-11-04T14:28:51.513Z; Saturday81couple offers matched the same generation. Audience, reload, cross-weekday and back journeys passed. The prior v797 API-only proof had missed a client20-card cap; v798 fixes it. Authenticated report overview fell from23727DOMnodes/921rows to544nodes/zero initial table rows; businesses paginate50rows across all921records. This is screen-specific evidence, not proof every page is fast.

Exact evidence: `.release-v790-candidate/project_knowledge/release_evidence/v798-spa-nearby.md` and `release_handoffs/v798.json`. Real-device GPS success and mobile-size visual checks remain unobserved: IAB denied location and acknowledged viewport overrides without changing actual width. Whole-site speed, memory, scheduler execution and launch readiness remain open in `performance/VII_SPEED_PLAN_20261104.md`. Rollback is terminal v797. No schema, environment, binding, permission, content, booking or lead change was performed in this publication.

## Verified event inventory and preset navigation, 4 November 2026

Public v796 succeeded from source1d56f95d1319c6f49fcd1a76ec2e38c22ea07b0b, manageddf816f755cf8929a2a063f84d1d53702f0100711, deployment appgdep_6aeb1f925d10819197d0b4a6a0b9d2b1, environment32. Permanent pages are /events/last-minute, /events/thursday and /events/friday. Exact public checks found36available venues for November5 and35for November6, including34and33unpriced venues respectively. Each matched every confirmed normalized supplier ID; the preceding v795 comparison also included all12legacy cards for each date.

Availability comes from positive days[].morning/evening.freeUnits, independently of the price-dependent available flag. Unpriced availability must not inherit the occupied advertising-floor roomID or price. One versioned D1 snapshot owns both slots per date/party; five-minute freshness and at most one-hour stale reuse are enforced. The exact v796 stale-to-fresh background refresh was observed. Actual scheduled invocation remains unverified; source cron configuration is not runtime evidence.

Mobile retained-state navigation was exercised with50participants: Thursday25venues/November5, Friday24/November6, backThursday25/November5. Last-minute switched toNovember5 after14:00; reload returned default20participants/36venues. Slider tabs, unique links, scrolling, unpriced contact modal and desktop/mobile rendering were checked. The full1987-case suite passed1986with zero failures and one existing skip. Evidence is in .release-v790-candidate/project_knowledge/release_handoffs/v796.json and diagnoses/event-discovery-truth-20261104.md.

This verifies the event data/navigation repair, not whole-site launch readiness. Observed runtime memory failures and page latency remain in the performance workstream; their allocation cause, scheduler history and backup/restore evidence are still open. Check vacation fixedPeriod retained-state navigation as a separate family hypothesis before launch; no public failure has been established for that family in this event task.
