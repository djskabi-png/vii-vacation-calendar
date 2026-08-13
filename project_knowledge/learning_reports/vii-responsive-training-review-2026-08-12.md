# Account training review: responsive state transitions

## Review scope

- Period: 2026-08-11 through 2026-08-12.
- Explicit source task: 019fed6b-96e9-72b3-9d2e-23fff1cee25a.
- Project: VII.
- Evidence report: `vii-responsive-feedback-2026-08-12.json`.
- Messages reviewed: 88 unique user messages from the named task.

## Accepted lesson

Responsive behavior is a runtime state machine. Approval requires transitions between mobile and desktop, reloads at each size, orientation changes and device-emulation changes. The test must include an open overlay or drawer so stale body locks, backdrops, expanded mobile state and saved scroll offsets are exposed.

Stable lesson ID: `ADIR-WEB-005`.

Scope: account rule and shared website skills, explicitly requested by Adir.

Owner: Professor Web.

Checker: Seal.

## Required acceptance evidence

The representative deployed route must pass fresh desktop, desktop reload, fresh 390-pixel mobile, mobile overlay open followed by desktop resize, desktop reload, the 820 and 821 pixel boundary, landscape rotation and return to mobile.

Every step must show meaningful content. Horizontal offset must be zero. Document width must not exceed viewport width. Desktop must have no stale mobile body lock, backdrop, lock attribute or expanded state. Valid search selections should remain when appropriate.

## Changed artifacts

- Account rulebook.
- Shared website build skill.
- Shared website release skill.
- Executable responsive transition audit.
- Canonical learning register.

## Rejected or deferred candidates

No new agent was created because Professor Web already owns website implementation and Seal already owns independent release verification.

Project-specific VII details, including exact routes, selectors and search data, remain in the VII project and were not promoted as account facts.

## Forward test

The new executable gate is run against the public VII search route that produced the original defect. The test opens the mobile search, changes to desktop without first closing it, reloads, checks the breakpoint boundary, changes orientation and returns to mobile.
