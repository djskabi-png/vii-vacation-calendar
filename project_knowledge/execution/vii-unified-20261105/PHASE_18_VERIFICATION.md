# Phase 18 frozen qualification

Scope: local core candidate only. No public upload, deployment or RUM activation.

Frozen application/service source:
`02cb2fb468e89aefb9fb68e1080f45e2cee077f9`

Frozen tree:
`5db42634a8b5c647e3433eaa1e7cf01f7901b60c`

## Observed execution

- Protected source guard passed. Full TypeScript check passed after correcting
  the CMS content type; the first failed check remains recorded separately.
- Private controller: 83 tests passed. Private browser: 23 passed. Edge: 56 passed.
- All four Worker dry-run compilations completed successfully. Flags/configuration
  were not activated. Exact module packages were captured and independently
  re-audited against their actual compiled directories, without another compile.
- Managed Site build completed in 33.13 seconds.
- Full main suite: 2,443 tests, 2,442 passed, zero failures/cancellations and one
  existing skip. Duration: 112.76 seconds.
- The official Site packaging helper archived the already tested build, without
  rebuilding. Archive size: 109,244,331 bytes. SHA-256:
  `024028b11c350479ac8e46aa4bd37875b2a8d52dec8cab27f07cd91565a80e64`.
- Exact archive audit passed before and after the isolated preview: 1,236
  compiled files compared, 1,257 archive files, required manifests/imports and
  startup budget accepted. Temporary preview instrumentation was removed.

## Actual compiled administration preview

The read-only loopback fixture supplies synthetic quality data and a local
synthetic QA account. It removes notification/service/queue/Cron configuration
and rejects mutations. This is not an authenticated production acceptance run.

- At a 1,280-pixel viewport, the page width was 1,265 pixels including normal
  scrollbar behavior. The metrics table rendered 25 rows for a 720-row dataset.
  Next moved from 1 through 25 to 26 through 50.
- At a 390-pixel viewport, page width was 375 pixels. Previous restored 1 through
  25, and the table still rendered 25 rows. The table has its own horizontal
  scrolling; the page did not overflow horizontally.
- The load/pagination buttons had the intended teal background and a minimum
  height of 44 pixels. Actual computed font was VII Heebo with the approved
  sans-serif fallbacks. Desktop and mobile were visually inspected.
- The temporary tab closed, viewport reset and local preview stopped. The
  graceful process stop failed; exact saved idle descendants were identified
  by PID/name/creation time and stopped. Resource verification found zero
  remaining owned processes and ignored reused PIDs.

## Current public baseline, before any deployment

One anonymous sequential document request per route on 6 November 2026 around
06:51 UTC still observed the old public build
`00bca36c-4f1c-403d-9a13-ceea797015ae` on all four responses.

| Route | Response headers | Complete document | Bytes |
| --- | ---: | ---: | ---: |
| `/` | 2,900 ms | 3,183 ms | 417,996 |
| `/events` | 3,276 ms | 3,633 ms | 840,837 |
| `/spas` | 463 ms | 766 ms | 595,789 |
| `/search` | 435 ms | 1,136 ms | 278,465 |

These include this workstation's connection setup and network conditions. They
are one-sample observations, not browser LCP, service-only timings, cold/warm
percentiles or evidence that the new candidate improves production.

## Evidence locations

Ignored local operation records/logs use the `phase18b-` prefix in `.qa-output`.
The immutable Site archive is retained in the workspace's `.release-artifacts`
directory. Worker module packages and standard build/audit receipts remain in
`.qa-output`. No deployment manifest is approved by these local observations.

The unified project remains in progress. Private durable release authority,
owner-scoped publication access, production configuration/compatibility runs,
business database/media restore and complete live core acceptance remain open.
Document 3 has not been started.
