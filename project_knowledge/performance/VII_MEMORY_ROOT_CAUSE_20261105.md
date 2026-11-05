# Worker memory root-cause evidence

Date: 2026-11-05

## Verdict

`accepted-bundled-catalog.ts` eagerly imports and parses the complete
`sergey-place-details.json` at module initialization. This is a verified
startup-memory mechanism, not only a file-size suspicion. The accepted module
is imported by `public-catalog-read.ts` and the public catalog route, so a
request that only needs summaries can retain the full detail object.

## Measurement

On the release worktree, Node 22 with `--expose-gc` and no application request:

| step | RSS | heap used |
| --- | ---: | ---: |
| process before imports | 62.8 MiB | 3.6 MiB |
| after importing `app/lib/accepted-bundled-catalog.ts` and GC | 121.3 MiB | 24.3 MiB |
| after importing `app/lib/public-catalog-read.ts` and GC | 129.6 MiB | 25.8 MiB |

The accepted module alone therefore adds approximately 58.5 MiB RSS and
20.7 MiB live heap in this controlled process. The source JSON is 7,463,560
bytes, but the measured parsed object and projection allocations are much
larger. This is materially relevant to the documented 128 MiB Worker limit.

## Exact eager path

`app/lib/accepted-bundled-catalog.ts` has a static JSON import for
`sergey-place-details.json` and constructs `summaries` at module scope.
`app/lib/public-catalog-read.ts` imports that module for every catalog read.
Other static consumers include `app/data/supplier-place-detail.ts`,
`app/lib/supplier-catalog-runtime.ts`, and `app/lib/vii-home-deals.ts`.

## Implemented bounded repair

`accepted-bundled-catalog.ts` no longer statically imports the detail JSON.
`acceptedSergeyDetail` now loads it asynchronously only for an explicit detail
fallback. The public catalog read and catalog API callers were updated to await
that contract. Summary generation remains synchronous with the compact catalog
and keeps the accepted IDs, preview fields and search facts unchanged.

The same controlled measurement after the repair was:

| step | RSS | heap used |
| --- | ---: | ---: |
| process before imports | 62.8 MiB | 3.6 MiB |
| after accepted summaries module and GC | 87.2 MiB | 12.7 MiB |
| after public catalog read module and GC | 96.4 MiB | 14.2 MiB |

Compared with the pre-change accepted-module measurement, this removes about
34MiB RSS and 11.6MiB live heap from the summary-only import path in this
controlled process. These are local Node measurements, not a Cloudflare Worker
heap trace or a production SLO claim.

Focused actual tests passed 7/7, including compact summary availability,
detail parity for event-1153, removed-supplier protection, catalog API fallback
parity and media regressions.

## Safe repair boundary

The remaining static consumers (`supplier-place-detail.ts`,
`supplier-catalog-runtime.ts`, `vii-home-deals.ts`, and the legacy availability
route) need a separate build-graph audit before claiming the whole application
is free of eager detail retention. This repair only claims the accepted public
summary/catalog-read path.
Do not delete, truncate, or cross-fallback detail records. A build graph check
must prove that the summary route no longer retains the detail JSON, and an
actual detail request must prove the exact same record is returned.

This report intentionally makes no production or schema change. Publication is
not claimed.

## Built graph verification

The single approved local build completed successfully after the repair. Its
server artifact graph contains a separate `sergey-place-details` chunk of
7,936,270 bytes (`dist/server/assets/sergey-place-details-calendar-close-v25-QoMPWlW-.js`), rather than embedding that payload in
`public-catalog-read-calendar-close-v25-DoMbqp9C.js` (212,819 bytes). The SSR
home live-deals chunk references the detail chunk through the explicit lazy
fallback path. The main server router artifact remains large at 13,147,961
bytes, so this is a graph improvement, not proof that the whole Worker fits
under its production isolate limit.

Remaining static consumers were identified in the graph through catalog-sync
and legacy availability families. They require separate route-level review;
no claim is made that every Worker entrypoint is now detail-free.

## Remaining caller-risk measurement

A second controlled Node measurement isolated the remaining backend import
families (same process, `--expose-gc`, after each import):

| import | RSS |
| --- | ---: |
| process baseline | 62.8 MiB |
| `vii-home-deals.ts` | 76.4 MiB |
| `supplier-place-detail.ts` | 105.3 MiB |
| `supplier-catalog-runtime.ts` after the preceding imports | 99.1 MiB |

These are not Cloudflare Worker heap measurements, but they identify the
remaining high-risk synchronous import: `app/data/supplier-place-detail.ts`
still statically imports the full detail JSON (and legacy agreements/catalog
data). It is used by booking/business page fallbacks and must be split in a
separate detail-page contract, not changed blindly. The catalog runtime also
statically imports detail data for sync baselines and should stay out of public
request paths. The current release candidate therefore has a proven reduction
for public summaries/home discovery and a clearly bounded remaining risk for
detail/admin/sync entrypoints.
