# VII runtime acceleration, 16 October 2026

This increment implements part of the approved layered-cache architecture on the existing Cloudflare runtime. It does not provision or claim Aurora, AWS networking, Hyperdrive, Redis, search or disaster recovery.

## Observed release 433 bottlenecks

- The public response cache rejected every Cookie header, including Cloudflare's infrastructure cookies. A browser carrying only `__cf_bm` regenerated `/spas` while a cookie-free request received `X-VII-Page-Cache: HIT`.
- Vinext navigates using canonical `.rsc` URLs. Those responses never entered the HTML-only cache, so internal navigation recomputed public pages.
- Every persistent hit required an R2 request. No bounded isolate-memory or edge response cache existed.
- Cache keys used a static `v3` namespace across releases. Stored HTML could reference assets from the previous build.

## Implemented increment

`worker/public-response-cache.ts` owns the public cache policy and response tiers:

1. Bounded isolate memory, at most 32 entries, 8 MiB total and 2 MiB per response.
2. Cloudflare Cache API when supported by the hosting runtime.
3. Existing R2 storage as persistent fallback. Lower-tier responses retain their original expiry when promoted.
4. Authoritative rendering after a miss or unsupported cache infrastructure.

Only explicitly allowlisted Cloudflare infrastructure cookies are tolerated. Session cookies, unknown cookies, authorization, actions, private routes, fresh booking/availability APIs and refresh payload modes bypass all tiers.

Each build receives a unique immutable namespace. Keys bind origin, path, normalized allowed query, response representation and every Vinext routing variant header. Stored responses preserve framework params, mounted slots, Vary and SEO metadata. HTML and Flight never share entries. Unsupported Vary, Set-Cookie, non-200 responses and unexpected MIME are not stored.

Public discovery HTML and navigation keep the existing bounded freshness of 180 seconds, homepage 300 seconds, catalog API 300 seconds and legal pages 900 seconds. Final prices, availability and transactions keep their authoritative request paths.

## Evidence and rollout

- Full build and 781 tests passed before publication.
- Production-artifact smoke covered 11 public routes, HTML and Flight, warm-content byte equivalence and session bypass. Warm in-process responses took 0.26 to 3.03 ms in that local test. This is server-side local evidence, not internet page-load time.
- Independent security/freshness review passed.
- Rollback baseline is release 433. Exact public release identity and network timings are recorded separately after deployment.

## Next infrastructure milestones

Measure public p50/p95 response time and cold/warm hit rates on the actual hosting runtime. Confirm Cache API behavior there before making an edge-hit claim. Retain R2 and origin fallback.

Prepare the Aurora migration as a separate deployable milestone using the approved canonical model, database ownership, private-network proof, staging isolation, migration/reconciliation and restore tests. The database replacement must be justified and verified independently of frontend latency.

Official references researched for this change:

- https://developers.cloudflare.com/r2/examples/cache-api/
- https://developers.cloudflare.com/workers/runtime-apis/cache/
- https://developers.cloudflare.com/d1/reference/faq/

No new paid cloud service or supplier-data refresh is part of this increment.

## Cold-render continuation candidate

The next increment removes the homepage root-level catalog wait. The hero, shared search and two independently fetched live-deal sections can render before the four-world catalog and review data. The existing catalog sections retain their data and order behind a streamed Suspense boundary, with the existing animated skeleton styles and a localized status label.

Public catalog reads start the published editorial query in parallel with generation selection and pass that selected immutable generation into the summary read, removing a redundant database round trip. Editorial rows are still freshly queried, not retained in an additional cache. Homepage review reads project the JSON review field in SQL instead of fetching complete place detail records. A real bundled-record SQLite test returns identical reviews and reduces that sample from 311642 to232565bytes, about25percent.

Valid response hits can refresh in the background after the first third of their lifetime. The original hard expiry remains180seconds for discovery and300for the homepage. Refreshes are deduplicated by the complete variant key, limited to two per isolate and cannot recurse into cache reads. Session, unknown-cookie, action and transaction exclusions remain unchanged. Optional edge/R2 lookup waits are bounded to50/150milliseconds before origin rendering can proceed. No supplier fetch or transaction is timed out by these optional-cache budgets.

Candidate checks:786tests passed, TypeScript passed, font-source audit passed,11route HTML/Flight artifact audit passed, independent source review passed. The prior release434 true-cold homepage probe reached its heading at4508ms; the post-publication cold-shell measurement must be recorded separately, not inferred from these code changes.

Official implementation references checked16October2026:

- https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil
- https://developers.cloudflare.com/d1/sql-api/query-json/
