# Catalog MCP writer review, 2026-11-05

## Safe operation

The only supported write is the existing authenticated Sites MCP POST. It accepts exactly one argument and does not accept a date, source, run ID, force flag, token, or approval override:

```json
{"jsonrpc":"2.0","id":"maintenance-<world>-20261105","method":"tools/call","params":{"name":"vii_catalog_pull","arguments":{"world":"vacations"}}}
```

Replace `world` once per call with `vacations`, `events`, `rooms`, or `spa`. The request must come from the existing Sites authenticated identity, with both `oai-authenticated-user-id` and `oai-authenticated-user-email`; the email must be in the server-side administrator allowlist. For the modern MCP protocol, the request must also include protocol `2026-07-28`, matching `Mcp-Method: tools/call`, `Mcp-Name: vii_catalog_pull`, and the required `_meta` protocol/client/capabilities object. Do not send credentials, provider keys, or a caller-supplied run ID.

The call is time-gated to the latest approved Israel-time slot for that world. Outside a due slot it returns `no_due_slot`; it must not be repeated to force a pull. A successful or failed/rejected slot is idempotent and repeated calls do not refetch it. The pull also drains at most two already-due retry jobs, so it is not a general “refresh everything” operation.

## Publication safety

`runSupplierCatalogSync` stages and activates only after integrity, removal, media, and world-specific validation. A rejected or failed candidate is recorded in `supplier_catalog_runs` and does not replace `supplier_catalog_state.active_run_id`; the last accepted generation remains public. This is the required behavior for a one-call maintenance operation.

## Spa rejection cause

The current code-level editorial rejection is `catalog_editorial_requires_review` from `validateSpaEditorialCandidate`. It is raised when a candidate cannot be projected through the reviewed VII Spa copy, currently most concretely a new/unmatched Spa with a missing title (`missing_title`). The documented editorial contract also covers a new Spa, renamed place, changed address, or changed narrative without the reviewed copy and source-hash/facts update. The rejection diagnostics are deliberately bounded and sanitized to supplier ID, approved field names, and reason; raw supplier prose and keys are never persisted.

The owner result says the last scheduled Spa run (2026-10-17) was rejected, but the available owner summary does not include its sanitized `diagnostics_json`. Therefore the exact historical rejected supplier IDs/reasons cannot be asserted from the current evidence. Read the corresponding `supplier_catalog_runs.diagnostics_json` through the existing owner status/audit path before approving a new Spa generation. Do not infer that it was a title, hash, removal, or media failure from the status alone.

## Required approval data for Spa

Before approving a rejected Spa candidate, obtain the run's sanitized diagnostics plus a complete candidate-to-current comparison. For every rejected supplier ID, the reviewer needs the changed approved fields and a reviewed replacement card/article, factual metadata, and refreshed source hash/coverage ledger. Removal and media diagnostics must also be clear. Never approve by copying supplier prose automatically and never bypass the guard.

## Current operational decision

All four linked automations are paused. Do not resume them or invoke these write calls until the owner inspects the prompts and confirms the intended slot. The safe sequence is: read-only status, inspect the exact rejected Spa diagnostics, review/update the approved Spa editorial package if needed, then one due-slot call per world with unique operation identity, and verify the persisted run and unchanged active generation on rejection.

Focused verification on the actual MCP route, slot gate, idempotency, rejection retention, and Spa diagnostics passed: 22 tests, 22 passed, 0 failed (`tests/catalog-pull-mcp.test.mjs`, `tests/spa-editorial-diagnostics.test.mjs`).

## 2026-11-05 owner-run diagnosis

The authenticated maintenance read shows these terminal outcomes: vacations `577 -> 547` rejected with `catalog_content_requires_review` (36 removed, 6 added, 539 changed); events `132 -> 127` rejected with the same code (7 removed, 2 added, 125 changed); rooms accepted at 53; Spa accepted at 158. No rerun was made.

This is consistent with the deliberate partial-detail guard in `catalogContentIntegrityIssues`: for vacations/events it rejects a candidate when an existing place's `detail.images`, `galleryGroups`, `features`, `featureGroups`, or `rooms` collection disappears/empties, or accepted image/feature items disappear. The Sergey client refreshes only a bounded detail window, while the provider list and detail responses are separate contracts. Therefore the counts alone do not prove real removals. The safe interpretation is that at least one refreshed provider detail was incomplete or schema-changed, not that 36/7 places should be deleted.

The guard now persists a bounded `contentIntegrity` diagnostic with only supplier ID, canonical schema path, and `collection_missing`/`item_removed` reason. Gallery titles, URLs, prose, contacts, and arbitrary provider paths are excluded. This makes the next rejected run actionable without weakening the guard.

Safe repair requires the rejected run's sanitized diagnostics (`before`, `candidate`, `removedIds`, `units`, and the first 100 `detail.*` issues) plus the raw provider response-shape metadata for the affected IDs: whether each collection was present and complete, and whether removals are explicit tombstones. Without that evidence, do not relax the guard, merge missing arrays as empty, or activate the candidate. If the provider confirms partial omission, the client should retain the previous accepted collection for omitted fields and only apply explicit removals; if it confirms a complete authoritative response, review the affected IDs and approve a deliberate transition through the existing guard, never a forced pull.
