# Phase fifteen: build portability and next core integration

Postqualification review identified a build-portability gap: the new lookup
generator imports erasable TypeScript, while package engines permit Node22.13.
That version requires explicit type-stripping opt-in. The build command now
provides `--experimental-strip-types`; no minimum version or feature was
silently removed. Official sources:
https://r2.nodejs.org/dist/v22.13.0/docs/api/typescript.html and
https://nodejs.org/learn/typescript/run-natively.

Actual local loader controls showed the mechanism: explicitly disabled type
stripping failed with exit1; explicit opt-in passed the lookup freshness check
with exit0. This is not a claim of running a Node22.13 binary. Receipt:
`.qa-output/phase15-build-compatibility.json`.

This intentional package/build-input change occurs after the phase-thirteen
freeze. Its qualified artifact and browser observations remain historical
evidence. They do not certify a newer source/build namespace. Accumulate the
remaining necessary core changes, then freeze/build/test/package one new
candidate before any main publication. Do not repeatedly rebuild unchanged
units for documentation or independent tooling.

The next core work includes actual public experience measurement, global
per-unit release/compatibility orchestration, deployed asset fallback, source
and data-generation coverage, business-data backup/restore and exact live
acceptance. The project is still in progress; document3 remains deferred.
