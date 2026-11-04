# v798 scoped public verification

Source: `0fe4ed2a6ecc2982c7be60faaedcb8304b38b4a9`.
Tree: `50e7ce31d7a0a83adad4c9004bf1e8114871a49b`.
Status: published; desktop functional checks passed. Real-device geolocation success and mobile-size visual verification remain unobserved.

Version: `appgprj_6a71ccdca27481918bf04dd329d3eb21~appgver_763c53d18b188191aac5ecbd3c319869`.
Deployment: `appgdep_6aeb402dda308191b3bac4377d520767`.
Managed source: `b186b0d084dc2579f981bf950c5944f59b67da00`.
Remote build observed building, publishing, succeeded with the exact source/tree. Environment32, PUBLIC and Cloudflare authority retained. Rollback is v797 in the release receipt. Exactly one deployment was requested.

## Evidence retained from v797

Seven weekday pages returned200 with distinct localized titles, canonical paths, FAQ data and sitemap membership. Invalid weekday returned404. Public Friday full API contained102single/131couple/62group offers for2026-11-06; Saturday66/89/52 for2026-11-07. Independent rail comparison confirmed20offers as subsets of each full audience on the same checkedAt generation. These counts are observations, not business constants.

Browser verification then rejected full-page completeness: only20cards were mounted. The v798 follow-up fixes the rendering helper, preserving the rail cap. Two actual AST client tests execute the production offer initializer and audience handler;27other focused cases passed. Independent source review found no blocker in this specific delta. Neither substitutes for the pending public DOM check.

All seven result families exposed the selected nearest option: vacation, events, hourly, SPA, providers, attractions and trails. The available browser denied geolocation. Valid-origin and global ordering are covered by actual helper/submitted-search tests; a real-device GPS-success session has not been observed. Coordinates remain session-local, never query parameters. Places without coordinates sort last; trail positions use disclosed regional estimates.

Authenticated report: overview544DOMnodes/zero table rows; businesses50rows; next page51to100of921. History, sales and business detail reachable. Business-detail hash survives reload after hydration. No lead, booking, supplier refresh or message was submitted. Before the change, the same report mounted921rows and23727DOMnodes.

## Test accounting

The original v797 full invocation was not wholly green:2017total,2008passed,5failed assertions,3local D1 cancellations,1existing skip. Corrections passed86family tests; all3D1 cases passed the one isolated serial retry (12tests). Aggregate2016active cases were verified, plus1existing skip. v798 adds29focused passes and requires an exact-source remote production build. This is not a claim that the whole website is launch-ready or meets the speed-plan targets.

## Exact v798 observations

- Public Friday single grid102cards, couple130cards, group62cards. Direct selected-day API200 at checkedAt2026-11-04T14:28:51.513Z returned exactly102/130/62. Counts were measured on the rendered articles, not inferred from API alone.
- Clicking couple immediately selected the control and changed URL to `/spas/day/friday?spaDealFor=couple`. Reload retained couple and130cards.
- Clicking Saturday navigated to `/spas/day/saturday?spaDealFor=couple`, H1Saturday, contextNov7and81cards. API on the same checkedAt generation returned63/81/48. Friday's old cards did not persist after settled navigation.
- Browser back restored Friday, couple, Nov6and130cards. Group selection then showed62cards with correct query and selected button.
- Desktop screenshot inspected: native Hebrew Rubik heading, correct title, selected weekday, audience controls and card grid. No horizontal overflow at actual width1280 (document1265). Links carry the selected date and actual package identifier.
- On current v798 vacation search, nearest is visibly selected, the origin-denied message is honest, retry button exists and no fabricated distance is shown. Seven-family selector checks were already observed on cumulativev797; that source is retained unchanged in v798.
- Attempted viewport390x844 on existing tab then a fresh owned tab. Both still reported actual innerWidth1280; reload did not change this. Temporary override was reset. Mobile visual pass is explicitly withheld. Actual mobile staged search submission tests passed, which is code evidence, not a mobile screenshot.

Customer scenarios: single, couple, group, cross-weekday, reload and back. Operations perspective: progressive report tabs/paging/hash reload. Data/SEO/privacy perspective: selected-day API parity, canonical/meta/sitemap/invalid404 and local origin/error handling. Independent review was source and HTTP scope, not a separate browser visual signoff. Consequently no whole-site launch-ready claim is made.

## Remaining broader work

Whole-site cold/warm response latency, memory profiling, scheduler execution proof and field performance targets remain open under `performance/VII_SPEED_PLAN_20261104.md`. The progressive report improvement is measured on its own screen, not extrapolated to every route. No legal accessibility or universal media-rights compliance is claimed.
