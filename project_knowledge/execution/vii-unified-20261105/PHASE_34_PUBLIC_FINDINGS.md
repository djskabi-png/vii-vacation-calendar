# Public v810: deployed, acceptance remains open

The owning publication conversation saved and deployed v810 once. Application
source is `074586b5190a0c64caf0dffcd6cd1e464c185064`, build namespace
`2c4fe3b1-6749-5d0b-62d2-390c5a61c533`. The public home and events routes returned
that exact generation. Deployment identity is
`appgdep_6aedc23a1cd881918ccb717526b906fc`. This is publication evidence,
not whole-project acceptance.

Exact frozen-source qualification completed: 2475 passed, zero failed, one
existing skip. TypeScript and archive audit passed. Actual public HTTP and
browser checks subsequently found failures that the local suite did not cover.

The original immutable private release subject is
`ac9f450269815a18cd849808ad06eab984abe2a36bcfebb6abdbfec863e62e1a`.
Its 35 original jobs settled with 28 completed and seven blocked. Completed jobs
include failed checks. No retry or replacement run was admitted. The temporary
scheduled admission Worker was disarmed and its empty schedule verified.

## Findings and current handling

* The public verification-key URL returned404 HTML. Actual route discovery
  using Vinext's Node glob pattern discovered74 route files and omitted the
  dot-directory route. The prior crypto integration fixture dispatched the
  handler directly, hiding the actual routing defect. A new regression against
  the actual Worker reproduced404 before the fix, then passed after explicit
  dispatch. GET/HEAD, rejected POST, public-key-only output, and no generic app
  startup are covered. A new release-blocking public HTTP check covers the URL.
* Event readiness rejected valid overnight offers whose end date is the next
  calendar day. The supplier response and producer contract establish that
  representation. A narrow validator fix and boundary tests are in progress.
* Four vacation snapshot checks observed `refreshing` instead of a verified
  snapshot. Later read-only observations found verified snapshots. The original
  failures remain failed evidence; later availability does not rewrite them.
* Browser jobs reported blocked writes and map failures without sufficient
  durable diagnostics. Only screenshots were retained. Bounded, privacy-safe
  step/request diagnostics are being added through the complete transport and
  receipt chain. Write blocking stays enabled.
* Root manually opened and closed the public vacation desktop map through the
  browser. The map reported ready with six rendered clusters and544 places;
  returning to the list detached the map. This single observed flow does not
  approve every world, mobile maps, or the failed remote profiles.
* Cache hits were roughly97–205ms in a small12-route repeat sample. First
  observations were1.1–5.9s. Two unique allowed cache keys showed origin header
  generation667/1591ms and native HTML streaming. The specific upstream cost
  remains unproven. App-load/render timing is being added. Request-scope world
  availability deduplication requires setter invalidation regression before
  acceptance; the existing world-shutdown behavior must remain authoritative.

The new source changes described above are local and have not been published.
Document3 remains deferred. Full V+QQQAAA acceptance, all-world browser flows,
admin settled-state coverage, recovery evidence and field performance remain
open. No whole-project completion or launch-readiness claim is authorized by
this evidence.
