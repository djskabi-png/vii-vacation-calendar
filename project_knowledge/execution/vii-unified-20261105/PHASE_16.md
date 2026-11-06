# Phase 16: consented experience measurement, local implementation

Status: implemented and locally tested, not deployed or activated. This is
part of the unified V and QQQAAA core. Document 3 remains deferred.

## Implemented boundaries

- The public layout mounts a null UI collector. Its runtime is dynamically
  imported after the existing optional measurement consent. The pinned
  standard `web-vitals@6.2.3` observers load only after a matching build policy,
  eligibility and sampling admission. No attribution selectors are collected.
- A document has one sampling draw, at most two policy requests, 32 sends,
  128 metric observations, 64 pending values, two concurrent sends and a
  23-hour observation lifetime. Uncertain/failed sends are discarded, not
  retried. Buffers are memory-only and consent revocation clears pending
  values and aborts requests. Official persistent observers are registered at
  most once and callbacks check current consent before recording.
- Standard LCP, INP, CLS and TTFB are separate from navigation commit, rendered
  results, map readiness, visible gallery images and client error counters.
  Unsupported APIs have null durations. Hiding the document cancels pending
  journey timings rather than fabricating a timeout. Map/gallery instances
  use local scope IDs that never enter a network payload.
- Public URLs are projected locally to world, route category and language.
  Transport excludes paths, search terms, coordinates, account/session IDs,
  stack traces, contact information and form contents. Existing browser
  cookies reach the first-party Edge request normally, but are never forwarded
  to the private controller. Staff sessions and recognized automation are
  excluded. This is not a claim that all bots or unauthenticated staff can be
  identified, nor a total-traffic census.
- A dedicated Edge policy/ingestion gateway requires a fixed public origin,
  configured application source SHA, matching build namespace and sample
  rate. Body reads and private transport are bounded. Private service calls
  receive only canonical validated JSON. Collection flags are explicitly
  false in both Worker configurations. No production metric tables were
  created in this phase.
- The private quality database receives metric histograms and short-lived
  observation deduplication records, separate from business analytics. A
  transaction moves a revised metric between bins, instead of counting the
  revision as another visit. Conflicting IDs/revisions/generations reject the
  entire batch. First observation windows remain stable across revisions.
- Retention deletes at most 500 rows per table per invocation: batches and
  observation IDs after 24 hours, histogram bins after 30 days. Its Cron
  branch is independently gated; a retention failure cannot stop quality
  recovery. Runtime retention is not yet activated.
- Authenticated summary reads use the existing exact-target attestation and
  one-time nonce. They cover completed five-minute windows in the preceding
  24 hours, isolate source/build, cap output at 2,000 aggregate rows and fail
  closed on invalid bins/counts or overflow. Counts mean metric observations,
  not visitors. Percentiles are histogram upper-bound estimates, available
  only at 20 numerical observations, with timeout/error durations included
  when measured. CLS retains scaled-score units, not milliseconds.
- The quality administration panel has a separate on-demand summary read.
  Opening the main dashboard adds no metrics fetch. Empty, disabled,
  unavailable, invalid and truncated states cannot become a green result.
- The release impact graph now owns experience contracts/client code, the
  shared gallery, progressive results and the root layout explicitly. Shared
  contracts reach their private/Edge consumers; unchanged consumer services
  require verification, not automatic republication.

## Local evidence

- `phase16-focused-tests.log`: 188 focused tests passed, zero failures,
  cancellations or skips. Covers the actual SQLite transaction adapter,
  concurrent retry/revisions, rollback, full Edge-to-private ingestion,
  privacy/consent lifecycle, unsupported APIs, independent map instances,
  bounded summaries, private UI reads, gallery/mobile controls, Edge/cache
  families and cumulative ownership/quality scope.
- Full TypeScript check passed; output is `phase16-typecheck.log`.
- Modern Hebrew font source audit passed for the changed quality panel.
- `git diff --check` passed.
- Independent read-only review found no remaining substantive defect in the
  then-reviewed ingestion/summary/authentication boundaries. Its initial
  observer-reset suggestion was rejected and retracted after verifying the
  persistent web-vitals API and a post-regrant callback test. Subsequent local
  refinements still require final exact-artifact independent acceptance.

These are local source/test observations, not public speed measurements or
release readiness. The existing phase13 application archive remains a
historical qualified artifact; it does not contain these changes.

## Required before activation/completion

Freeze/build/package the next exact cumulative candidate; inspect the real
desktop/mobile administration states and public flows; verify source/build
settings and private bindings through per-unit publication controls; apply
quality schema only to the verified separate database; observe a bounded
canary and consent revocation on the deployed generation. Keep collection
off until these gates pass. Rate/cost safeguards and end-to-end observation
coverage must be checked before widening sampling. Further coverage of
initial result readiness, request/data stages and every world family remains
open; this slice does not close all of Q09 or Q17.

Remaining unified core work also includes global per-unit release
orchestration, exact main publication authority, retained-asset fallback
deployment, business-data restoration proof, source/cache generation
coverage, map/provider acceptance and complete public/admin verification.
