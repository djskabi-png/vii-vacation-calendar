# Phase eight verification

Frozen implementation: `fe439cfc05b80e60073c7abcef5e0ace29241654`.
Tree: `753a7bb29f307006f7e8a1f9b9fdba6f0f132a97`.
Site input namespace: `56aa19f5-e92b-ea34-5c93-fa95cb68863d`.
Browser definition: `f1ac6dab039df672cd1727d6aa7c2495daaad4ac7797ca2118b078329c2be076`.

## Integrated candidate

Full TypeScript, 49 private-controller tests, 23 private-browser tests and both
actual Wrangler dry-run packages passed. The application built in36.52s. The
complete suite finished in65.88s:2,392 tests,2,391 passed,zero failures,one
existing skip,zero cancellations. Clean source/protected-capability validation
passed before this run. Logs use `.qa-output/phase8-frozen-*`.

Actual-workerd coverage now includes the real private controller, real browser
GET implementation and real R2 with synthetic historical evidence, while
execution is off. Exact-query source authorization and another-job rejection
also ran under workerd. An initial test bundling failure omitted Node builtins
from the browser SDK test harness. Declaring the actual node compatibility
externals fixed that harness; the integrated frozen suite then passed. The
failed harness run is retained separately.

## Exact immutable archive

The supported installed Sites packager packaged the existing tested output,
without rebuilding. Archive SHA256:
`3f759335d8c87e8f760ebc18ae40e000ca6fbd81e775cedb1f12e4f5a819ef3b`.
Size:110,412,428 bytes. The audit compared1,227 compiled files, validated1,248
total files including staged declarations,238 RSC asset references and293
server modules. Every literal server import resolved. The initial static
startup graph contained8 modules and348,492 bytes, below its1MiB budget.

The retained archive is
`C:/Users/Adir/Documents/vii.co.il/.release-artifacts/phase8-fe439cfc-site.tar.gz`.
An identical digest-verified copy lives at
`.qa-output/phase8-frozen-site.tar.gz` for in-workspace candidate tooling.
An initial destination under .qa-output was rejected by the supported packager
before packing; the second attempt used its required outside-checkout path.
No upload or publication occurred. These files contain private build inputs
and are not public download links.

## Compiled evidence interface

The exact compiled application was opened in an isolated loopback wrapper.
The UI-only fixture returned the existing negative smoke's result and served
the previously retrieved public screenshot. It did not run a browser, Queue
or supplier call. Selecting spa/desktop and running the fixture exposed one
blocked result. Expanding it revealed the authenticated same-origin evidence
link by job ID, without an R2 key. Direct navigation to that observed link
displayed the1440x900 JPEG. The in-app browser did not expose a new tab when
the target-blank link was clicked; direct resource navigation was verified,
so new-tab creation is not claimed.

Desktop client/scroll width was1265/1265. At the requested375px viewport,
client/scroll width was360/360 with the desktop scrollbar. The mobile result
and evidence link were visually legible and no horizontal overflow or console
error was observed. Returning restored the result. The fixture did not retain
profile metadata in its canned terminal job, so this pass does not verify
selector restoration; the earlier phase-six intent test remains its evidence.

The fixture was signed out, AI-created tab28 closed and the viewport reset.
The first preview launch exited because an inline fixture-generation command
had failed. A standalone generator fixed that local harness. Attempt2 root
PID19212 was later identified, stopped and verified with zero remaining owned
processes. The compiled fixture entry was removed. The original archive was
created before that fixture and passed exclusion checks.

## Actual isolated cloud D1 restore

The dedicated quality database, with one real negative-test job, was exported
again. Backup size9,814 bytes, SHA256
`33c3d192b88e5b8edb0323cad36e1fdf6926efc88e4d7a7a19b9b722f124b85b`.
The original export bookmark was resumed once; no second export was started.
The backup passed local SQLite integrity and was imported into a newly owned,
unbound verification database:

Name:`vii-quality-restore-20261106`.
ID:`0f84625b-f911-44ac-99d4-b0e2f417f807`.

Fresh cloud reads compared all16 quality tables, every column definition,
counts and canonical hashes of every row against the export. The restored
database and unchanged source both matched. The retained job, run, result,
projection receipt, incident, dispatch and superseded notification each had
one row. There were no active jobs, browser lanes or notification deliveries.
All four source controller flags remained false. The verification database is
retained without a Worker binding; it was not substituted for the canonical
quality or business database.

This proves a quality-history D1 restore only. It is not a business database
restore, full R2 restore, active failover or an assertion of zero data loss.
Receipt:`.qa-output/phase8-private-cloud-restore-operation.json`.

## Remaining scope

The evidence changes are still local at this source. No phase-eight private
deployment, public Site/Edge release, Git push, real message or booking occurred.
Core publication, actual scheduler invocation, field/browser performance,
broader data/media recovery and remaining plan chapters are still open.
Document three remains deferred.
