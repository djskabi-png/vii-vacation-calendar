# Phase four verification

Frozen source: `8bca3aab44ae6325ea7814d33053eb500149f5be`.
Tree: `89c5061f87f8944fffd9d0c0dc7decdb17a3e8d9`.
Managed artifact build identity: `2b2dd30a-6b21-4a6c-bbe4-066e5fe51153`.

## Integrated candidate

The corrected frozen source passed the managed build in 28.78 seconds and the
complete suite in 61.33 seconds: 2,363 tests, 2,362 passed, zero failed, one
existing skip. The immediately preceding source had passed full TypeScript,
17 private-controller tests, 15 browser-engine tests and both real Wrangler
dry-run packages. Its only subsequent changes were the documented source-reader
test corrections and phase notes. Source integrity on the corrected frozen
source passed with a clean tree, 28 protected ancestors and 22 capabilities.
No earlier failed full run is represented as passing.

The full suite includes the actual workerd supplier transport regression and
the source/private-controller authorization test. The latter proves Ed25519
under Worker WebCrypto, source delegated read/edit permission separation,
private D1 nonce consumption, replay rejection, exact query binding and cookie
exclusion. It uses synthetic data and the bundled local runtime, not a live
production session. Separate controller tests cover admission, idempotency,
cancel, dispatch uncertainty, poison messages, bounded retries and scheduling.

## Compiled browser

An isolated loopback fixture loaded this exact managed build. Command search
found quality, selected it and closed the dialog while retaining the quality
route. All four core worlds were opened at mobile and desktop widths:

| World | Exact route | Mobile client/scroll width | Desktop client/scroll width |
| --- | --- | --- | --- |
| Vacations | `/search` | 375/375 | 1265/1265 |
| Events | `/events` | 375/375 | 1265/1265 |
| Spa | `/spas` | 375/375 | 1265/1265 |
| Hourly | `/hourly` | 375/375 | 1265/1265 |

The expected Hebrew headings were visible. Events' computed heading font was
Rubik/Heebo/Assistant. This is a basic compiled boundary/navigation check, not
an exhaustive visual approval, public speed result or a legal-accessibility
claim. The viewport was reset, the fixture signed out and its AI-created tab
closed. Owned preview processes were stopped, resource verification found zero
remaining owned processes, and the exact compiled fixture entry was removed.

## Actual isolated Cloudflare provisioning

Account and resource identities are in `cloudflare-quality-inventory.json`.
The dedicated quality D1 was confirmed empty before schema initialization.
Schema was generated from the actual SQLite-compatible initialization helpers,
applied only to that new database and read back: 14 expected tables, zero jobs,
zero runs, zero notification outbox records. Business data/history was not moved.

Two private Workers were uploaded from the clean frozen source:

| Worker | Cloudflare version | Operational state |
| --- | --- | --- |
| `vii-quality-control` | `0325aa4b-da50-489a-9d3a-0f11ad0a6cf0` | Authority, execution and scheduling flags all false |
| `vii-quality-browser` | `183d1412-fbe7-4494-bd88-c0c9aadbb138` | No public route or controller binding; browser execution not yet verified |

Fresh Cloudflare API reads, using the existing account authorization in memory,
confirmed both Workers have `enabled:false` and `previews_enabled:false` for
their subdomains. The version metadata's `has_preview:true` was not accepted as
privacy evidence; actual access settings were read separately. No auth token
was printed or copied into project sources. Version readback confirms the
expected source/build values, Browser Run and private R2 binding, and control
flags. Queue readback confirms one producer and one consumer for release and
monitor, concurrency one, batch one and max retries two. Deadletter has no
independent consumer. Private evidence retention/privacy were read back earlier.

The existing public Edge version remains
`605a1a2c-3714-4fbb-befd-5eb603609254`, unchanged before/after provisioning.
No Site publication, Edge deployment, DNS or public routing change occurred.
No Cloud Browser check, booking, message or real notification was triggered.

## Limits and next work

Private provisioning is not activation or whole-project readiness. The
independent checker permitted considering only this inert provisioning after
runtime/schema checks. Scheduler unknown reconciliation and failure isolation
must be completed before activation. History export/import parity, drain and
restore, real private Queue/browser execution, source/build activation proof,
public latency measurement and the other incomplete approved chapters remain.
There is deliberately no ready verdict for public release.
