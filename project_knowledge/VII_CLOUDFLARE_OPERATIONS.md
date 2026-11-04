# VII Cloudflare operating authority

Approved by Adir on 4 November 2026. This supersedes historical AWS-primary migration instructions for production. It does not assert that every integration or screen is healthy.

| Responsibility | Owner and existing implementation | Verification boundary |
| --- | --- | --- |
| Canonical structured state | Cloudflare D1, binding DB | All application selectors and Worker maintenance use cloudflareDatabaseForEnv. Missing binding fails closed. |
| Public media and review files | Cloudflare R2, binding UPLOADS | Existing store retained. No bucket migration, object replacement or rights changes. |
| Responsive image transforms | Cloudflare Images, binding IMAGES | Streaming implementation retained; actual transform behavior requires live media checks. |
| Execution | Existing Cloudflare Worker through the VII Sites project | Deployment must record exact source, version, deployment and environment revision. |
| Catalog, discovery and quality schedules | Worker scheduled handler | Source cron is every ten minutes; discovery refresh is every half hour. Actual deployed trigger and successful runs require runtime evidence. |
| Administration and grants | Existing authenticated VII administration backed by DB | Identity-bound authorization remains fail closed. No new roles or grants created. |
| Public response cache | Existing Worker response cache | Build-specific cache identity retained so deployments do not reuse old chunk references. |
| Supplier truth | Existing supplier APIs | Cloudflare hosts state and processing; it must not invent supplier availability, prices or contacts. |
| Logs, recovery and backups | Existing service facilities | Do not claim backup coverage or restore readiness until inventory and an isolated restore drill are verified. |

## Prevention and release gates

The production application must not call the historical AWS adapter. A recursive source regression check covers app and worker, including map snapshots and review storage. Old environment values cannot reactivate AWS. Retained adapter code is migration tooling, not an active second database.

The incident setting was changed from primary to cloudflare and stored as environment revision32. A saved setting is not runtime proof. A new deployment using revision32 and authenticated administration checks are required.

Release checks include clean cumulative source, protected ancestors, full build, source tests, independent review and exact public destination. After deployment, repeat all eleven originally failing admin API reads; verify a safe unchanged or draft save and fresh readback; inspect authorization, loading, error and retry behavior. Do not send real messages, make bookings, charge payments or alter roles as a test.

## Remaining operational verification

1. Record public release IDs and live endpoint outcomes in the incident record.
2. Verify safe administration writes and audit history without publishing test content.
3. Confirm actual scheduled runs and their terminal outcomes, then check alert delivery in an authorized test destination.
4. Inventory existing backups and restore procedure, and perform an isolated restore drill before claiming recovery readiness.
5. Resolve known upstream event-slider parity gaps separately. Database recovery is not proof of complete launch readiness.

Historical AWS endpoint and token are retained masked during recovery for traceability. They are not read by production selection. Removing obsolete credentials is a separate deliberate cleanup after successful live recovery and inventory, not a prerequisite that risks the working release.
