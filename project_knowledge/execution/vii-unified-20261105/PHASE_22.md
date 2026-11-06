# Phase 22: durable release subject binding

Status: implementation contract, no activation or deployment.

Source: approved V release isolation and QQQAAA durable execution chapters.
This extends the active task contract and its QA/data lessons and predictive
preflight. Document 3 remains excluded.

The next bounded increment registers an immutable release subject in the
existing private quality database before admitting its verification jobs.
Registration is context, never proof of execution or publication approval.
Its subject digest is computed from a canonical descriptor with
source/tree, application build and original unit sources, artifact/environment
set digests, current server-derived check definitions and a bounded time window.
The runtime verifies its own application/controller/browser source, build and
server-derived definitions. Artifact/environment digests are registered context
until the release verifier independently matches audited artifacts and provider
configuration readbacks. The subject digest is deliberately not a runtime
binding: that would create a circular dependency in the environment digest.
Existing authenticated request attestations remain mandatory; no new secret,
public route or trust root is introduced. A new activation flag defaults off.

Dispatch and consumption revalidate the subject. No new slice starts within
70 seconds of expiry, exceeding the existing 20-second HTTP slice and 50-second
browser transport deadlines. This is a bounded admission fence, not a claim of
an atomic distributed kill switch for a request already running. Evidence reads
reject the subject at its exact expiry and cannot approve a late completion.

The server owns the required runtime suite: its full HTTP registry and every
registered browser profile. Callers cannot omit checks, provide receipts or
replace definitions. Each explicit admission creates at most one deterministically
keyed job for that subject/check. Ordinary admin and monitor flows retain their
existing behavior and cannot use the reserved release key namespace. Retries
reconcile the same durable job and existing dispatch outbox; they do not create
a replacement for a failed, uncertain or completed operation.

Acceptance includes: disabled flag; altered stored subject digest; invalid/expired
descriptor; unit source/build/definition mismatch; conflicting re-registration;
unregistered admission; unknown check; partial suite; failed/blocked/cancelled
jobs; duplicate/missing receipts; tampered snapshot; old generation; idempotent
admission; actual SQLite persistence and reconstruction after module/controller
recreation. Every required job must be completed with exact current definitions
and passed receipts before the read model can call runtime evidence passed.
That result still does not approve artifacts, rollback, local tests, ownership,
production deployment or the complete product. The global local tool remains
verification-only until authenticated provider readback is integrated and tested.

The first midpoint is private admission plus durable SQLite tests, reviewed
independently before freezing another controller artifact. No application or
unchanged-service rebuild is required merely to exercise these source tests.
Cloud evidence, matching-generation canary and the full project finish gate
remain separate outstanding requirements.
