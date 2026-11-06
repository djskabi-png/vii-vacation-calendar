# Phase five: scheduling recovery, request reads and release identity

Work in progress. Documents one and two remain the active scope. Document
three stays deferred. This phase has not been published or activated.

## Scheduler and operator recovery

The real scheduled handler now creates a durable job, links its admission and
only then dispatches to the monitor queue. A failed admission consumes its
slot but does not prevent unrelated checks from being admitted. All 61 actual
registry identifiers produce distinct keys accepted by the durable job store.
This caught a previously invalid key containing dots before private activation.

Unknown admissions are visible in the private dashboard. Inspection finds the
original durable intent without creating or sending another job. An explicit
operator action can permit a future admission while retaining the original
record and first actor in an atomic audit. Active jobs cannot be cleared; late
dispatch/delivery from a superseded admission cannot execute a check. Fresh
readback verifies the saved decision, including an inspection racing an
operator decision. A no-op batch cannot be reported as successful.

The actual private handler, delegated permissions, replay protection and
reconciliation execute in the bundled Worker runtime with SQLite fixtures.
Operator callback tests cover view-only, busy, scoped action, unknown response
and no automatic resend. A compiled visual check is still required.

Auxiliary schema initialization is centralized. The new reconciliation audit
is an additive fifteenth quality table when initialized. The isolated cloud
database still has the fourteen tables read back in phase four. Its services
remain on the recorded older versions with authority/execution/scheduling off.
No business database or quality history has been migrated.

## Request-only sharing

Home's two server sections share their bundled catalog projection through a
factory created inside HomePage. This saves duplicate local projection work,
not supplier or D1 requests. Review details already use one batch.

The Worker creates an AsyncLocalStorage scope per incoming request. Published
search metadata/page reads share a bounded promise only inside that scope.
The next request rereads the database. Tests cover simultaneous requests,
failed reads, the memory limit, publication precedence and a changed next
generation, including actual Worker-runtime isolation. Stream boundary tests
retain the original progressive Home sections with their new reader props.

## Public performance diagnosis

Small old-public HTTP samples remain multi-second. One paired spa request had
Edge MISS, origin page-cache R2 HIT and 3.374-second TTFB. Its stored origin
cache timing was 1083ms; it does not explain the full delivery delay. A later
global-R2 Edge HIT proves that the binding/path can serve a stored object.
Origin timings retained inside that object must not be mistaken for the
current Edge lookup time. These samples are not browser percentiles or proof
that this candidate has improved public speed.

New delivery timing separates current Edge lookup and origin fetch. Cache
warming counts only responses accepted as HIT/MISS, not any successful HTTP
response rejected for build or privacy. Neither change removes content,
changes variant/privacy eligibility or purges public cache.

## Release operator

Build identity is derived from deployable source inputs rather than the clock
or HEAD alone. Text newlines are canonicalized and binary bytes retained.
Documentation and tests do not define the public cache namespace. This is a
source-input identity, not proof of byte-identical compiled artifacts.

The handoff requires the strict candidate validator and exact source, tree,
environment, build identity and artifact digest. It reports passes and skips
separately. Candidate receipts must carry the same build identity. A remote
rebuild must still match the tested artifact before deployment; this has not
yet been exercised through the managed publication operator. Exact-artifact
delivery, real provisioning receipts, rollback and all remaining candidate
evidence are still required. No publication-approved manifest exists yet.

## Verification boundary

Targeted request/stream, controller, actual-runtime authorization, Edge and
identity tests passed. Full TypeScript passed before the last Edge/operator
changes. An integrated frozen build, full suite and compiled UI checks must
follow before this phase can be accepted. No claim of whole-project readiness
or future-proof correctness is made from these local tests.

The first frozen integrated run (source `77e347e3`, tree `c8e801d8`) passed
TypeScript, 27 controller tests, 15 browser tests, both private packages and the
managed build. Its full suite failed: 2380 total, 2372 passed, seven failed,
one existing skip. Two Home source contracts still expected the previous
parameterless component/read spelling. The actual Worker source harness had
removed the new request-scope import without supplying the real dependency,
causing five related cases to throw before exercising the Worker. Those readers
were updated while preserving their original stream/failure/lazy-load checks.
The original failed run remains failed. A fresh frozen run is required.
