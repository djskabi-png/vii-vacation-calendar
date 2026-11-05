# Phase 2 implementation checkpoint

This checkpoint is local implementation, not public completion of V or QQQAAA. Document3 corrective backlog remains deferred.

## Discovery

Ordinary cache miss/expiry now has a distinct error code. The homepage route returns refreshing and warms in the request execution context instead of treating every cold key as a database outage and making the visitor await the supplier. Genuine storage failure retains bounded live recovery. Accepted stale snapshots trigger background refresh. Existing durable cache leases still coalesce per key.

Curation projects three placement fields, preserving published/scheduled/draft/archive semantics. A real SQLite parity fixture transfers less than one percent of the previous full editorial JSON. This is payload evidence, not a production latency measurement. Curation has a separate Server-Timing stage.

The homepage no longer combines transport retries with four component retries. A transport failure terminates that attempt; only explicit pending-refresh responses permit polling within one ten-second selection budget. Accepted, age-valid offers remain usable. Natural public speed still requires the new deployed candidate and timing evidence.

## Maps

World adapters live in `app/lib/map/map-place.ts`. World wrappers remain in `app/components/listing-map.tsx`. The actual Leaflet implementation and helpers are now in `app/components/map/leaflet-places-map.tsx`, behind `MapProviderProps`. The facade retains the preloader contract used by deferred loading.

Import/init failures have a localized usable-result fallback. Retry clears a rejected provider import and reinitializes through effect generation. Failure also triggers cleanup. No provider library or commercial map behavior was replaced. Existing listing coordinate precision behavior remains an open limitation. Forty-six affected map tests pass; rendered verification of this candidate remains required.

## Durable quality jobs

Authenticated enqueue returns202 after persisting a job. The actor comes from the verified server session. The build identity comes from the server compilation. Actor/key idempotency rejects a changed payload or definition; deliberate new keys permit reruns. Full selected definitions are immutable snapshots.

Runner slices claim expiring ownership, execute at most three read-only checks, preserve one run ID, and commit the receipt/cursor atomically. Cancellation prevents late commits. A crash before commit remains interrupted and blocks rather than silently replaying. Timeouts and lost ownership cannot produce completion. Scheduled resumption and explicit authenticated continuation are wired. No production invocation has been observed.

Receipts project idempotently into existing run, result and incident history. Notification outbox events persist before projection is acknowledged. A separate bounded consumer uses the existing provider reservation. Unknown provider outcomes and crashed processing are not retried automatically. Recurring incident cycles use distinct provider idempotency keys. No real messages were sent by this checkpoint.

The administration interface starts jobs, polls compact counters, preserves the last job across reload, and supports cancellation. Network polling has a deadline and stops after two consecutive failures. Legacy run polling now depends on the stable run ID, preventing a response-update loop. The complete quality/job/API/projection/outbox test family passes52tests.

## Remaining required work

Only two quality scope mappings are currently explicit. Browser/visual engines, complete requirement/dependency/release impact coverage, dedicated quality resource isolation, production Queue binding, scheduling evidence, source-generation/cache coverage, backup/restore and exact public acceptance remain incomplete. The current Cron consumer is an interim local integration, not a verified production Queue service. Code/build checks cannot close these requirements.

Next checkpoint: frozen build, broad affected-suite regression, actual local administration/map interaction with isolated fixtures, then the remaining architecture and operations work. No production settings, bindings, domains or data were modified.
