# VII technical follow-up — 2026-10-05

## Git push: blocked; no branch update

Exactly one ordinary Git push was attempted for local commit
`170b5e3c66970a2ac5d6ae54b7212375554df785` to the existing branch
`review/vii-sergey-api-only-20261005` in `djskabi-png/vii-vacation-calendar`.
The command used `GIT_TERMINAL_PROMPT=0` and no new credential or secret key.
It exited with code 128:

```text
fatal: could not read Username for 'https://github.com': terminal prompts disabled
```

The environment has no usable existing Git HTTPS authentication for this operation.
The push was not repeated. No Site version was saved or deployed.

## Verifiable technical correction

The rendered-HTML test helper previously imported the compiled Worker with a new
module URL for every request. The enlarged sitemap crawl did not finish in earlier
full-suite attempts. It now imports the compiled Worker once and reuses that promise
for every request, matching the Worker lifecycle without changing site data or UI.
The existing response deadlines and all sitemap assertions are retained.

Validation:

- Isolated sitemap test passed, completing in approximately 12 seconds.
- All **1,052** canonical sitemap URLs were checked for HTTP 200, a title,
  nonempty description, canonical URL, one H1, no noindex directive and valid JSON-LD.
- `pnpm test` completed the production build and the entire suite:
  **452 tests, 433 passed, 19 failed**.
- The remaining failures concern legacy content, IDs, deals, taxonomy, multi-world
  offerings and gallery source-string contracts. This follow-up does not waive
  them or assert that every one is obsolete.
- `git diff --check` passed.

The previous release review is unchanged, byte for byte:

`project_knowledge/VII_API_RELEASE_REVIEW_2026-10-05.md`

SHA-256:
`dbed742a3f2b1b2e159677fadebbb91baa01cda60411ec0cf1d5ce6f6bdb18b8`

Its rights, identity-mapping, taxonomy, capacity, media and release blockers are not
invented, approved or removed. This separate follow-up records only the new technical
evidence that the sitemap gate can now complete. The Site remains unpublished.
