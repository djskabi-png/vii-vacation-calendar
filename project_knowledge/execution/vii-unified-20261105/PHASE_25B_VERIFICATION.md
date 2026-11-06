# Phase 25b cumulative qualification

Status: exact local candidate qualified. Unified core and public release remain
in progress. Document 3 remains deferred.

Frozen source: `7c1bf64fffd12d750453759ff2f94a583b2affe8`.
Tree: `b4ed62eabcb246b1a18a690b82a89319155fd9a5`.
Build namespace: `9c0d7af6-dde2-5768-45a2-d23280eb91e9`.

The source guard preserved 28 protected ancestors and 22 accepted capabilities.
Full TypeScript passed. The build took 24.74 seconds. The cumulative application
suite ran 2,466 tests: 2,465 passed, zero failed or cancelled, one existing skip.
Its duration was 116.65 seconds. The earlier failed phase25 run is retained;
this fresh pass includes the localization and stream-harness corrections.

The official Sites packager packaged the already tested output without another
build or upload. The Site archive is 109,244,927 bytes, SHA-256
`f942c9f52d614fa6a6830a733e32266063b54c773ca9217840876ffc10cf95c1`.
Initial and post-preview exact archive audits passed: 1,236 compiled payload
files compared, 1,257 archive files, 241 manifest references, all literal server
imports resolved. Startup was 348,877 bytes across nine modules.

The four service artifacts passed actual original/current transitive input,
ancestry and digest reuse verification. Their original identities are preserved:
controller, browser and Edge are from phase25 source `5fdd3758`; image delivery
is from phase18 source `02cb2fb4`. They were not rebuilt or relabelled as the
new Site source. Exact hashes and proposed runtime bindings are recorded in
`PREPARED_ARTIFACTS_PHASE25B.json`; those bindings have not been applied.

## Rendered compiled Site verification

The exact compiled Site ran behind a local QA-only wrapper, with isolated local
storage, a synthetic QA identity, no production service/queue/notification
bindings and no business writes. Only GET/HEAD and the reviewed bounded read-only
live-search POST were permitted. Availability errors in this environment do not
establish a production supplier defect or successful live availability.

The real Leaflet implementation opened on desktop 1280x900 and mobile 390x844
for vacation search, event search, spas, hourly rooms, attractions and trails.
Map controls became available after hydration. All six showed actual tiles and
markers; return-to-list worked. Desktop document overflow checks passed. Mobile
screenshots were inspected. The mobile list retained approved sans-serif fonts
and had scroll width 375 at viewport 390.

Observed marker rendering samples, each a single local sample rather than a
page-load benchmark: vacation 6.60ms/7 markers, events 2.30ms/15, spa 3.30ms/13,
hourly 1.90ms/10, attractions 1.10ms/4, trails 1.90ms/7. These are neither public
TTFB nor field p75/p95 and do not establish end-to-end interaction latency.

Vacation zoom changed 7.5 to 8.5 and markers 7 to21. Opening a cluster changed
visible places, and selecting a real marker opened its matching place card.
That selection survived the mobile layout change; returning to the list closed
the map. DOM marker coordinates and explicit precision were present. This
verifies rendering and propagation, not independent ground-truth GPS accuracy.

The isolated phase24 replacement-provider fixture separately verified render
failure, retained 25-row fallback list, incremental loading to50, retry, reset
failure, provider replacement, selection and locale behavior. It is not real
Leaflet or public performance evidence.

The temporary tab was closed and viewport restored. Five explicitly identified
owned preview processes were stopped after a graceful-close attempt. Both exact
QA wrapper modules were removed before the post-preview archive audit. Resource
verification reported no remaining owned processes; reused PIDs were ignored.

## Remaining acceptance

The source-readiness review confirmed that V09/V16 already contain verified
offer filtering, bounded recovery, live booking confirmation, distinct period
pages and scheduled warming. A remaining core release gate must prove accepted
snapshots for every currently exposed preset before accepting rollout. It must
accept a verified genuinely empty response and reject an unverified refreshing
response. It must not restore blocking supplier calls to ordinary page loads.

Matching-generation private cloud jobs, owner-scoped Site publication, business
database/media restore, coordinated Edge/private protocol activation, public
smoke, first/repeat navigation measurements and real consented field percentiles
remain unverified. No deployment, DNS change, upload, booking, payment or outbound
business message occurred in this qualification.
