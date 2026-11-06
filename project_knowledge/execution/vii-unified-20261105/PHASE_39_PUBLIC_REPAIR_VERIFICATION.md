# Public v811, observed recovery and remaining acceptance

The existing owning publication conversation saved one version and deployed it
once, without a remote rebuild. Deployment succeeded on6 November2026 at15:31:33
Israel time. This is a controlled repair milestone, not whole-project approval.

| Identity | Observed value |
| --- | --- |
| Version | `appgprj_6a71ccdca27481918bf04dd329d3eb21~appgver_a85b1d5864408191819b3df7ba316eea` |
| Deployment | `appgdep_6aedd69781308191a6b189cc41b63c43` |
| Application source | `1d96d3c4c8222a21674b092c34ad54895956743b` |
| Managed commit | `bfdb0a52bd6aeee2caf31e45a36a588c86edf1d9` |
| Application tree | `9f039eddffe40cc448198c7f0ecb394c55a7f2f9` |
| Build namespace | `2f74283b-12fe-cffa-db0b-5dab682e329b` |
| Environment/audience |32 / PUBLIC |
| Input archive SHA256 | `399c6783c98450c71a9073382577b77d4874738868e0a10fd6c65b8a2a5ce10a` |
| Input archive bytes |109247638 |
| Sites stored container SHA256 | `681331e4438559b6bb50dc51537ede8a032a0d26a5823daa32a59a25e6f8d7dd` |

The input archive and provider container are distinct representations. The
original DB/UPLOADS bindings and public audience/environment were preserved.
Rollback remains exact v810 with deployment
`appgdep_6aedc23a1cd881918ccb717526b906fc` and its saved version.

## Qualification and actual public observations

* At the frozen application source:2479 tests passed, zero failed, one existing
  skip; TypeScript, source guard28 ancestors/22 families, controller96 tests and
  browser30 tests passed. Archive audit compared1241 compiled files and1262
  archive files, with241 manifest references and302 server modules/imports.
* Fresh public home/events reads returned200 with both application/cache build
  headers matching the exact namespace. The public verification-key endpoint
  now returns200 JSON with one public Ed25519 key and no private key material.
* `/last-minute` and the `/contact` redirect to `/join` returned the exact
  application build and passed the production generation validator even without
  cache admission. The original false generation rejection is repaired.
* Root opened the authenticated production quality screen through the existing
  Chrome session. Its quality data loaded; the earlier unavailable-data error
  and loading state were absent. Browser controls and incident sections were
  present. No run was started, and no roles or permissions changed.
* Root executed all eight real discovery probes at one frozen clock using the
  actual production validators. All eight passed semantic validation, current
  build identity, snapshot freshness, date/guest/offer and join checks. Vacation
  counts were30–42; event result/place counts were33–36. No raw business payload
  or contact data was retained. This is current smoke evidence, not a replacement
  for the immutable formal release subject.

Actual matching private service generations after independent readback:

| Unit | Active version |
| --- | --- |
| Browser | `1c49d3c3-8933-452e-a47e-b566457647c9` |
| Controller | `7ddc57c4-ff85-4dbb-85d3-0c711bc38c3a` |
| Edge | `1108e705-adbf-4b04-9ec0-932722412c4a` |
| Images, unchanged | `848da60a-629b-4e27-b17d-ac3191dbc4e5` |

Exact module bytes, full typed bindings, compatibility, access and the original
owned route were read back. Twenty-one unrelated routes were unchanged. The
image Worker was not rebuilt or redeployed. Controller execution/browser/
experience flags are enabled; automatic schedule remains disabled while current
release acceptance is incomplete. The temporary native admission Cron remains
disarmed. The original35 jobs settled28 completed/seven blocked; failed checks
inside completed jobs remain failed historical evidence.

## Performance and open work

Four ordinary repeat document reads were Edge hits with TTFB107–125ms. The first
observed home hit was1156ms. These eight reads are not field p75/p95 or a
controlled cold-cache benchmark. Separate unique-key probes observed7126ms for
home and1720ms for events; app-render timing was785/855ms, while Edge-origin
timing was2883/1604ms. These measurements do not identify every upstream delay.
First-open performance acceptance remains open; cache hits do not close it.

The new private-only budget fix was reproduced locally: the engine returned an
actual failed181-request result, but the parser discarded it because the same
budget was used as a receipt-validity cap. The local fix preserves the actual
count and durable failed reason without allowing a passing over-budget result
or increasing the180-request network budget. A private numeric-only SDK limits
endpoint is also being qualified. Neither new private change is public yet.
They should be released independently if application-input reuse validation
passes, rather than republishing the unchanged Site.

Whole V+QQQAAA acceptance, current formal browser receipts, remaining admin
coverage, recovery evidence and first-open performance remain open. Document3
stays deferred until the unified foundation is accepted.

Evidence is retained under `.qa-output/phase39-*` and the phase38 unit operations;
the deployed source and existing publication route remain recoverable in Git.
