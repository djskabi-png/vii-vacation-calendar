# Phase seven cloud execution evidence

One controlled negative browser smoke ran through the actual Cloudflare release
Queue, deployed private controller, Browser Service Binding, Cloud Browser and
private R2 evidence bucket. Implementation identity remained qualified source
`a5233c18c34eaf3b238180676cefb077849df466` and build namespace
`37aea992-09c1-a1bf-7173-9af66834d35e`.

The operator bootstrap used the actual createBrowserQualityJob and controller
dispatch helpers against the isolated quality D1. It created a durable job,
run projection and outbox reservation before exactly one Queue send. The
public authorization gateway was not used, so this smoke does not prove a
live administrator's delegated authorization. That boundary has separate
actual-workerd tests.

Run ID: `22e7ee15-4250-4cf2-b139-8b2758bf9ea5`.
Profile: spa-desktop-world-shell.
Controller during the bounded smoke:
`1f5165df-8578-4446-a005-897edbaab4db`.
Authority and scheduling remained false. Only private execution and browser
execution were temporarily true.

## Observed outcome

The browser opened the real public spa page. Its observed build was older than
the candidate, so the persisted receipt was blocked with
observed_build_mismatch. Browser duration was 10,514ms. This includes launch,
document work, failure screenshot and cleanup; it is not a page TTFB or LCP.
The job cursor completed with one blocked receipt; the projected run status
was failed, with passed=0 and blocked=1. It was not relabelled as a browser pass.

The exact screenshot was stored under:

`qqqaaa/failures/a5233c18c34eaf3b238180676cefb077849df466/22e7ee15-4250-4cf2-b139-8b2758bf9ea5/desktop-world-shell.jpg`

It was downloaded through the authorized R2 CLI to
`.qa-output/phase7-cloud-browser-negative-smoke.jpg` and visually inspected.
The image shows the public spa heading, search controls and popular searches.
No public evidence URL was created.

## Closed operational state

The controller was returned to all four flags false and read back at version
`15cb4bc0-20c4-4388-af65-f0dddd8ccf02`. Both private subdomain access flags
remain false. The browser Worker remains version
`d7e716c2-b2a1-4b33-8134-13090ec50750`.

D1 readback showed one retained job, one consumed dispatch with attempts=1,
zero running jobs and zero browser lane rows. The known negative-test incident
was acknowledged by the controlled-smoke operator. Its one unsent notification
outbox row was marked superseded so later provider configuration cannot send
this intentional test alert. No job, result, incident or audit record was
deleted. Notification deliveries remain zero. Queue send metadata initially
reported approximate backlog=1; this is not proof of a later zero backlog.

The public Edge remained version
`605a1a2c-3714-4fbb-befd-5eb603609254`, 100 percent. No Site publication,
booking, payment, call or outbound message occurred.

Receipts: `.qa-output/phase7-cloud-smoke-operation.json`,
`.qa-output/phase7-cloud-smoke-readback.json` and the two bounded smoke toggle
operations. The operation identity and original job were preserved throughout;
there was no resend or second browser job.

Official Queue transport contract used:
https://developers.cloudflare.com/api/resources/queues/subresources/messages/methods/push/.

## Additional small public sample

Two canonical spa RSC requests reused one connection. The first returned200,
Edge MISS and origin navigation-cache HIT, with TTFB1297.82ms. The second
returned200 and Edge HIT, with TTFB26.49ms and total36.77ms. This proves that the
ordinary RSC variant can be warm. It does not isolate actual client hydration,
contextual variants or usable-content timing. Old cached origin timings were
not treated as current Edge-read durations.

The project remains in progress. A correct negative generation fence is only
one runtime contract; matching-generation browser acceptance, scheduling,
field performance, migration/drain/restore and the rest of the approved core
scope still require completion.
