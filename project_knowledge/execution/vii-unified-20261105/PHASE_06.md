# Phase six: private browser execution family

Local implementation in progress. No public publication or cloud activation
has occurred. The document-three backlog remains deferred.

## Executable profiles and bounded transport

Twenty-six static profiles cover four core worlds, desktop/mobile, world
opening, map opening/closing and responsive layout. Two vacation gallery
profiles are included; other-world gallery behavior is still unsupported.
Profiles carry immutable metadata with actual graph ownership and plan IDs.
They are separate from the retained 61 HTTP checks and do not inflate that
registry's coverage or supported manual levels.

The browser definition also hashes engine, transport, profiles and the pinned
SDK inputs. It is checked by both private Workers' custom-build step and a
test. Runtime requests and results carry that definition hash. A queued job
cannot silently use an updated browser oracle under the old definition. This
uses the documented Wrangler custom-build hook, verified against the installed
CLI: https://developers.cloudflare.com/workers/wrangler/custom-builds/.

The executor uses a fixed private Service Binding URL, sends no cookies or
authorization and checks source SHA, build UUID, job, world, viewport and
scenario. Fetch and response consumption have a deadline, cancellation and a
16KB response limit. Evidence keys must belong to the exact source/job/device/
scenario. A passing result cannot carry failure evidence or an error reason.
The browser engine also checks the expected visible world heading; a build
header plus an error page's main element is not a healthy world.

## Durable execution and resource ownership

New browser jobs keep an explicit Git source SHA and build ID in their frozen
snapshot. Historical HTTP jobs retain their existing build identity field.
No history is relabelled as Git provenance. One shared builder creates the
definition at admission and reconstructs it before execution. The full profile
and check are hashed; a changed build/definition blocks before launch.

Browser execution has its own 55-second job lease and a single global D1 lane
across release/monitor queues. It does not borrow the HTTP runner's 24-second
slice. Work is bounded to 50 seconds, including the browser service's cleanup
allowance. Cancellation checks run at most once per two seconds with one query
in flight, rather than an overlapping high-frequency polling loop.

Receipt and completion use the existing lease-token/cursor fences. Expired
cleanup may block only its own expired token and cannot revoke a newer owner.
Interrupted active work is never replayed. If transport/abort is ambiguous,
the global browser lane remains reserved until its original expiry. Normal
completion releases only the matching owner. Progress and incident projection
reuse the existing history model. The browser lane adds a sixteenth quality
table when initialized; the isolated cloud database still has the fourteen
tables verified during phase four.

## Controller and administration

The private controller advertises profiles separately and rejects admission
until execution, browser flag, private binding and exact identity are ready.
Browser jobs use the same queued API, polling, cancel and history as HTTP jobs.
The new controls have their own responsive styles and respect edit permission.
Pending browser intents persist the original profile/key across remount and
changed selectors. An unverified authority response does not clear that intent.
Restored selectors show the actual retained profile.

The Wrangler source declares a private binding to the existing browser worker,
but all activation flags remain false. That updated configuration has not
been deployed. It is not evidence of an active cloud browser pipeline.

## Verification so far

Sixty-eight targeted tests passed, including controller/executor, SQLite job
ownership, cancellation, interrupted work, changed definitions, newer-owner
fencing, browser engine and actual UI-intent functions. A bundled workerd test
uses real D1 and a real private Service Binding to a synthetic browser worker.
The controller reaches that binding and persists a successful result; a second
result with a mismatched build blocks without a passing receipt. The fixture
does not rewrite result identities. This proves local runtime transport and
fencing, not a real Cloud Browser session. Source authorization has a separate
actual workerd attestation test.

Full integrated TypeScript/build/suite, compiled controls on desktop/mobile and
the actual private Cloud Browser/Queue smoke remain required. Browser scheduling,
private evidence retrieval, migration/drain/restore, notification delivery and
the remaining approved product/performance chapters are not complete.

The managed Site's source-input cache identity now excludes independently
deployed services. A private-controller or Edge-only change does not invalidate
the Site namespace. Exact service/artifact digests remain separate release
evidence. Framework-generated secrets remain unpredictable and are not printed.
