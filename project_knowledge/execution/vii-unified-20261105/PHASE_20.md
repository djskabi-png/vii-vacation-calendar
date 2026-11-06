# Phase 20: independent controller and browser runner identities

Status: local implementation and focused tests. No cloud configuration change,
deployment, browser activation or public release approval.

The controller previously used its own `EXPECTED_SOURCE_VERSION` as the browser
runner source. A controller-only release could therefore block an unchanged
browser artifact, or incorrectly relabel that runner's source. This undermined
independent deployment even though both artifacts were individually reusable.

The controller now requires an explicit `EXPECTED_BROWSER_SOURCE_VERSION` for
browser admission/execution, separate from its own source and the application
target build. It passes a minimal internal browser environment with the runner's
actual source. There is no fallback to the controller source. Default flags
remain off and the new default source is explicitly unactivated.

Historical screenshot access intentionally keeps the immutable persisted job's
original source/definition/canonical key. It remains available with execution off
and after a controller upgrade; current runner configuration cannot rewrite its
identity or erase access to valid historical evidence.

Sixteen focused tests passed using the actual SQLite-backed job store, including
a controller source change while retaining runner source, a runner change fencing
queued work without execution, invalid/missing runner source before admission,
duplicate execution, cancellation, lease fences and historical evidence access.
Frozen qualification and actual artifact reuse checks remain separate steps.

This source change affects only the private controller's compiled inputs.
The managed Site, Edge, image service and browser artifacts should remain reused
after actual input/ancestry/digest verification. Activation must configure the
browser source from its retained artifact receipt, not this controller's newer
Git commit. The core project remains in progress; document 3 is deferred.

Local release evidence admission also checks configuration sources against
each retained artifact's original source, not the newest repository HEAD.
Application target source and controller-to-browser runner source are distinct
fields and enter the environment fingerprint. This remains a verification-only
tool, not a substitute for private durable runner provenance or deployment
readback. Additional source-binding tests require their own recorded execution.
