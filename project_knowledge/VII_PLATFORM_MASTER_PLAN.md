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


## Verified deployment checkpoint, 2026-11-05

This checkpoint supersedes older implementation-status descriptions which call the edge worker isolated. It records observed implementation, not a claim of complete legal compliance, field P75 or every authenticated mutation.

- Public application: Sites v800, deployment `appgdep_6aebe1f405888191a72406feb9ca73e1`, source `d255fe2636bb60fc3b095537244046949139760d`, tree `3eb80a7fc613efa04f9f90b79fbb5d4bd161a478`, environment32. Public build `905d5f64-da48-41ed-a232-1ef715e320bc`.
- Public delivery: user-owned Cloudflare worker `vii-edge-delivery`, namespace v6, immutable worker version `6bdea555-20b1-40e9-88fc-faab685fe742`, exact route `vii.spaplus.co/*`. VII CNAME content remains `custom-domains.chatgpt.site`, now proxied. All21 unrelated routes were retained. Quota fail-open is required because this worker is a cache, not an authentication boundary.
- Source facts: vacation and event numeric amenity IDs are separate namespaces. Historical backfills apply only when canonical filter arrays are omitted. Explicit arrays, including empty arrays, and inactive/removal evidence override older data. Source-qualified partial accessibility stays qualified.
- Metadata freshness: seven days fresh/thirty days hard expiry, scoped to provider/world/locale/accepted generation/credential scope. Vacation offers: five minutes fresh/one hour hard expiry, including browser rendered state and last-good fallback at the original source deadline. A valid empty source result replaces older offers. Malformed or unavailable source is not a valid empty result.
- A representative authenticated business report now loads its overview without unrelated Biz schema discovery, then renders50 rows at a time out of921. This is observed UI behavior, not proof of every admin mutation.
- Runtime public checks and source tests are recorded in `project_knowledge/release_evidence/comprehensive-20261105/`. Old hourly profile comparison remains limited: the sampled authoritative legacy URL `/rooms/Titanic_Spa` actually returns an old-site404; thirty new-host API/301 checks do not prove that old profile's visible fields.

Every future main release must follow `services/vii-edge-delivery/README.md`: suspend old edge admission before main asset rollover, freeze/publish exact cumulative source, observe the new public build, update both edge expected-build settings, run edge tests, deploy once, run the exact route/quota guard and verify public plus authenticated paths. A successful Site deployment alone is not proof that the edge is using the same build. Preserve the two artifact receipts and their rollback identities. No account-wide business facts are created by this project checkpoint.

## פרויקט אחד ושלושה מסמכי עבודה, 5 בנובמבר 2026

החלטה מפורשת של אדיר: תוכנית V ו־QQQAAA הם פרויקט אחד של VII, לא שני פרויקטים נפרדים. מסמך 3 נוסף כאותו מלאי הערות ודרישות שמנחה את הביצוע ואת הבקרה.

- מסמך 1: `plans/VII_FINAL_EXECUTION_PLAN_20261105.md`, גרסה 1.1.
- מסמך 2: `plans/QQQAAA.md`.
- מסמך 3: `plans/VII_DOCUMENT_3_LIRAN_ADIR_COMMENTS_20261105.md`, גרסה 1.0.

הריכוז כולל 28 דיווחי לירן מ־5 בנובמבר, בחלון שתועד 11:14 עד 12:21, 27 משפחות הערות אדיר מההיסטוריה המצטברת ו־14 הוראות משלימות. אינו טוען לקריאת הודעות חדשות אחרי חלון המקור או להשלמת תיקוני האתר. קובצי מסמך 3 נשמרו ב־`C:/Users/Adir/Documents/vii.co.il/deliverables/VII-document-3-20261105/`.
