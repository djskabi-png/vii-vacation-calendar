# Phase 23: provider-authenticated runtime evidence readback

Status: local implementation and controlled tests; positive cloud acceptance is
not established. No execution, registration, activation or publication operation.

This is the next increment of the approved durable release evidence requirement
and the existing predictive preflight and QA/data lessons. The provider reader
uses the committed private-resource contract and a memory-only Cloudflare token.
It reads the actual single active deployment and immutable version for controller
and browser, required bindings, runtime source/build fields and workers.dev /
preview state. Version-specific downloaded module bytes must match the exact
frozen local package. Source labels alone do not prove deployed code identity.

It reads one bounded D1 batch containing two fixed parameterized SELECTs: the
subject and that subject's jobs. It reuses the server's definition, payload,
receipt, lifetime and context validator over that snapshot, with schema creation
disabled and mutations rejected. Controller/browser deployment identities must
remain unchanged through the read. Artifact/environment context digests must
match the independently supplied candidate audit, not another receipt file.

The reader permits no arbitrary SQL, job admission, upload, configuration change,
request retry or import of a file claiming remote results. Requests use the fixed
Cloudflare API origin, reject redirects, cap response sizes and share a 60-second
deadline. Output omits authorization, private actor identity and module bodies.
It retains provider request paths and response digests as observation evidence.

Acceptance covers exact deployed bytes, wrong database binding, mixed deployment,
deployment rollover during read, disabled authority, workers.dev exposure,
reported D1 writes, missing jobs, exact all-required controlled jobs, altered
candidate context, upstream failure with no retry, and missing/malformed input.
The first controlled test exposed an uninitialized fixture job table; fixture
setup now provisions the real schema before invoking the read-only tool. No
production read path was changed into a schema writer to hide that issue.

This tool reports runtime suite facts only. Its publication fields remain false.
The complete global artifact/configuration/interface/rollback/independent-review
gate must still be integrated with this authenticated read and all missing live
core acceptance must pass. It does not establish that all account zones have no
custom route to a private worker; workers.dev/preview checks have that stated
scope. Document 3 remains deferred.

The combined `release-candidate.mjs ... --private` path first runs the actual
unit-aware local audit. Invalid/missing local evidence performs no provider
request. The independently audited source/tree, original unit sources, build
and artifact/environment set digests are then passed to the provider reader.
Missing private units, missing subject, failed provider read or altered returned
context blocks the combined result. A successful runtime read still leaves
publication and public-release verification false.

Observed locally: 93 private-controller tests, 15 authentication/Service Binding/
platform/impact interface tests, seven expiry/recovery subject tests and the
20-test combined local/provider/impact batch passed. The latter includes controlled
provider responses with real SQLite rows; its positive case is not a live cloud
acceptance result. TypeScript passed before adding the provider combination and
must be rechecked at the final frozen source.

One real provider negative probe completed on 2026-11-06 at 08:47 UTC using the
existing officially refreshed OAuth authorization. It used an explicitly
synthetic, unregistered negative subject and the real phase-21 frozen packages.
The deployed private controller generation did not match that candidate and was
rejected as `authority_runtime_generation_mismatch`. No context registration,
job admission, activation, deployment or public change occurred. It is evidence
of actual provider connectivity and generation rejection, not candidate runtime
success. The original failed dirty-worktree source guard and initial fixture
schema test are retained; neither was relabelled as passed.

Provider protocol references:
- https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/
- Installed official Wrangler 4.92.0 uses the version-specific
  `content/v2?version=...` module download and `cf-entrypoint` header.
