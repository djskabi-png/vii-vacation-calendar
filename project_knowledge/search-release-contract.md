# Search release contract

This project must not approve search changes from a single screenshot or a single route.

## Required state matrix

Before every public search release, run `scripts/audit-search-state.cjs` against the public custom domain for:

- Home
- Vacation results
- Vacation region pages
- Spa
- Events
- Hourly rooms

For every applicable route, verify:

- A fresh mobile load renders real content and never a blank page.
- Opening the guest editor keeps the primary search action visible.
- The contextual guest close button closes or resets only the guest editor. It must not close the full search or remove the search action.
- Pressing the guest summary again closes the guest editor and keeps the search action visible.
- Switching from mobile to desktop restores desktop geometry without root horizontal drift.
- Refreshing on desktop preserves desktop geometry.
- Switching back to mobile restores compact geometry without stale scroll locks.
- Horizontal sliders own their overflow and never increase the root document width.

## Approval rule

Do not approve or describe a release as stable until:

1. The full automated test suite passes locally.
2. The exact source commit is deployed.
3. The public custom-domain state matrix passes with a versioned URL.
4. No development server or browser tab created for QA is left running.

If any state fails, report the failing route and state. Do not replace the failure with a general assurance.
