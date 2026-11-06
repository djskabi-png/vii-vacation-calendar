# Phase 21: additional public browser coverage

Status: local implementation and focused tests. Frozen artifact compilation,
compiled UI verification and actual cloud execution remain required. No activation.

The private browser registry now has 34 profiles. Providers, attractions, trails
and the homepage each receive desktop entry and mobile responsive checks. No
map/gallery scenario is advertised for these added worlds. Routes are shared
between controller and runner; attractions use `/attractions`. Stable world
surface markers identify the new worlds while allowing their CMS headings to
change. Empty/error headings, wrong document/build and overflow still fail.

The administration selector labels the new worlds in Hebrew. Its supported
scenario fallback now selects the first actual profile when a previous map
scenario is unavailable in the newly selected world. Viewer permissions and
disabled-runner gating remain enforced. Actual component execution tests cover
the previously disabled mobile selection and its emitted profile identity.

The homepage automatically performs a read-only discovery POST. Treating every
POST as a business write would prevent truthful homepage coverage. The runner
now permits only the owned exact same-origin `/api/vii/live-search` endpoint,
without query/credentials, with JSON up to 8 KiB, known keys and bounded typed
party/date/candidate inputs. Candidates cannot extend the outer date window.
This endpoint only searches supplier availability and uses its existing bounded
discovery-cache writes. Booking, lead, payment, administration and all other
POSTs remain blocked. Request/overall-time limits still apply.

The immutable browser definition includes the read-only policy, shared world
contract and reviewed API/search/cache source files. Changing those inputs
requires definition regeneration and consumer requalification. A deployment
guard test actually modifies the endpoint and proves the stale definition is
rejected. The route/heading definitions and response build fence remain distinct
from proof of live inventory or booking correctness.

Forty-seven focused engine, request, profile, job and actual selector tests passed.
Independent source review found no concrete route or write-policy blocker.
These tests use controlled browser/transport fixtures, not live supplier data.
The complete public/API acceptance and authority integration are still open;
document 3 remains deferred.
