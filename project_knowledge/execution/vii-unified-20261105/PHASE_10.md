# Phase ten: bounded Cron canary and HTTP generation fence

Local implementation in progress; no new cloud activation is claimed here.

Private HTTP jobs now probe the actual anonymous public document's build before
content execution. A mismatch or unavailable generation blocks the queued job
with a bounded, controlled reason and no fabricated check receipts. The state
update is conditional on the same queued cursor/source and no active check or
cancellation; it cannot revoke a newer running owner. The real HTTP executor
also rejects an HTML response without generation proof, or any reported build
that differs, even if another route's probe matched.

JSON/data checks without document-build headers retain semantic/data scope.
They do not independently attest a data-generation or separate image-worker
release. Browser generation checks remain independent.

The scheduler accepts an explicit validated check-ID selection. Missing
selection retains normal registry scheduling; an explicit empty array admits
none. Unknown/duplicate IDs fail closed. A bounded optional UTC expiry stops
the scheduled handler before database work after its test window. Production
operation without an expiry retains normal scheduling. An isolated canary
therefore must provide both a selected check and a short expiry; no empty
default is treated as evidence of a bounded test.

Local tests cover selection, expiry, duplicates, cadence, generation mismatch,
body cancellation and a newer-owner race. The actual bundled Worker was also
run under workerd with real local Queue and D1. Its scheduled handler admitted
one selected check, dispatched it and persisted a blocked projection against
an older synthetic generation. With a matching generation it executed the
semantic check and persisted a passing receipt. A second invocation admitted
nothing before cadence. This is synthetic local runtime evidence, not actual
Cloud Cron execution or public acceptance.

Official local scheduled-event interface:
https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/.

The Site's runtime inputs and namespace remain unchanged from the qualified
phase-eight archive. This private-controller change should package/deploy the
affected private unit and retain the exact tested Site artifact. The separate
unit-input proof must pass for that reuse. No global release gate is bypassed.

Before an actual cloud canary: freeze and qualify these private inputs, verify
the isolated resource IDs and absence of active jobs, deploy privately with
all flags off, then temporarily allow one selected HTTP check within less than
its five-minute cadence. Keep browser execution off, no provider credentials,
no public route and no Edge/Site change. The older public build is expected to
block before content checks. Retain the original admission/job/dispatch, never
resend an uncertain result, then restore all flags off and verify active work
and notification state. Matching-generation cloud acceptance remains separate.
