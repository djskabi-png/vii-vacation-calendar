# Separate application generation from cache admission

The original public release subject reported `target_generation_unavailable` for
`world.last-minute.semantic` and `content.contact`. Direct read-only requests
on2026-11-06 confirmed `/last-minute` returns200 HTML without a cache-build
header; `/contact` redirects308 to `/join`. Cache eligibility does not establish
whether a document belongs to the current application generation.

The old generation verifier required the cache header on every HTML response.
An actual uncached-response regression reproduced the false rejection. The
Worker now labels application-generated responses with `X-VII-App-Build`.
HTTP/browser verification accepts that identity while retaining the older cache
identity compatibility path. If both headers exist, either mismatched value
still blocks verification. Cache eligibility, cookie rules, cache expiry and
transactional revalidation are unchanged.

The changed generation family passed24 tests. The frozen77cc8e07 suite had
2476 passed, three failed and one existing skip. Those three failures came from
an existing VM fixture that returned a database stub for every import and did
not provide the newly imported real request-scope helpers. They are preserved
in phase36 logs. The fixture is being corrected and the new source will receive
a fresh full qualification. The earlier result is not called passing.

The77cc8e07 Site build and TypeScript checks passed; private controller/browser
suites passed96/29 respectively. Two dry-run Worker bundles were generated, but
artifact capture correctly rejected the subsequently changed worktree. Those
bundles are not qualified publication inputs and must not be deployed.

Public v810 remains the actual active application. The new fixes have not yet
been published. Original failed/blocked runtime results remain unchanged.
