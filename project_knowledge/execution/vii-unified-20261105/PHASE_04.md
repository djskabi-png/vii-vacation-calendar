# Phase four: isolated control, Worker transport and world ownership

Status: integration in progress. Document three remains deferred. Public
deployment and quality-authority cutover have not occurred in this phase.

## Actual infrastructure

The verified existing VII Cloudflare account now contains an isolated quality
D1, release/monitor/deadletter queues and a private evidence bucket. The exact
identities and readback are in `cloudflare-quality-inventory.json`. None is the
canonical business database. No business data was moved or replaced. The new
bucket has no public dev URL or custom domains. Readback confirms prefix rules:
failure images 30 days, traces 7 days, summaries 90 days. Existing media buckets
were untouched. The controller and browser Worker configurations have no public
routes and remain unactivated. Configuration is not deployment evidence.

## HTTP and background ownership

The controller admits and reads durable jobs. Execution belongs to Queue
consumers. Its separate release and monitor queues use concurrency one, batch
one and bounded delivery attempts. A dispatch is reserved before transport;
uncertain transport never triggers a blind resend and blocks an unclaimed job
with an explicit reason. A running consumer retains its own execution lease.
Poison/exhausted deliveries receive durable classification before ack. Cron
reconciles reserved dispatches and admits at most two monitoring checks per
minute across concurrent invocations. Admission is persistent, observes cadence
overrides and actual active jobs, and preserves ambiguous creation for review.

The Edge bridge is feature gated off. When activated it will send the existing
cookie only to the original VII authorization endpoint. The controller receives
a short-lived signed actor/request envelope, never the login cookie or secret.
Signing uses a purpose-separated Ed25519 key derived from the existing auth
secret. Only the public JWK is exposed. The envelope binds actor, method, exact
path/query, body hash, origin, nonce, expiry and deployed build identity. Target
permissions are checked at the source. Nonces are consumed atomically before
controller operations. History migration, drain, rollback and exact public
activation are still required; the empty new D1 is not a replacement for history.

## Worker-specific transport defect

Actual workerd integration found that `redirect: error` throws before sending
any request. Four supplier adapter families had this same incompatible mode:
Max compounds, Sergey VII, capability discovery and starting-price catalogs.
The new actual-runtime test reproduced all four failing before the repair.
They now use manual redirect handling and their existing non-2xx rejection.
The same test passes all four normal contracts and rejects 302 without following
it or forwarding credentials to its destination. Thirty-one related tests pass.
This is a proven transport defect, not a claim that it explains every observed
public latency problem. Primary reference:
https://developers.cloudflare.com/workers/runtime-apis/request/

## World style ownership

Three world-owned CSS files now own 390 vacation rules, 357 event rules and
134 hourly rules. Shared selectors remain shared. Alongside the existing spa
source, an exact-position manifest has 882 slots in the original cascade. The
build reads four source files and composes them in place, never appending late
imports. The effective normalized CSS SHA-256 is identical to frozen 81f03b74:
`26c269af41b60dde130dd053ac486e7896eaf34cf68b2035af1afb7bde56ef9f`.
Missing/duplicate/unknown fragments block a build. Existing CSS contract tests
now read the effective composed CSS, preserving their assertions. This is source
ownership inside the managed build, not four independently deployed frontends.

Administration navigation and command search now consume one registry, including
quality, worlds and professor routes. All preserve original permission filtering
and disabled automatic prefetch. Browser verification of this newly extended
registry and the integrated full build remains to be done.

## Evidence and limits

Working-tree integration checks passed: controller/outbox/scheduler/queue/gateway
and token tests (24), graph and exact CSS composition (9), supplier family (31),
actual workerd source authorization plus private controller nonce/query/cookie
checks (1). The Worker fixture uses the bundled binary's supported compatibility
date 2026-05-22 and synthetic identities/data only. It tests real WebCrypto and
real D1 runtime, not a Node-only signature mock. The production configs retain
their separately declared compatibility dates. The controller SDK-free dry run
passed at 101.66 KiB before later source additions. These are integration checks
of a dirty working tree, not a frozen candidate or public-release approval.

Early runtime attempts exposed separate fixture mechanisms: package resolution,
dynamic-module collection, the local binary date ceiling and Request class
branding. Those were diagnosed rather than relabeled as application failures.
The first real private-controller run then caught the unsupported redirect mode;
manual redirect handling fixed that observed application defect. Logs are under
`.qa-output/phase4-*`; no credentials or production sessions were used.

Still required: a clean frozen integrated source, complete affected-family suite
and build, compiled browser recheck, independent release verification, migration
and restore rehearsal, private Worker deployment/readback, browser engine
execution, production p95 evidence, and the other unfinished approved chapters.
