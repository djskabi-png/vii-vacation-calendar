# Phase 24: map precision and provider isolation

Status: focused local implementation, not compiled or deployed yet.

Source: V06 normalized map contract and replaceable provider boundary, with the
active task preflight and QA/data lesson bundle. Document 3 remains deferred.

The initial precision adapter increment exposed a review regression: unmarked
vacation/event snapshot coordinates were downgraded to area while their live
map still used the established legacy exact default. That version was not
accepted. Both surfaces must use the same world-specific policy, retain explicit
precision through light result projections, reject invalid/zero coordinate pairs
and preserve every valid place in the list regardless of map eligibility.
Legacy defaults are not new proof of GPS provenance. No coordinates, inventory,
prices, result ordering or supplier media are to be invented or changed.

The existing renderer had a separate isolation defect: its error boundary was
inside the Leaflet component. A boundary cannot catch the render failure of the
component which creates it. A provider-neutral host now wraps the implementation
itself, receives only normalized MapProviderProps, and supports a replacement
definition without changing world adapters or supplier data. Current Leaflet
preload compatibility is preserved. Retry resets and remounts only the provider;
reset errors preserve the fallback list. Both outer render failure and existing
inner asynchronous failure offer a return-to-list action where onClose exists.
The shared fallback uses scoped styling and renders its preserved inventory
25 links at a time with explicit incremental access, avoiding a large initial
error-state DOM. All original place destinations remain reachable.

Acceptance: same IDs, exact points, area points and prices across normalization,
public projections and snapshots; missing/zero/out-of-range points omitted only
from maps; legacy defaults preserved; replacement contract callbacks and values
unchanged; implementation/reset failures preserve all destination links and list
return; retry remounts only the provider; localized desktop/mobile actual browser
failure and retry checks; normal map interaction across affected worlds.
Tests of controlled replacement components do not prove live tile performance,
new supplier GPS accuracy or public rendering. Full core acceptance remains open.
