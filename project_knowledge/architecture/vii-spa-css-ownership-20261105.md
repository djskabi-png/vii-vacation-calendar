# VII SPA CSS ownership

This slice establishes the first enforceable world boundary for the SPA audience and date UI.

- Source owner: `app/worlds/spa/styles/spa-audience-date.css`.
- Runtime slot: `app/globals.css` at `VII_SPA_AUDIENCE_DATE_CSS_SLOT`.
- Build owner: `vii-spa-css-slot` in `vite.config.ts`.
- The plugin injects the source at the original slot during Vite pre-transform, preserving cascade order and selector specificity. It does not add a late CSS import or a wrapper selector.
- Build/watch fails closed when the source is missing, empty, or the marker is missing or duplicated.
- The source declarations are parity-checked against the approved baseline block and exercised in a browser at desktop and mobile viewport sizes.
- This is intentionally one bounded slice. Remaining SPA rules stay in `app/globals.css` until separately extracted and parity-verified.
- The shell boundary attributes remain provided by `PageShell`; no world taxonomy or non-SPA tokens were changed.

Baseline declaration reference: commit `2c6fda30`.
