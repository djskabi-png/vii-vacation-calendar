# Gallery apply memory failure and bounded recovery

The original 545-vacation media apply for audit `7edc4e9c-91a7-4f1b-b103-58796a14e781` terminated with `exceededMemory` at 2026-11-09T20:44:35.609Z. The owning Sites log reported 44740 ms wall time and 2134 ms CPU. It did not expose peak memory or subrequest counts. A read-only database check retained the prior active generation `mcp_20261109_vacations_2200`, count545. The gallery run remained running with an expiring lease; staged count was not available from that inspection. Null aggregate counters do not prove zero staged rows.

The single-request implementation materialized the complete baseline and candidate. Four-source prefetch limited concurrency but did not bound generation memory. Production routing now uses a durable bounded engine, not that aggregate function.

Each request prepares and stages one supplier while the native catalog lock pins the baseline generation. The same source SHA, API owner identity, age, projection, nonmedia preservation and archival checks are reused from the original entry validator. Prepared records are private, immutable and tied to the job, world, baseline generation and fingerprint. Staging is insert-if-absent with exact readback. CAS progress leases prevent concurrent cursor advances. A disconnected response resumes the same prepared row and cannot increment counters or insert a second row.

The active generation changes only after supplier IDs and count exactly match the pinned baseline. The pointer switch and run acceptance use one guarded D1 batch. Post-verification reads at most four suppliers per step. No phase loads either complete generation's JSON documents.

Legacy recovery is explicit and performs its own authoritative checks: no accepted pointer, a permitted run state, an expired/free lock and zero staged rows. A live or partially staged legacy invocation is not repeated, unlocked or overwritten. Its result requires further reconciliation. An initialization failure cannot release that live invocation's lock.

Actual SQLite/R2 tests cover API SHA corruption, foreign raw references, extra or empty owners, API package order with retained facts, generation visibility, concurrent lease acquisition, lost progress responses and legacy recovery boundaries. These are source-level checks. Publication and actual four-world application still require separately recorded live receipts and public gallery verification. API-origin empty or quarantined owners remain explicit exceptions rather than fabricated photos or a blanket all-correct claim.
