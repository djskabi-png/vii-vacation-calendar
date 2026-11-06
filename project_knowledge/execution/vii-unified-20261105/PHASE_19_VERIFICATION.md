# Phase 19 frozen qualification

Scope: local event initial-props optimization. No public deployment or release
approval. Document 3 remains deferred and the unified core remains in progress.

Source: `9f7d03d25b995bede7b3c631c33fefeaf48f3cbd`.

Tree: `9185999fcd16fbfe061774e385adf12b58426cf4`.

## Frozen execution and selective compilation

- Protected source check and full TypeScript check passed.
- The managed Site alone was built: 30.39 seconds. No Worker recompilation.
- All four retained phase-18 Worker artifacts passed actual Git ancestry,
  transitive input fingerprint and byte-digest validation against this source.
  Their application-target configuration is a separate future operation.
- Full suite: 2,446 tests, 2,445 passed, zero failed/cancelled and one existing
  skip. Duration: 109.82 seconds.
- The official helper packaged the exact tested output without rebuilding.
  Size: 109,245,999 bytes. SHA-256:
  `b593a9485b5d6699108e4190ba57d4054b5e39655dcbd645eeb4133d7dc9672a`.
- Exact archive audit passed before and after the compiled preview: 1,236
  compiled files compared, 1,257 archive files; manifest/import/startup checks
  passed. The reduction is in rendered rail props, not the archive size.

## Actual compiled UI and HTTP observations

The isolated loopback wrapper rejects mutations and disables notifications,
queues, services and Cron. Its live-search POST deliberately returns 405, so
availability failure/browse fallback is expected. It cannot prove live supplier
availability or public slider readiness.

- The event world rendered with its 132-place count, search, popular links,
  date tabs and existing content. Desktop width 1,280 pixels, document width
  1,265 pixels. The modern Hebrew font stack and layout were visually inspected.
- At 390 pixels, document width was 375 pixels. Selecting Friday changed the
  selected tab. The bounded failure fallback rendered 20 browse cards with 20
  telephone links. These were not labelled as verified available offers.
- Clicking the visible Friday link navigated to `/events/friday`, with the
  correct unique heading, preset navigation, party input and event-slot control.
  No booking, business message or live write was attempted.
- One local document GET per route returned 200: `/events` was 616,471 bytes and
  `/events/friday` 183,790 bytes. The events document's actual JSON-LD ItemList
  still contained 132 entries. These are local fixture observations, not a
  controlled before/after public latency comparison or field percentiles.
- The temporary tab closed and viewport reset. The exact saved idle preview
  process tree was recorded and stopped; the temporary fixture was removed
  before the second archive parity audit.

Operation records, test logs, exact receipts and local observations use the
`phase19-` prefix in `.qa-output`. The retained archive is under
`.release-artifacts`. The existing owner-workspace publication access obstacle,
private durable authority integration and complete live core acceptance remain
open. No pending or locally passed state is presented as a public release.
