# Phase3 observed evidence and corrective integration

The frozen candidatebc2db14495243772b09f920efc8d9d8e48571764,
treea52bc6382a502ce30e9e3e8f9e44c82cba95f3a3, passed full TypeScript,
the private browser service's Wrangler dry-run packaging and the application
build. The application build completed in34seconds with292server modules and
all literal imports resolved. The first packaging command did not recognize
the .toml.example extension; a normal ignored .toml configuration with the
same settings and an absolute entry point bundled successfully. Nothing was
deployed by this dry run.

The full suite ran2349tests:2347passed, one failed and one existing skip. The
failure was an obsolete assertion requiring React to replace the map canvas
class during readiness. The test now requires shell readiness and a constant
canvas class. The affected rendered-HTML file plus the executable canvas test
then passed92tests. Do not relabel that original full-suite receipt as passed.

## Actual compiled map

In the actual loopback browser the map retained these provider-owned classes
after readiness:leaflet-container,leaflet-touch,leaflet-fade-anim,leaflet-grab,
leaflet-touch-drag and leaflet-touch-zoom. It rendered6markers atzoom7.
After zoom and a390px mobile transition, the same classes remained andzoom8
was observed. Document width and scroll width were both390px. Returning to
the list removed every listing-map root; the resulting375px document had
scroll width375px. These are local compiled observations, not public results.

## Actual compiled scope failure and root fix

The quality interface loaded61checks. Choosing maps showed33checks and
disabled levels that could omit dependency coverage. Starting that scope
returned503. A read-only query of the isolated local D1 confirmed only the
two earlier fixture jobs existed; this request had not created a new job.

Cause:the HTTP scope parser populated absent optional properties with
undefined. The durable payload hash intentionally rejects undefined values.
The parser now omits absent fields. A new integration test executes the real
HTTP parser, real platform and real SQLite persistence. It verifies202, exact
selected IDs, one durable job, idempotent retry and actor-scoped reconciliation.
Unknown ownership and incomplete levels still create no partially admitted job.

The pending intent is now retained before sending and can be reconciled by the
authenticated actor/key after a reload. A blocked storage write sends no new
request. The updated quality family passed59tests and full TypeScript passed.
The corrected compiled UI still requires its own recheck after the new build.

## Administration workload observation

The compiled quality-page visit automatically requested12other administration
RSC routes, including business performance, growth, content and catalog screens.
The shared administration menu now disables automatic link prefetch. Command
search and its queue link now use client navigation instead of document reloads.
The next compiled check must verify the absence of these unsolicited requests
and exercise actual navigation. No public speed improvement is claimed here.

## Private engine follow-up

Independent review found that eager Promise arguments could start an action
after its deadline. All17step calls are now lazy and admission occurs before
starting each action. A test advances time after launch and confirms that no
context is created. The request-body reader has a total deadline, UTF8 byte
budget, cancellation and stable errors. An uncooperative cancellation callback
cannot hold the request open. The independent service currently has15tests.

## Resource and publication boundary

The temporary fixture was signed out and its tab closed. Its8owned processes
were stopped; resource verification returned no remaining owned processes.
The exact compiled fixture entry was removed. The user's original Site tab
was preserved. No production binding, database, setting, domain or release
was changed. Cloud provisioning, migration/restore, queue dispatch and final
public performance/readiness evidence remain required.
