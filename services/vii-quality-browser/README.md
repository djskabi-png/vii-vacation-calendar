# VII private browser runner

This service is a separate build unit. It is not deployed or connected to the
public application. The example configuration has no public route, workers.dev
endpoint or preview URL. Browser Run, the private Service Binding and private R2
evidence bucket still require verified provisioning.

Install dependencies inside this directory with `pnpm install --ignore-workspace
--ignore-scripts --frozen-lockfile`. Run `pnpm exec tsc --noEmit -p tsconfig.json`
and `node --test test/*.test.mjs` here. The independent lockfile pins the SDK.

The entry point uses Cloudflare's actual `launch(binding)` API. Jobs contain a
fixed scenario and world, a source commit and built artifact ID. The configured
source/build pair must match the job and the document's `X-VII-Cache-Build`
header must match the artifact. Missing identity blocks the result.

The engine creates an anonymous context, installs request interception before
page creation and blocks writes, administration endpoints and unauthorized
external requests. It enforces request, action, total-runtime and evidence-byte
budgets. Late browser launches and failed/cancelled actions are cleaned up.

Shell and responsive checks cover vacations, events, hourly rooms, spa and
attractions. Map checks require real controls, a ready Leaflet canvas with
markers and a confirmed return to the list. Gallery-next currently supports
the audited vacation fixture only. Other gallery worlds explicitly return
blocked; they are not counted as passing or covered. Provider changes can make
an audited selector require a new definition version and re-verification.

Failure screenshots mask fields and contact links. Evidence is written only to
an injected private bucket and never returned as raw HTML or body text. The
expiry metadata is a retention instruction, not an automatic R2 deletion rule.
Bucket lifecycle enforcement and authorized evidence retrieval remain required
before activation. There are no real administrator cookies, booking actions,
payments, contact submissions or outbound notifications in this service.

The controller must persist and lease a job before invoking this service.
Duplicate prevention, priority queues, scheduled dispatch, D1 migration and the
administration integration are separate required work. This worker alone does
not establish a durable distributed QQQAAA deployment.

Official API reference:
https://developers.cloudflare.com/browser-run/playwright/
