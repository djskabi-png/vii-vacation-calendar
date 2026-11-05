# VII v800 public release, 2026-11-05

Published and postchecked at https://vii.spaplus.co. Exact identities are in PUBLIC_RELEASE_RECEIPT.json. Main application source d255fe26 and edge v6 are separate coordinated artifacts. All protected saved application ancestors are retained. No production catalog write, schema migration, permission change, lead send, booking or payment was used as QA.

## Delivered changes

- Source amenities preserve complete native IDs, world and supplier identity, partial-accessibility labels, explicit empty removals and shared versus unit scope. Historical vacation profiles573 and independently identity-verified event profiles132 are projected consistently. Place2244 exposes11amenity groups. Accessibility in Jerusalem stays within the selected geography, showing11places/17units rather than unrequested Tiberias fallback.
- Metadata uses seven-day freshness/thirty-day hard expiry with source membership, tombstones, scoped keys and coalesced reads. Vacation offers use five-minute freshness/one-hour hard expiry. Browser rendered and last-good offers expire at the source deadline, including offline refresh failures. Weekly refresh architecture details distinguish implemented mechanisms from future scheduled targets in the cache plan.
- Public delivery now uses Cloudflare with build-specific HTML/RSC variants and strict admission. Recognized login cookies are removed only from anonymous public-shell upstream reads. Private routes/APIs/actions retain credentials, request semantics and uncached responses. A transient public GET failure receives exactly one changed retry; private/API/POST actions never retry here. Redirect301 status and complete search intent survive forwarding.
- Admin overview no longer waits on unrelated Biz schema discovery. Actual authenticated performance UI loads50of921business rows, with19pages and working next-page interaction, on desktop and390px mobile.
- Approved SPA city/feature routes, four permanent weekend pages, weekday discovery, timezone14:00cutoff, pricing/party/date logic, galleries, WhatsApp opening, popular-search controls, mobile header/guest-save and map families remain protected by the cumulative regression suite. SPA parser round-trips45approved cities and four locale titles; previous observed SPA404routes now200.

## Release evidence

Build passed before the complete suite:2133tests,2132passed,1skipped,0failed. Edge runtime/source tests24/24. Final public dated/undated searches and legacy301chains20/20passed. Thirty sampled business redirect identities were audited separately. Public event discovery returned36places for the actual checked scope, not the old truncated2. SPA API returned seven day groups; source-empty day was retained rather than fabricated.

Observed customer/operator/risk scenarios on the public release: selected-geography accessibility, dated and undated redirect intent, permanent weekend and SPA route opens, real-price map centering and selection, mobile fullscreen map open/zoom/close and scroll restoration, signed-in public navigation followed by authenticated admin overview/paging/reload, and uncached rejection of invalid private/API/quote requests. Map selection for BoraBora resolved consistently to vacation364. Gallery2482 general and unit tabs use source images; local final-build gallery interaction was checked separately from public source/API checks. No claim that every authenticated write was exercised.

Cloudflare check proves expected public build, route fail-open and preservation of all21unrelated routes. Warm public HTML samples28to44ms and public RSC24ms; first uncached reads2.55to2.83seconds in the same sample. These are HTTP timings, not complete browser load or field P75. Cold origin work remains measurable rather than being described as instantaneous.

A prior final-matrix500 is retained in comprehensive-transient-search500.json. The exact target immediately returned200 diagnostically. Bounded public-read recovery was implemented and tested, then the final matrix passed20/20. Underlying platform incident cause was not established from available evidence. An owner-log diagnostic had a local reservation but no visible submitted message or result at close; no log-based diagnosis is claimed and no uncertain request was repeated.

Legacy hourly source visibility remains a precise audit limitation: the known Titanic_Spa legacy URL returned404 in an authorized browser; hourly API facts and redirects were inspected, but unavailable legacy feature fields cannot be declared equivalent. No blanket legal compliance, real-device field performance or all-private-mutation claim is made.

## Preservation and recovery

Main rollback is the immediately preceding cumulative v799, with environment32 retained. Edge guard must be suspended before a main rollback/release and rebound only to the observed resulting build. Exact instructions are services/vii-edge-delivery/README.md. The composite baseline tag records main and edge identities, so infrastructure-only commits are not confused with a new Site deployment. An independent final checker reviewed the supplied release artifacts and found no additional blocker.
