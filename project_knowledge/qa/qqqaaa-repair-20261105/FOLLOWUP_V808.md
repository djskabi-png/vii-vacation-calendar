# Direct legacy location redirects and preserved semantic intent

Candidate until exact public verification. Public v807 source0d84c8871372ed0433d829fa57a90db5c3704eb3 succeeded under deploymentappgdep_6aeca1166cf88191b029d56952b25502, environment32. Actual public buildf756b591-e432-458b-9fd5-3d502ca28b66, edgev18 version4e852f47-a02e-4b0e-a054-d02435c6534e. Route fail-open and21 unrelated routes were verified.

## Fresh HTTP findings

The actual20-case v806 new-host search matrix returned20initial301and20final200, but14cases contained a second301 through a generic location query. The first harness failed to capture the response build header, so that artifact cannot certify its build. It is evidence of the recorded redirect chains only. The old domain remains live; its200responses are not evidence of a cutover failure. No DNS change was made.

Two exact old-page GETs additionally exposed semantic loss:

- /s?attr=277&sett=1244 returned title נופש ברעננה עם בריכה, while the registered target omitted the city entirely.
- /s?attr=279&sett=508 returned title נופש בגבעת זאב עם נוף, while the target omitted the verified amenity279, נוף.

Three actual legacyDisposition tests reproduced these failures before the fix and passed afterwards.

## Repair boundary

The existing approved-location redirect rule is now a small shared pure helper used by the proxy, legacy resolver and managed Worker redirect destination. It retains the same approved registry, exact location slugs and vacation type-query exception. Unknown locations keep a usable parameter search instead of an invented route. It preserves origin and transactional state and is idempotent on its own destination.

Known numeric legacy attr IDs on generic vacation search targets map through the verified supplier amenity taxonomy. Pool and accessibility keep their dedicated parameters; other known filters remain in features, including amenity279. Unknown IDs are not semantically guessed. The one verified missing settlement1244 retains רעננה as a location parameter because it currently has no approved vacation city landing. Existing dedicated legacy pages keep their own semantics. Dated event search aliases also retain the same transactional fields as vacation aliases.

The dated/undated regression now compares the same final semantic destination; expecting the superseded generic inventory pathname would reintroduce the observed chain. A stale proxy source guard was moved to the shared policy without removing its approved-registry or unknown-location checks. Actual tests cover the four worlds, immutable inputs, preserved price/date/party state, unknown locations and the type exception.

The initial full suite correctly rejected runtime/inventory target disagreement. The fix normalizes27stored targets through the same pure policy and updates the generator, while preserving the existing complete3554-case built-Worker test. Verified old roomTypes IDs are shared with the existing accommodation-membership snapshot script, so villa and hospitality-complex selections survive migration. A build-time-only helper resolves an existing approved Herzliya villa/pool page; the heavy editorial index is not imported by the Worker.

All four existing catalog jobs were enabled with original prompts, timezones and schedules. The automation tool prohibits frequencies above hourly, so the requested half-hour cadence was not attempted and no offset job or new identity was created. Vacation remains hourly. The administration copy now states that configured cadence and describes a retained cached list without falsely treating each30-minute freshness-window expiry as a missed hourly job. Cache validation and final live booking checks are unchanged. Future execution must still be observed separately from configuration.

## Required closure

Final build/full suite/source guard and independent review; exact publication and edge coordination; rerun all20new-host searches with direct301then200andactualbuildheaders, preserving UTF8 and every transactional field. Compare source/public identities separately; an HTTP200does not establish search-result identity parity. No order, payment, lead, email or DNS action is included.
