# Phase 3: scope, impact and browser-engine ownership

This is local implementation progress, not completion of the unified project
and not a production release. Document3 remains deferred.

## Map canvas boundary

The c816 candidate was exercised in the actual browser. Zoom, marker selection,
desktop-to-mobile transition and return to the list worked in the inspected
vacation scenario. The browser also exposed a real lifecycle defect: readiness
changed the React class prop and erased Leaflet's container/input classes.
Commit05c0a5aa moves readiness to the React-owned shell and leaves the imperative
canvas class prop constant. Ninety-nine map-family tests passed. The new compiled
candidate still requires the same browser recheck.

The isolated preview was signed out and closed. Its owned process tree was
stopped and verified empty. The exact compiled QA fixture entry was removed.
It must not be included in any deployment artifact.

## QQQAAA scope

All61existing HTTP checks have explicit ownership and approved plan-chapter
references. HTTP assertions are not browser or visual evidence. Selection
expands dependencies and consumers; unknown ownership and incomplete level
coverage fail closed. The administration scope choices expose supported levels
and exact selected counts. A retry after uncertain delivery preserves the same
scope, level and idempotency key. Definition snapshots include scope metadata.

The first integrated quality pass exposed stale single-check test fixtures and
an unsafe proposal to reduce expected coverage to the level-admitted subset.
Expected-versus-executed coverage was restored. Notification uncertainty tests
now select one independent HTTP probe; they retain their original one-delivery
assertion. The quality family passed53tests before the additional admission
tests. The actual runNow function was then tested for retry identity and
validation refusal, and scope options were checked against full closure.

## Release ownership

The source-integrity gate now reads the actual cumulative Git diff, not an
optional example list. Explicit path ownership maps changed boxes to all
transitive consumers, required HTTP checks/local tests and changed build units.
Unchanged consumer services expand verification without being republished.
Unknown/ambiguous ownership, missing checks, invalid paths, cycles and missing
build-unit sources block the graph. All current cumulative paths are mapped.

The source gate is explicitly source-integrity-only and never approves
publication. A separate candidate-manifest validator requires a frozen source,
tree, actual artifact digest, matching/fresh build and test receipts, browser
evidence by affected family and viewport, and rollback evidence. Candidate and
post-publication receipts are separate. Unprovisioned build units block the
publication validator. No current production rollback identity was invented.

## Private browser engine

The separate service uses the official Cloudflare Playwright launch(binding)
bridge and an independently pinned SDK. It has no public route, workers.dev or
preview URL. Anonymous context interception precedes navigation. World routes,
observed build identity, real map controls/markers/close, gallery change,
overflow, request/deadline limits and cleanup have executable failure tests.
Eight engine tests and its own TypeScript check passed locally.

Only the vacation gallery fixture is currently implemented. Other gallery
worlds explicitly block. Cloud Browser Run provisioning, private bindings,
quality D1 migration, Queue/outbox dispatch, evidence lifecycle/retrieval and
the administration engine selector remain required. The service is not live.

Installing the SDK initially encountered an unavailable npm command and then
the parent pnpm workspace selected the root package instead of this service.
An explicitly standalone install with ignore-workspace succeeded with exit0,
pinning1.3.6. No repeated browser or deployment action occurred.

## Remaining acceptance

Run the frozen integrated build and full suite, recheck the compiled scope UI
and Leaflet class preservation, then continue cloud resource identity,
controller/queue isolation, retention/restore, performance measurements and
exact public release verification. Unit counts do not close these requirements.
