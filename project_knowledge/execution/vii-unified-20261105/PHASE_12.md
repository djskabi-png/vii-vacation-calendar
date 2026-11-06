# Phase twelve: retained immutable assets

The Edge now has a narrow read-only fallback after an origin404/410 for a
public content-hashed `/assets/` file. Current successful assets keep their
normal path with no added storage read. HTML, RSC, API, private routes,
authorization, actions, range requests, queries and un-hashed filenames cannot
use this fallback. No similar-name current asset can replace the requested one.

Private R2 envelopes bind the exact pathname, original Git source, Site build
namespace, byte count, SHA256 and bounded retention period. The reader checks
actual bytes and metadata, rejects corrupted/expired/oversized objects, has a
total deadline, cancels late/stalled reads, strips all origin metadata and
serves the correct fixed MIME with nosniff. Runtime requests never write R2.

The preparation tool operates on the complete hashed-assets inventory of an
actual audited immutable Site archive. It first proves frozen Git ancestry,
unchanged Site inputs and exact artifact digest, then reruns the full archive
payload audit against the compiled output. All entries are validated before
an owned local output directory is created. Prepared envelopes and the local
inventory record their original source/build and seven-day expiry. Preparation
does not upload, deploy, or assert that the supplied archive is currently live.
No sampled public-page crawl is represented as a complete asset inventory.

All48 Edge module/handler tests passed, including the five new retention
scenarios. Full TypeScript and actual Wrangler dry-run packaging passed. One
actual bundled Edge/workerd test used real local R2: origin404 returned the
exact preserved prior JS; origin200 returned its current bytes unchanged;
an unknown object remained404. The installed local runtime supports only the
May22 compatibility ceiling. It does not prove newer production-date behavior.
The initial harness import used unhoisted transitive dependencies; resolving
them through installed Vite/Wrangler fixed it. Its next start exposed the local
runtime ceiling; matching that supported date fixed the distinct mechanism.
Both failed observations remain in their logs.

Logs: `.qa-output/phase12-edge-retention-tests.log`,
`phase12-typecheck.log`, `phase12-edge-package.log`,
`phase12-retention-supported-runtime.log`.

The first preparation against the full actual phase-eight archive stopped
before output creation on a genuine empty compiled JS module. Empty generated
modules are valid assets and must remain in the inventory. The encoder/reader
now preserve their exact zero bytes and empty-content digest. A new regression
and the real-workerd test passed together7/7. No asset was omitted to get past
the check. The original failed preparation receipt is retained before the
bounded repaired attempt.

## Open release integration

The actual previously public build is `00bca36c-4f1c-403d-9a13-ceea797015ae`.
Its full compiled archive has not yet been recovered and seeded. The only
qualified local full archive is the newer phase-eight candidate. Preparing
that archive protects a future rollover only after actual upload/readback;
it does not protect the currently live old build by itself.

Read-only browser review reached the correct Site settings. Its Edit control
routed to the local project; the older Publish VII Release chat still displays
an unfinished historical v737 operation. No message or deployment was submitted
there and that uncertain operation was not restarted. The settings tab was
restored; user tabs were retained. This is an unresolved archive-recovery
workstream, not evidence that all account access is missing or that Adir must
perform an action. Other core work continues.

Before public rollout: recover/verify the actual old artifact, prepare and
seed its full immutable inventory without overwriting another identity, verify
actual R2 reads through the deployed Edge, and include that receipt in the
release/rollback gate. No public Edge update has occurred in this phase.
