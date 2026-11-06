# Phase 25: actual experience ingestion source fence

Status: reproduced local runtime defect, implementation and qualification in
progress. No real-user collection, activation, cloud schema change or publication.

Source: V13 performance evidence and Q17/Q23 exact-generation, privacy and
measurement contracts, with the active preflight and QA/data lessons.

An actual two-Worker Service Binding/D1 test exposed a source identity gap.
The Edge validated that its configured application source was syntactically
valid but did not send it to the private collector. With matching build IDs and
different configured application sources, the private collector accepted and
stored the batch under its own different source. The required rejection test
observed 202 instead of 503. This is a local reproduction, not a claim that live
user data was collected or mislabelled in production.

The repair sends the trusted Edge source in a dedicated internal header and
requires an exact match before parsing/migration/storage on the private side.
Client-supplied headers cannot override it. The anonymous browser payload and
its public definition version remain unchanged. The private ingestion interface
definition advances to `experience-source-v2`; Edge/controller activation needs
both implementations and exact configuration readback. Flags remain off in
source configuration. There is no new secret or public endpoint.

The private route is explicitly versioned as `/__vii/experience/v2`, with a
required request protocol header and a checked response protocol. An old Edge
request cannot be ingested by the new collector, and a new Edge targets a route
an old collector does not ingest. This avoids accepting a partial rollout as
compatible. The public browser payload definition remains `experience-v1`.

Acceptance: actual Edge gateway, actual private controller entrypoint and Worker
D1; correct source accepted; differing/missing source rejected without schema or
observation writes; hostile public Origin rejected; consent/build/PII rejection;
duplicate batch idempotency; higher observation revision replaces its previous
histogram contribution; conflicting same revision rejected; summary reflects
one revised observation and does not invent a percentile from one sample.

The first native test request with a non-local Origin was rejected by Miniflare's
host proxy before the test Worker ran. Diagnostic headers confirmed that the
Worker response was never reached. The test-only transport now carries an exact
synthetic request as data and constructs that request inside the fixture without
rewriting its URL or Origin. The production gateway and private controller then
perform their real validation. This isolates a test-host constraint rather than
weakening application security or falsely labelling a proxy rejection as proof.

Tests use only synthetic local observations and dispose every Worker runtime.
Business data, live consent collection, real-user field percentiles, supplier
calls and outbound alerts are not established by these tests. Document 3 stays
deferred.

The first frozen full application run at `5fdd37582d17c20364063eb7279d17f9f3d2e404`
had 2,466 tests: 2,462 passed, three failed, one existing skip. A new fallback
phrase was missing from the shared three-language dictionary; two older map
identity harnesses did not load the extracted real precision functions. The
phrase was added and the harnesses now load the actual policy and assert the
provider-host type as well as stable focus keys. Nine focused localization,
stream-identity and provider-host checks passed afterward. The original failed
run is retained and the candidate still requires a fresh full pass and artifact.
The independently passed private-controller/browser/Edge builds were captured
with their original source identities; they have no publication approval.
