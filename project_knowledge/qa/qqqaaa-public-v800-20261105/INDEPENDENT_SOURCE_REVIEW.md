# Independent source review, QQQAAA public v800

Verdict: **not_ready**.

Reviewed the cumulative working tree after the QQQAAA findings and the current source diff. Focused tests were run with `pnpm exec tsx --test` for the catalog, booking identity, map selection, media quarantine, SPA package and weekday families: 39 passed, 0 failed.

Those tests are useful regression evidence, but they do not close the live release blockers recorded by QQQAAA.

## Confirmed source findings

### Critical: the lazy catalog repair can recreate the memory problem

`app/api/catalog/route.ts` changed the bundled list path to `await bundledEntries(world)`. `bundledEntries()` now calls `acceptedSergeyDetail()` for every accepted vacation/event summary through `Promise.all`, solely to derive bedrooms. `acceptedSergeyDetail()` dynamically loads the complete `sergey-place-details.json` module for each call. Although module import deduplication prevents repeated file parsing, the list request now eagerly traverses all accepted detail records and creates a full detail-enrichment promise set for the entire world. This is the opposite of the intended bounded catalog/list path and is a credible memory regression for the public catalog/API and any caller that uses it during homepage discovery.

Evidence: `app/api/catalog/route.ts:28-40,143`; `app/lib/accepted-bundled-catalog.ts:19-25`. The focused API tests pass, but they do not assert bounded detail loading or peak memory. This must be profiled or redesigned before release. List responses should remain summary-only; details should load only for an explicit `id` request or a bounded, explicit detail consumer.

### Q800-004 remains open

The QA evidence records an actual public full-reload 500 caused by `exceededMemory`. The current source changes reduce static startup imports, but no live closure, allocation trace, or bounded catalog-list proof is present. This remains a critical no-go.

### Q800-001 remains open

The QQQAAA finding reports the Sigd holiday slider showing an error while its API is populated. The policy addition in `app/api/vii/home-holiday-deals/route.ts` is not a demonstrated UI repair. No actual public retest or source proof ties the error to that policy change.

### Q800-005 remains open

The browser-back stale booking view is still listed as open public. No source change in this candidate proves route-boundary cancellation or DOM reset for the booking-to-home transition.

### Q800-006 remains operationally open

The admin catalog-sync screen reports no successful publication for four worlds in 24 hours and a late online-list refresh. This is an operational readiness blocker until the actual scheduled job or its failure is diagnosed and recovered. Read-only UI settling does not close it.

## Repairs that were independently supported

- `roomID` is now propagated by the actual `dealAvailability` adapter, and the actual card href test passes for 1, 2 and 3 nights plus invalid-room negatives.
- Map selection uses the result pane's `scrollTo` instead of document-level `scrollIntoView`; the actual effect test passes for reduced and normal motion.
- The exact StayLoft media filename is quarantined at the shared normalization boundary, with general/unit gallery identity tests passing.
- SPA audience changes use a pending-date ref, preserving the selected date during navigation; focused date/audience tests pass.
- The detail JSON is no longer a static worker import, but the list-path eager enrichment described above undermines the intended memory boundary.

## Untested or not closed by this review

No full build, public browser retest, Cloudflare owning-Site memory trace, scheduled catalog execution, or 1280/390 complete journey was run in this independent pass. The existing QQQAAA public findings therefore remain authoritative for go/no-go.

## Required next action

First remove detail enrichment from the unfiltered `/api/catalog` list path or prove a bounded, summary-only equivalent with an actual memory/runtime test. Then reproduce the public home reload and holiday slider, browser-back booking transition and catalog-sync operational state on the exact candidate. Until those checks pass, v800 must not be approved or published.

## 2026-11-05 re-review of the catalog repair

The latest candidate changed the list path to a compact `accepted-bedroom-index.json` and removed the `acceptedSergeyDetail()` call from `bundledEntries()`. I verified the source directly: the unfiltered list path now performs summary mapping plus the compact index lookup only; detail loading remains behind explicit `id` fallback/detail paths. The accepted catalog lazy-detail test covers all positive bedroom totals and all 635 index records, and the focused catalog/API regression family passed. The historical `Promise.all` list-hydration finding is therefore **closed locally for this candidate**. It is not evidence that the public OOM is closed.

The async callers were reviewed: `catalogResponse`, `publicCatalogDetail`, review previews and detail fallbacks now await the async detail loader. The existing focused catalog tests passed after this change. The public Q800-004 memory failure remains open until exact-candidate live reload and owning-Site runtime evidence pass.

Additional current blocker: QQQAAA captured an hourly sort discrepancy, with one-hour and two-hour results not matching the requested sort. That finding is not touched by this candidate diff and remains open.

## Final report consistency review, 2026-11-05

`QQQAAA_REPORT_HE.md` and `FINDINGS.json` are factually scoped correctly. They say **not approved**, distinguish public observations from local repairs, explicitly state that mapping 85 route templates is not manual coverage of all 85 routes, and do not claim that the 29-runner or full suite proves the product journey. They also correctly state that local repairs were not published and that the public OOM, back/stale booking view and catalog refresh operations remain open.

The final candidate evidence adds the wrapper result of 2,172 total tests, 2,171 passed, 0 failed and 1 skipped, with the completed startup verification showing a 301,793-byte compiled entry below the 1MiB budget and 275 server modules with literal imports resolved. These are supporting source/build gates only, not a public approval. The hourly sort discrepancy remains an open public finding and is not closed by the candidate-local model tests.
