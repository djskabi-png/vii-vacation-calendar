# Phase six verification

Frozen implementation source: `a5233c18c34eaf3b238180676cefb077849df466`.
Tree: `cf3c9eba87a8f99f8fdde7a38cdcc7fb325ee6ed`.
Managed Site source-input namespace: `37aea992-09c1-a1bf-7173-9af66834d35e`.
This namespace is not an exact compiled-artifact digest.

## Integrated checks

Full TypeScript, 46 private-controller tests, 18 browser-service tests and both
actual Wrangler dry-run packages passed. The engine definition was checked by
both custom builds. The managed application built in 35.69 seconds. The full
suite finished in 64.03 seconds: 2,382 tests, 2,381 passed, zero failed, one
existing skip, zero cancelled. Source integrity passed with a clean tree, 28
protected ancestors and 22 required capabilities. Logs and operation receipts
are under `.qa-output/phase6-frozen-*`.

The bundled workerd regression uses real D1 and a real Service Binding to a
synthetic browser worker. It verifies the actual controller-to-executor path,
duplicate consumption and mismatched-result blocking. It does not prove a real
Cloud Browser launch. Engine test doubles and UI fixtures are not counted as
live cloud checks.

## Compiled interface

An isolated loopback wrapper loaded the exact compiled candidate. A controlled
UI-only response fixture exposed all 26 profiles and simulated an accepted
browser admission with a lost HTTP acknowledgement. The first response was
503. Reload recovered the same completed fixture job by its retained intent;
the fixture recorded exactly one admission POST. Original events, desktop and
map-open-close choices were restored. No queue or browser ran in this wrapper.

Actual desktop client/scroll width was 1265/1265; mobile was 375/375, with a
345-pixel browser control section and the approved VIIHeebo font. Selecting
vacation/mobile/gallery and then spa fell back to spa/mobile/world-shell; the
unsupported gallery choice was absent. The result text wrapped in the mobile
view. This is scoped control/recovery evidence, not full administration or
whole-site visual approval.

The fixture was signed out, its AI-created tab closed and the viewport reset.
Owned preview root 34192 and verified descendants were stopped. Final resource
verification returned `remaining: []`. The exact compiled fixture entry was
removed. An unrelated reused PID was preserved.

## Remaining boundaries

Actual Cloud Browser/Queue execution, browser scheduling, private evidence
retrieval, history migration/drain/restore, notifications, public navigation
timing and the remaining approved chapters are not complete. No public release
is approved by this verification. Document three remains deferred.
