# Phase seven: private cloud update and guarded schema change

On 6 November 2026 the qualified phase-six implementation was deployed to the
two existing private Workers from source
`a5233c18c34eaf3b238180676cefb077849df466`, with expected build namespace
`37aea992-09c1-a1bf-7173-9af66834d35e`.

| Worker | Observed version |
| --- | --- |
| vii-quality-browser | d7e716c2-b2a1-4b33-8134-13090ec50750 |
| vii-quality-control | 9a5379f7-30de-4c9d-b4de-f64ccfe8ef9e |

Fresh version, settings and subdomain reads verified the exact source/build,
private Browser/R2 bindings and the controller's new private browser Service
Binding. Authority, execution, scheduling and browser admission remain false.
Both subdomains have enabled=false and previews_enabled=false. Neither worker
has a public route. These are deployed private components, not an active QA
pipeline or a Site publication.

The public Edge remained at version
`605a1a2c-3714-4fbb-befd-5eb603609254`, 100 percent. No Site, DNS, public routing,
booking or messaging change occurred.

## Private quality database only

Before mutation, a Cloudflare D1 SQL export was downloaded and restored into
local SQLite. Integrity passed; all fourteen quality tables contained zero
rows. Backup size was 4,533 bytes, SHA256
`20bd66993dd561b9dc4943b4e7d2a98ce49d00465edcd0b337211e1bc261840c`.
The ignored local backup is `.qa-output/phase7-private-quality-before.sql`.
This is a local restore exercise, not a cloud failover or business-history
restore test. The export follows the official endpoint:
https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/.

Expected schema was generated through the actual runtime initialization
helpers in local SQLite, including auxiliary schema and a nonexistent browser
job whose executor could not run. It produced sixteen quality tables and six
indexes. Existing table columns matched the restored backup exactly. The
applied delta contained only two new CREATE TABLE statements:
quality_browser_lane and quality_scheduler_reconciliation_audit. No existing
table, column or business database was altered.

Readback verified all sixteen quality tables and zero rows in every one, with
all four activation flags still false. The first sixteen-branch UNION read
returned HTTP400 after the schema application had already succeeded. There
was no schema retry. Bounded read-only scalar queries verified the original
outcome. An intervening expired OAuth read returned403; the existing Wrangler
official refresh restored authorized reads. No credential was printed or
stored in project artifacts. The Cloudflare internal _cf_KV table is excluded
from the sixteen quality-table count.

Operation and readback receipts are in `.qa-output/phase7-*`. Cloud Browser,
Queue delivery, private evidence retrieval, migration/drain and restoration
under load remain unverified. The core project is still in progress.

## Public timing distinction

Two actual /spas document requests reused one connection in the TLV point of
presence. The first had TCP connect at 936.65ms, TLS at 959.31ms and TTFB at
1295.27ms. The second reused the connection and had TTFB at 54.08ms, total
56.30ms, with an Edge HIT. Both used the older public build. This small sample
is not a browser percentile or proof of usable-content speed.

In the actual public browser, clicking Home's spa link immediately showed the
loading state. The next observation, 9.56 seconds after the click, showed the
correct spa heading and packages. Since another tool operation ran between
observations, this is only an upper observation bound, not a measured 9.56s
navigation duration. No console errors were observed. The temporary tab was
closed. The read-only browser scope did not expose Performance APIs, so no
resource-timing result is claimed.

Contextual RSC cache keys intentionally retain router-state and Vary inputs.
Canonical warm requests do not prove those variants are warm. Independent
source review found no evidence that removing those inputs would be safe.
Stored origin cache timing inside an Edge object is not fresh Edge read time.
