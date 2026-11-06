# VII one-use retained-client-asset operation

These are preserved recipes for the observed November6 operation, not a
generic release orchestrator. They use fixed VII identities and original
`.qa-output/phase14-*` receipts. Never change an operation filename simply to
rerun an uncertain side effect. The existing operation prevents replay.

- Capture uses the complete active public client bundler manifest, exact
  anonymous bytes and stable build/manifest before and after. No cloud write.
- Seed touches only the private retained-assets namespace in the existing
  document-cache bucket. It refuses to overwrite a differing existing object,
  reserves each PUT durably and verifies every actual binary readback.
- The wrapper reads existing Wrangler credentials into memory only. It does
  not create credentials, add permission or print tokens.
- The separate verification rederives complete declared inventory, real lookup
  keys and envelope provenance against fresh original cloud-readback receipts.

The recorded operation succeeded. Do not run the capture/seed again to refresh
its timestamp. Use fresh read-only observation of the original keys when needed.
Run TypeScript-importing recipes with `node --experimental-strip-types` on the
project's minimum supported Node22.13 environment. None of these recipes
publishes a Site/Edge, mutates business data, sends notifications or proves that
the deployed Edge already exposes the new retention fallback.

See `project_knowledge/execution/vii-unified-20261105/PHASE_14.md` for the exact
scope and immutable provenance. Private server tar recovery is not claimed.
