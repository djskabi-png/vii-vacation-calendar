# Phase27: time validity of discovery evidence

The phase26b frozen run at `c1ff8ee0` passed source guard, full TypeScript, build,
the full2,472-test application suite (2,471 passed, one existing skip), and all94
private-controller tests. Controller compilation and its exact package audit
passed. Its retained digest is
`7da13462fade3551c7c9c319c37ae149dd2f4ddd34e5d5491704b7e87bc61cb7`.
No Site archive was packaged at this checkpoint because the following identified
time-validity correction requires another source freeze. This avoids packaging
a known intermediate candidate as the final release.

A readiness result can be valid at execution and expire while waiting for the
rest of the release suite. Context freshness alone did not prevent acceptance
after the snapshot TTL or the14:00 change of dates. The source executor now
produces `evidenceValidUntil` from the validated snapshot and clock:

`min(snapshot.checkedAt + one hour, next Israel midnight/14:00 boundary)`

The boundary calculation uses the actual Israel timezone, including DST, with
a bounded in-memory search. No network, polling or supplier work is introduced.
A response that arrives after its proof deadline cannot pass. The real job
executor carries the deadline through its original CAS-written durable receipt.
Release evaluation requires this original receipt deadline and rejects missing,
expired, noncanonical or extended values. It never refreshes the timestamp or
replaces completed jobs. General subject expiry and source/generation fences
remain in force. Other check families retain their existing behavior.

The semantic definition is now `discovery-readiness-v2`, included in the immutable
job configuration/hash. The deadline is an execution output, unknown at job
creation; it is not a caller claim or an input to retroactively rewrite. Original
provider rows and the trusted source/generation are the evidence authority.
This is not a claim of a cryptographic signature over every database receipt.

Twenty-five focused tests passed across readiness, the real SQLite job store,
subject evaluation, provider reader and actual shared executor. They verify
expiry at the exact boundary, DST dates, snapshot TTL, missing/extended proof,
preservation in the real scheduled execution path, and that a complete35-job
subject becomes blocked when its original discovery receipts expire, without
rerunning or changing its jobs. Controlled full-suite fixture receipts remain
explicitly synthetic; they are not production executions.

Independent review confirmed the identified expiry gap and the bounded contract.
The final source, full suite, exact artifacts, owner-context publication, real
cloud/public acceptance and business/media restore are still separate gates.
Document3 remains deferred. No cloud write, deployment or business action was
performed in this correction.
