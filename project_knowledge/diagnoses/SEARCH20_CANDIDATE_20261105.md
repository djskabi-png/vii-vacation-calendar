# Search 20 candidate verification

The same 20 legacy search intents were run against the local candidate origin `http://127.0.0.1:4191`, using the exact date, party, price and sort parameters in the audit script.

Result: 20/20 passed. Every candidate path returned the expected redirect chain and final HTTP 200, with the intended query fields retained. The public v798 run remains recorded in the earlier audit output/log and had 9/20 pass, 11/20 not verified, predominantly dated legacy inputs returning 404 or unresolved redirect chains.

Evidence: `.qa-output/audit-search20-20261105.mjs` and `project_knowledge/diagnoses/SEARCH20_CANDIDATE_20261105.json`.
