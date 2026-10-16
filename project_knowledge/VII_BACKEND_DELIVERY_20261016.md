# VII backend delivery: verified foundation and next gates

Owner: primary VII engineer. Independent reviewer: release_checker.
Scope: current project instruction to resume backend work, 16 October 2026. This changes the earlier API-first sequencing for foundation work; it does not authorize new recurring cloud spending, broader access or destructive migration.

## Decision

Build the approved platform in measurable slices. Do not replace the runtime or add Redis and microservices merely to call the result advanced. Keep Cloudflare at the edge and preserve the approved Aurora destination. An AWS migration alone cannot establish fast pages, correct supplier availability or recoverability.

The first slice hardens optional cache work. Previous code buffered an entire clone before checking its2MB limit. The candidate bounds consumption while reading, gives a cache branch3seconds, admits at most2concurrent captures and separately caps outstanding optional writes at2. A cache failure must not truncate the visitor stream. Private requests and responses stay uncached. JSON no-store is honored; the exact generic Vinext public-stream default `no-store, must-revalidate` retains the existing explicit anonymous-route caching policy. A real warm-Worker check caught and blocked a blanket-header change that would have disabled public caching. HTML and Flight acquire no new request wait.

A proposed isolate-local cold-fill coordinator was rejected by the real built-Worker experiment: seven expected followers did not reuse the first cold vacation response. Extending the wait would conflict with the loading goal. It was removed, not presented as a successful speed improvement. This slice does not reduce all origin renders or solve distributed stampedes.

## Current state and evidence limits

| Area | Current evidence | Remaining gate |
| --- | --- | --- |
| Runtime and edge | Existing hosted Cloudflare Worker, immutable client assets, build-scoped HTML/Flight/catalog cache;442 baseline verified publicly | Geographic p95,p99 and real-user vitals are not established by workstation samples |
| Canonical catalog | Code uses accepted, versioned D1 generations; published catalog and per-world guarded sync existed before this change | D1 remains the approved interim exception, not Aurora production |
| Supplier failure | Source has isolated worlds, removal/media guards, run locks and bounded retry records | Prove scheduled runs and failed-run recovery per world from authoritative history; no universal provider SLA claim |
| Administration | Existing allowlist/session gates and catalog operations in source | Complete world/action RBAC, immutable audit and source-to-public edits require dedicated live acceptance |
| Database target | Aurora PostgreSQL Serverless v2 in Tel Aviv is the approved target in the master plan | Production cluster, private connection proof, owner identity, budget and migration rehearsal are unverified in this execution context |
| Queues and writes | Retry state exists for catalog jobs; booking API handles uncertain supplier writes separately | Durable outbox, deduplication, dead-letter replay and crash recovery for every external side effect |
| Operations | Cache layer/build/expiry/read timings already exist; this slice adds capture queued/busy response diagnostics | Durable journey metrics, alerts delivered to a named operator and independently observed recovery |
| Backups | Saved application versions provide code rollback | They are not a database/media backup. D1/R2 export, independent copy and timed restore drill are not verified here |
| Staging and release | Immutable builds, tests and saved rollback identity are used | Isolated staging with masked data, migration rollback and a controlled production promotion path |
| Media and localization | Existing supplier photos and product translations remain unchanged | Dedicated media pipeline, versioned derivative generation and content translation jobs are separate work |
| Search and analytics | Current product has search and management modules in source | Vendor decisions, index rebuild/rollback and privacy-safe high-volume telemetry are open |

Public read-only catalog checks at approximately17:25Israel returned runtime data for all4worlds:576vacations,132events,24hourly places and160spas. The authenticated catalog screen showed a scheduled vacation success at17:00today and an event success at12:32today. Rooms last accepted15October04:55manually; Spa last accepted14October16:28 and last pull was rejected with `catalog_editorial_requires_review`. The prior Spa catalog was preserved. These are operational evidence gaps requiring scheduler/history and editorial-policy diagnosis, not permission to bypass the guard or repeatedly pull. No supplier pull or approval was performed by this audit.

No AWS CLI executable was available in this shell. This is not proof that Adir has no AWS account or browser access. No account login, cloud provisioning, new credentials or costs were attempted.

## Delivery sequence

1. **Bound the current runtime.** Ship cache-body limits and backpressure only after failure and byte-parity checks, then inspect the exact public release on desktop and mobile. Keep442 as rollback. Do not claim a global latency gain from a memory-safety test.
2. **Make operations visible.** Record journey latency,error rate,cache layer/miss/timeout,freshness and job age with deployment correlation. Add authenticated health detail, minimal public liveness, and actionable alerts. Exclude private payloads,identities,search text and secrets from technical logs. Audit the Spa editorial stop,missing recent hourly runs,and the actual10-minute retry executor first. A retry row or native cron declaration is not proof of execution in this managed runtime. Acceptance: a controlled failed dependency reaches the operator, recovers and clears without duplicate alerts or loss of the last good catalog.
3. **Prove recovery before migration.** Inventory D1 tables,R2 objects,versions and retention; export to an isolated authorized destination; restore into staging and reconcile counts,checksums,relations and sample public journeys. Define RPO/RTO from business impact before promising numbers. Code rollback alone cannot pass this gate.
4. **Move slow work off browsing.** Use durable jobs for supplier reconciliation,media,indexing and translation. Every job needs an idempotency key,deadline,retry classification,backoff/jitter,dead-letter state and manual replay. Availability and final booking checks retain authoritative supplier semantics. Test duplicate delivery,provider outage,process crash and uncertain write outcomes.
5. **Establish Aurora staging and the private path.** Verify the owner account and approved recurring budget first. Provision isolated infrastructure as code, private database access and two connection policies: cacheable public reads versus uncached permissions/transactions. Prove redundant connectors and failover. No production data copy before approved classification and security controls.
6. **Migrate without a blind cutover.** Map D1 schema and field ownership, backfill, validate checksums and counts, shadow reads, rehearse rollback, then switch one domain at a time. Preserve overlays,URLs,permissions,accepted supplier generations and write idempotency. Independently exercise public and admin journeys before advancing.

Each stage has an outcome gate, not a promised calendar duration. Traffic,peak concurrency,acceptable error budget,on-call ownership and recurring infrastructure budget are not verified sufficiently for honest cost or staffing estimates.

## Target flow, not a live-deployment diagram

```text
Browser/app -> Cloudflare edge -> typed VII API -> canonical relational store
                         |              |
                public safe cache      durable outbox/jobs -> supplier adapters
                         |              |                  -> index/media/localization
                  local read models     telemetry and operational audit

Current canonical catalog store: D1 interim.
Approved destination: private Aurora with a separately proven connection path.
Final availability/booking/permissions: never authorized by stale public cache.
```

## Failure policy

Optional cache failure falls back to normal origin behavior with bounded background work. Supplier failure preserves the last accepted descriptive catalog but cannot become a confirmed available offer. A database outage must not be disguised as an empty catalog. Queue delivery must be deduplicated before side effects. Migration or restore failure stops promotion and retains the prior verified generation and application version.

Official references checked16October2026:

- [Worker memory and execution limits](https://developers.cloudflare.com/workers/platform/limits/): memory is per isolate; streaming is preferable to unbounded response buffering.
- [Cache API scope](https://developers.cloudflare.com/workers/runtime-apis/cache/): cache contents are local to their originating data center; an isolate Map is not a global coordinator.
- [Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/): duplicate delivery must be handled explicitly.
- [Aurora Serverless](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html): vendor capability reference, not evidence of a VII cluster.

Detailed authority remains `calendar-airbnb/project_knowledge/VII_PLATFORM_MASTER_PLAN.md`. This record supplements it with the new scoped delivery sequence and preserves historical decisions.
