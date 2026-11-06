# Phase ten verification

Frozen source `089db24dbab80985dacef9f194a43b7219c44ab0`, tree
`9de8ac6de9a95cf2903edb1a642b2d2b3c61a679`.

Clean source integrity passed with28 protected ancestors and22 capabilities.
Full TypeScript,57 controller tests,23 browser tests,4 actual-workerd tests
and both actual Wrangler dry-run packages passed. These are affected private
unit checks; the unchanged Site's full suite belongs to phase eight.

The real Git-input reuse validator confirmed the identical phase-eight Site
archive at this descendant. Its namespace remains
`56aa19f5-e92b-ea34-5c93-fa95cb68863d`; archive SHA256 remains
`3f759335d8c87e8f760ebc18ae40e000ca6fbd81e775cedb1f12e4f5a819ef3b`.
No Site rebuild, upload, publication or public Edge deployment occurred.

## Actual private deployment and Cron

Browser version `41970eb6-8585-4a15-8a89-82e6898d0dbf` and initial controller
version `5a457b8a-f765-433a-931c-e2458e2e4b5f` were privately deployed from the
frozen source. Readback verified source/build and disabled public subdomains
and previews. Before activation there were zero active jobs/browser lanes,
zero notification deliveries and no prior scheduler admissions.

One controlled actual Cloud Cron window selected only `global.home.semantic`,
browser execution off, expiry `2026-11-06T03:43:21.420Z`. Temporary controller
version `6a22090e-4d94-4a43-8137-ad25d52ae59d` ran via its unchanged minute Cron.
No manual Queue message or HTTP trigger was used to simulate scheduling.

At `2026-11-06T03:41:07.129Z`, admission bucket5979788 linked run
`393ed416-69ba-4ba7-b864-cc92674a0a15`. Its real monitor dispatch was consumed
once. The generation probe blocked the run with `observed_build_mismatch`
before content execution, matching the older public Site build. The job has
zero check receipts/results; the projection records one blocked check.
This is real negative pipeline evidence, not a passing public content check.

Historical HTTP job `source_version` contains the build namespace. It is not
relabeled as a Git commit. Exact deployed source is separately recorded above.

## Quiescence and scope

Controller version `0e487166-3750-4239-b6c5-e5e8c89391a4` restored all four
activation flags to false. Actual readback verified zero active jobs, no
browser lane and zero notification deliveries. The prior negative browser
smoke's single superseded notification remains historical. Both services
remain private. Admission/job/projection/outbox history was preserved.

Public Edge remained `605a1a2c-3714-4fbb-befd-5eb603609254` at100 percent.
No business data, bookings, payments, messages, DNS or public release changed.
The owned local process verification returned no remaining process.

Receipts: `.qa-output/phase10-frozen-*-operation.json`,
`phase9-retained-site-proof.json`, `phase10-private-inactive-readback.json`,
`phase10-cron-{on,off}-operation.json`, `phase10-real-cron-readback.json` and
`phase10-final-cloud-verified.json`.

The initial read-only observer used a nonexistent `updated_at` column on the
scheduler table and received400. Reading the actual schema and sorting by
`created_at` fixed that query; no write was repeated. A preactivation local
date-conversion check also stopped before deployment or operation reservation;
using the already-parsed DateTimeOffset corrected it. These observer issues
do not count as Cloud Cron failures or successful runtime tests.

Matching-generation public acceptance, continuing schedule activation,
per-unit global release orchestration and the broader core plan remain open.
