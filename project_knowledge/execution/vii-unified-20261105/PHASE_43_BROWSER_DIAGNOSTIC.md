# Current browser diagnostic and separately released quality services

Public application v811 remains source `1d96d3c4c8222a21674b092c34ad54895956743b`,
build `2f74283b-12fe-cffa-db0b-5dab682e329b`. No additional Site publication was
performed for the private-service changes.

The private budget-diagnostic and numeric SDK-limits changes were independently
activated from `ea37641352dfede2d7d479a65885373f59b61fec`:

| Unit | Actual active version |
| --- | --- |
| Browser | `0a41a599-451b-4d96-8b78-182fecceb9c7` |
| Controller | `e188cdca-e93d-4477-bf4a-1042286a4200` |

The original Site, Edge and image artifacts passed input-fingerprint, byte/hash
and ancestry reuse checks and were retained. The 133 private tests and both
TypeScript checks passed. Automatic quality scheduling remains disabled pending
formal release acceptance. The deployed private `/limits` route has executable
SDK-shape/privacy/timeout coverage but has not yet been read from the live binding.

At `2026-11-06T14:33:36.517Z`, root clicked the actual authenticated admin
browser-test button once for `vacations-mobile-responsive-shell`. The exact job
`96848edf-4eb1-4ac2-85a0-e3d00923c3fa` completed at
`2026-11-06T14:33:47.598Z` with one passed receipt, `browser_observed`, and a
6954ms browser execution. The UI showed one completed, one passed, zero requiring
inspection. A separate read-only private D1 query confirmed the same result.
This is a real manual diagnostic, not an immutable full-release subject or a
page-load performance benchmark. It does not explain the earlier transient
`write_request_attempted` failure of this profile.

Root also confirmed a separate false gallery-test mechanism: desktop inline
arrows are mobile-only, whereas opening the real viewer exposes its working
Next/Close buttons. Actual public viewer navigation changed the image and closed
the dialog. The private scenario repair and stronger regression fixture are
being qualified locally before another formal browser subject is admitted.

Whole V plus QQQAAA acceptance, exact full browser-family results, first-open
performance and remaining administration/recovery evidence remain open.
Document3 remains deferred. No existing incidents were manually closed.

Evidence: `.qa-output/phase41-*`, `.qa-output/phase43-ui-browser-diagnostic-operation.json`
and `.qa-output/phase43-diagnostic-readback.json`.
