# Comprehensive cumulative VII release, 2026-11-05

Status: published v800 plus Cloudflare edge v6. The candidate-stage rows below are historical checkpoints, superseded by FINAL_REPORT.md and PUBLIC_RELEASE_RECEIPT.json. A pending entry below is not a new release-status claim.

## Preserved source

Candidate branch: `release/v791-complete-20261104`. Parent `b3d45542d72bc50bbcd1937c486c98bc1a86b393`. Release-source gate protects 15 ancestors and 19 capability families, including saved local fixes. No reset, force push, migration, production catalog write or replacement project is authorized by this release.

## Requested families and evidence

| Family | Included implementation and evidence | Final destination check |
|---|---|---|
| Accessibility / all attributes | 573 verified historical vacation profiles; 132 current event pages with exact source identity; native numeric IDs stay world-scoped; explicit arrays override historical indexes; qualified accessibility labels remain qualified. Runtime catalog/cache tests. | New public catalog and Jerusalem accessibility results pending |
| Amenities cache | Shared taxonomy and normalized metadata, seven-day fresh / thirty-day hard expiry; scope hashing, accepted-generation membership, inactive tombstones, negative removals. Eight actual cache tests. | Exact deployed business-amenities route pending |
| Offers / sliders | Accepted empty snapshots clear older offers; malformed source fails separately. Five-minute fresh / one-hour hard expiry for vacation offers; old longer persisted expiry cannot override current policy; date/party retained; final quote stays live. | Public home/events/spa rail and quick-book entry pending |
| Last-minute cutoff | Existing protected Jerusalem timezone clock and 14:00 boundary tests retained. | Public current dates pending |
| Weekend / weekday pages | Four permanent weekend pages, audience composition and SPA weekday pages retained by protected contract suites. | Representative linked pages pending |
| Dates, guests, price basis / booking | Existing retained-room/party/date context and real basis-guest pricing preserved. No reservation/payment is made by QA. | Read-only public quote entry pending |
| Search / sorting / nearby | Existing priority, price, unavailable-last and nearest-sort suites retained. Mobile accessibility now has one state in quick chip and drawer; editable draft prices show generic apply until committed. | Mobile drawer, cancel/apply/reload and geography pending |
| SEO / 301 | 30 sampled business legacy URLs produce exact intended 301 targets. Twenty dated/undated search chains tested with preserved date/party/price/sort intent; approved location may move from query into canonical path. SPA parser covers every approved city plus managed runtime locations. | Repeat exact twenty searches on new public version pending |
| SPA route failures | Production log samples identified concrete city-plus-feature 404s. All 45 approved cities round-trip across audience/facet combinations and four locale titles; unknown/duplicate combinations still fail closed. | Exact observed failing routes pending |
| Galleries / media | General versus unit identity, 2482 / 2697 / Hilat regressions preserved. Source originals and responsive media behavior retained. No invented HD source or Cloudflare image binding claim. | Public representative business gallery pending |
| WhatsApp | Source WhatsApp number normalization and immediate open before optional persistence preserved; no message sent by QA. | Public modal and destination attributes pending |
| Mobile header / guest save | Protected header sizing and save-party-without-search behavior retained. | Mobile control interaction pending |
| Maps | Protected real source coordinates, centered price pin, stable map lifecycle, clustering/zoom and responsive body-lock fixes retained. No fabricated exact point for unresolved source locations. | Desktop/mobile representative pan/zoom/select/close pending |
| All-world popular searches / CMS | Eight-world managed defaults, nearest, region/facet hrefs and CMS fixture round-trips retained. No production CMS publication or destructive writes during QA. | Public world links and read-only CMS pending |
| Admin performance | Public independent check reproduced indefinite loading. Overview now skips unrelated Biz schema discovery. Actual handler test forces Biz failure and verifies overview 200, complete 921-row data and zero Biz calls. Existing client renders bounded pages. | Post-deploy authenticated overview and paging pending |
| Other administration | Public authenticated dashboard and geography observed functional. This is not proof of every authenticated mutation. Existing role, operations, catalog, content and report suites retained. | Read-only post-deploy checks pending |
| Performance / reliability | Startup lazy dispatch, bounded initial report rendering, D1 reuse and source coalescing retained. Build artifact and startup budgets required. Staged edge cache remains separate until exact build guard is updated and validated. | Actual deployed navigation and latency sample pending; no field P75 claim |

## Procedure

Build completes before tests that import built artifacts. All Node regression tests then run against that build. Browser checks use the authorized CUA surface, not external Playwright/CDP. Publication uses the existing owning Sites project, preserves environment32, domain, bindings and audience, and records exact source/tree/version/deployment. v798 remains the recorded rollback identity. No booking, payment, lead, WhatsApp send, permission edit or production data mutation is used as a test.

Independent source inspection and actual read-only admin inspection are supporting evidence, not deployed-release signoff. Pending checks are updated only after observed results.

## First public receipt and final expiry correction

v799 deployed successfully from `72f2d10f3e378d34303a4572bc49cc5e37b74460`, tree `8de9b0fa3c154fcb4f48d974fcefa094c5423205`, deployment `appgdep_6aebdd01e6f4819196b5e0ccffa306dc`, environment32. Public build observed `6730fb45-e239-46b7-a3d6-ab88eec93e74`. Twenty-eight public page/API reads all returned200. Public vacation filter catalog576 records (accepted577 includes an intentionally retired property), events132, hourly53, spa159. Vacation2244 and event2 expose their correct world-specific accessibility IDs. Place2244 amenity API returns11groups. Last-minute43offers for November5to6. Public Jerusalem accessibility11places/17units, no Tiberias.

A final source-age defect was then identified: browser retention could outlive the server snapshot deadline. The follow-up candidate adds absolute checkedAt-based expiry, clears both rendered and last-good state at the deadline, rejects expired render/recovery, and arms the timer for initial API responses as well as previous data. Five new runtime tests execute the actual discovery effect with an injected clock, including59to60minutes, offline failure and cleanup. Build passed. Twenty-two affected regression tests passed after correcting older test fixtures to include valid checkedAt. The complete final suite and follow-up public receipt remain separate required observations.

Public timing remains slower than the target: sampled HTML TTFB2.2to4.0seconds, with an hourly outlier11.3seconds. These are HTTP samples, not page-load or field P75. An isolated edge worker is not counted as a deployed public speed improvement. The current public CNAME is `custom-domains.chatgpt.site`; DNSAPIread403 is a permissions limit, while zone and route reads succeed. No DNS change has been made.


## Final public close

Main v800 succeeded and public build905d5f64-da48-41ed-a232-1ef715e320bc was observed. Cloudflare edge v6 version6bdea555-20b1-40e9-88fc-faab685fe742 is live on only VII, preserving21other routes. DNS proxy is now enabled with the same CNAME. Main suite2132passed/1skipped/0failed, edge24passed, final public searches20/20. Authenticated desktop/mobile performance UI50of921rows, Jerusalem accessibility11places/17units, map marker/card identity and mobile scroll cleanup were observed. See FINAL_REPORT.md for each affected family, actual timing samples and precise source-parity limits. The prior transient500 is preserved, bounded safe public-read recovery is deployed, and the final matrix passed. Exact identities and coordinated rollback are in PUBLIC_RELEASE_RECEIPT.json.


## Observed public checkpoint 2026-11-08: app v828 and native delivery follow-ups

Managed Site v828 is public: app source `e62d4f6d86c3dd1b92fda462eb2793801baee671`, build `e7c47da6-f110-9c9c-29c7-c790f9550802`, original Site version `appgver_47c48904fef081919f2f3a540eaf3a14`, deployment `appgdep_6aefc2c5def88191bb4d1b41dc8326cd`. This was a frozen official archive release, preserving environment32 and original database/uploads/domain. Full suite:2661pass,1preexisting skip,0fail; HTTP48/48;24scoped desktop/mobile receipts. After publication24HTML/Flight checks and717retained predecessor assets passed. The navigation progress CSS is inline and regional loading geometry is preserved in critical CSS.

Native delivery was updated separately, without another full application upload. Current native source `f5801f03e096935bf7e1b9305ad3045e66a9e1d2`, Worker version `d8cd9e0d-0edf-4a85-8b84-053618cfe984`, code SHA256 `27134ea3602dbf5cbbae7a61ca6e6580a62190c71643e74225fb83f1f0925bb6`. Only Worker content was updated using the official content-only API. Exact readback preserved bindings, routes, cron, placement, usage, compatibility, logging and original app build identity.

Anonymous cache-eligible document MISS reads use the exact original Site alias, with no viewer or host-bound cookies forwarded; alias redirects retain the public host/status/query/hash. Private/API/action/booking requests retain their original host-bound route. Regional warming now covers11canonical areas, exact two-guest documents and home-context Flight variants. Keys are not collapsed. Two complete reads at most,10seconds per target,90seconds per cycle. An observed initial deadline exhaustion led to alternating leading halves and explicit skipped/failed-path reporting. The actual `regional-v2` installed cron completed66/66,0failed,0skipped in70252ms.84native tests and6compiled-artifact assertions passed. Public16document/redirect reads passed; logo-to-home, home-to-spa and mobile reload were observed without browser errors.

Performance is NOT accepted yet. Native cold examples still took2.9to3.7seconds to headers and2.9to5.7seconds to the complete document. Repeated HIT examples took23to63ms to headers. These are HTTP samples, not browser-load or field P75 claims. Latest cold PageSpeed mobile69,LCP5.25seconds,SpeedIndex7.54seconds; the LCP element was the privacy notice. Do not certify the whole V/QQQAAA program from this scoped release. Current remaining investigation: separate world-availability head gating, regional catalog body timing, and hydration/rendering costs without changing disabled-world redirects or catalog/booking truth.

Evidence: `.release-v790-candidate/.qa-output/v828-first-visible/published-gate.json` and `.release-v790-candidate/.qa-output/v830-warm-fairness/published-gate.json`, corresponding source/operation/HTTP/browser/scheduled-warm receipts.
