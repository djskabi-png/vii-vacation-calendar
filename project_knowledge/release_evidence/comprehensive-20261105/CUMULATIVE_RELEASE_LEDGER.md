# Comprehensive cumulative VII release, 2026-11-05

Status: candidate validation in progress. No new public deployment claimed by this document.

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
