# Phase 20 independent service qualification

Status: local qualification only. No cloud configuration, activation or deployment.

Controller artifact source: `aee16f79bc8a496421dd6206b2eaf7112de438da`.

Controller artifact tree: `b90703d377d322f2f3d7b992fa3fc91f5ca477fe`.

- The protected source guard passed at the controller compilation source.
- Full TypeScript and 85 private-controller tests passed at source
  `d331bddd091d36c6ee4f746bf59fafbcff0efee4`. Actual controller input fingerprints
  were then compared and remained identical through the final test-only commit.
- The 34-test interface/release batch initially passed 33 tests. Its workerd
  browser fixture omitted the newly required separate source, so admission
  correctly returned 503. That fixture was updated to use different controller
  and browser sources. Both actual Service Binding/D1/R2 workerd tests passed
  afterward. The original failed operation is retained and not re-labelled.
- Local release evidence admission tests passed with independently retained
  browser artifacts. Incorrect controller artifact, application target or browser
  runner source cannot be replaced by the newer repository HEAD.
- Only the controller was compiled, in 2.59 seconds. Its exact module package
  was captured and audited: 219,825 bytes, SHA-256
  `65dc7bd0fd99643861c2b72eff1a0aa6e381af76e7a792eaec1fb78c0e0d1d33`.
- The existing managed Site, browser, Edge and image artifacts all passed actual
  input fingerprint, original digest and ancestry validation against this source.
  No application or unchanged-service rebuild occurred.
- Independent code review accepted the source separation and preservation of
  historical evidence. It does not approve cloud activation or public release.

`PREPARED_ARTIFACTS_PHASE20.json` records the distinct source/tree/digest of each
artifact and the proposed runtime source bindings that must be read back after
an authorized configuration operation. Those bindings have not been applied.
The application artifact source is the phase-19 commit, the browser/Edge/image
sources are phase 18, and the controller source is phase 20. Assigning every
source field to the repository HEAD would be incorrect.

The global admission tool still returns verification-only status and requires
private durable authority integration. Owner-scoped publication, business data
restore, complete live core acceptance and field performance evidence remain
open. Document 3 remains deferred.
