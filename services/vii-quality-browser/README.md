# VII private browser runner

This service is a separately deployed private build unit. Browser Run, its
controller Service Binding and private R2 evidence are connected in production.
It has no public route, workers.dev endpoint or preview URL. The committed
configuration keeps safe example identities; exact live identities come from
provider readback and the project execution checkpoints, not those defaults.
See `project_knowledge/execution/vii-unified-20261105/PHASE_45_FORMAL_RUNTIME.md`.
Connection and successful checks do not establish whole-project readiness.

Install dependencies inside this directory with `pnpm install --ignore-workspace
--ignore-scripts --frozen-lockfile`. Run `pnpm exec tsc --noEmit -p tsconfig.json`
and `node --test test/*.test.mjs` here. The independent lockfile pins the SDK.

The entry point uses Cloudflare's actual `launch(binding)` API. Jobs contain a
fixed scenario and world, a source commit and built artifact ID. The configured
source/build pair must match the job and the document's `X-VII-App-Build` or
legacy `X-VII-Cache-Build` must match the artifact. A conflicting header or
missing identity blocks the result.

The engine creates an anonymous context, installs request interception before
page creation and blocks writes, administration endpoints and unauthorized
external requests. It enforces request, action, total-runtime and evidence-byte
budgets. Late browser launches and failed/cancelled actions are cleaned up.
Owned image reads follow the exact responsive-media CDN contract. The only
permitted POST is the explicitly validated read-only live-search contract;
server-action headers cannot use that exception. A POST to the exact owned
Cloudflare challenge-platform namespace remains aborted and is recorded as
`deniedCounts.platform`, separately from forbidden business writes. It is never
continued or fulfilled, and no challenge, UA or cookie protection is changed.
Actual interstitials still fail document, heading and interaction checks.

Shell and responsive definitions cover all eight public entry worlds, including
the homepage, providers and trails. Map checks require real controls, a ready Leaflet canvas with
markers and a confirmed return to the list. Gallery-next currently supports
the audited vacation fixture only. Other gallery worlds explicitly return
blocked; they are not counted as passing or covered. Provider changes can make
an audited selector require a new definition version and re-verification.

Failure screenshots mask fields and contact links. Evidence is written only to
an injected private bucket and never returned as raw HTML or body text. The
expiry metadata is a retention instruction, not an automatic R2 deletion rule.
Bucket lifecycle and recovery evidence remain separate acceptance items;
expiry metadata alone is not deletion proof. There are no real administrator cookies, booking actions,
payments, contact submissions or outbound notifications in this service.

The connected controller persists and leases a job before invoking this service.
Duplicate prevention, priority queues and the actual administration integration
were exercised by the immutable35-job formal run. That run had70 passing server
checks but browser failures, so it was not accepted. Continuous scheduling stays
disabled until current release acceptance. Preserve original failed receipts.

Traffic diagnostics contain fixed numeric counters and enum labels only. Optional
navigation timings use a literal read-only browser script so bundler helpers
cannot leak into the page context. Missing timings stay unobserved; fixture
metrics are never reported as live measurements. Verify the actual compiled
callback as well as source tests before activation.

Official API reference:
https://developers.cloudflare.com/browser-run/playwright/
