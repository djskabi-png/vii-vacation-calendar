# Phase 22 and 23 frozen qualification

Status: locally qualified controller and verification tools. No public or private
deployment/activation. The complete project is not accepted.

Frozen source: `e720bf1ba78981f6b2c985f5ef53627d944f101f`.
Tree: `fe6be61e4477e94c5ab07a253d74a3b3051ba6ca`.

- Clean source guard passed, preserving 28 protected ancestors and 22 accepted
  capabilities. Full TypeScript passed.
- All 93 private-controller tests passed, including seven real SQLite subject,
  expiry, recovery, payload, receipt and idempotency cases.
- The full application test run had 2,455 tests: 2,454 passed, zero failures or
  cancellations, one existing skip. It took 140.35 seconds.
- The actual workerd authentication test uses the original source's permission
  checks and Ed25519/JWKS path, nonce replay protection and private Worker D1.
  Registration and evidence read succeeded with execution disabled; admission
  remained unavailable and no jobs executed. This is a local runtime fixture.
- Controlled provider tests exercise the actual SQL store, exact multipart
  module byte comparison, deployment drift, bindings, flags and no-retry
  behavior. Their complete positive suite uses controlled CAS receipts, not
  cloud browser executions or supplier acceptance.
- One real read-only Cloudflare probe rejected the deployed older generation.
  Its synthetic unregistered subject is explicitly negative test context. No
  provider writes, job creation or public changes occurred.
- The controller dry-run compiled in 2.30 seconds. Its captured exact package is
  240,817 bytes, SHA-256
  `4e751fc8d0c60b54f3711460e61e530d55e27f297caf8ca4e3ae53bf56e5cc14`.
  Module, runtime/import and tested-payload parity audits passed. Flags default
  off; this package has not been uploaded.
- Existing Edge, image and phase-21 browser artifacts passed actual transitive
  input fingerprint, digest and ancestry reuse validation. They were not rebuilt.
- The phase-21 Site archive correctly failed reuse validation because the shared
  job-store/platform source changed. It remains intact as historical evidence.
  A new application build/package is required after the remaining core source
  work, rather than relabelling the old archive or repeatedly rebuilding it now.
- Independent source reviews found no concrete bypass in the subject/provider
  paths. The expiry review prompted a 70-second admission window before the
  exact evidence expiry; already running requests are not claimed to have an
  atomic distributed kill switch.
- Resource verification passed with no remaining owned processes. No temporary
  browser tab/server was started for this phase.

Matching-generation cloud execution, exact owner-scoped Site publication,
business/media restore, public smoke and field performance remain outstanding.
All publication fields remain false. Document 3 remains deferred.
