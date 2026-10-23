# VII Continuous Quality Platform

## Outcome

VII needs one durable quality system that prevents a change in one world or shared component from silently removing or breaking behavior in another. The system must use stable check identifiers, retain evidence by release, expose incidents in the administration system and notify verified recipients without duplicate messages.

Version 596 is the baseline release for this system. Its exact published commit is `79a923185f836eb80eb14f7879782f68932e8e20`.

## What is active in version 596

- Production build, TypeScript and 1,509 automated tests passed before publication.
- Focused regression locks cover booking return destinations by world, catalog WhatsApp preservation, world-specific booking copy and schedules, public-feature filtering, capacity contradictions, area-before-locality breadcrumbs, passive map fallback and availability FAQ wording.
- Version 596 was published once and verified directly on public vacation, spa and attraction pages.

These checks are release evidence. They are not yet a continuous monitoring product, an administration dashboard or an email delivery system.

## Permanent check registry

Every check receives an immutable identifier and these fields:

- `checkId`, `family`, `world`, `route`, `viewport`, `severity`, `owner`
- `preconditions`, `action`, `expected`, `evidenceType`, `timeoutMs`
- `releaseBlocking`, `productionCadence`, `recoveryCheck`

Required families:

1. Global shell: header, footer, navigation, language, accessibility, install app and legal links.
2. Search: destination, dates, guests, filters, no-result recovery, nearest-result expansion and minimum result policy.
3. Cards and rails: image, price, availability, phone, WhatsApp, touch drag, arrows, loading, empty and error states.
4. Place pages: breadcrumbs, title, geography, contacts, gallery, score, rooms, sleeping layout, features, accessibility, discreet entry, map, FAQ, policies, reviews and nearby content.
5. Booking: world-specific entry, selected offer, dates, guests, validation, supplier result, uncertain-result protection, return path and persistence.
6. SEO and legacy: canonical, metadata, structured data, breadcrumb schema, sitemap, redirect and 404/410 behavior.
7. Supplier and data freshness: catalog, capability, availability, quote, cache age, scheduler and source provenance.
8. Administration: authentication, role permissions, content approval, redirects, catalogs, operations and quality incidents.
9. Performance and reliability: home, search, place page, back navigation, cached and cold paths, image loading and third-party failure containment.
10. Public trust: privacy, cookies, consent, cancellation, accessibility, image rights and safe public feature policy.

## Execution layers

### Release gate

Runs against the exact immutable candidate before publication. It includes build, type checking, unit and contract tests, desktop and mobile browser flows, accessibility checks, broken-link checks and a diff-based affected-family suite. A failed release-blocking check prevents publication.

### Deployment smoke test

Runs against the exact public deployment after publication and before the release is marked accepted. It checks the homepage, one representative route per world, search, one place page per world, booking entry and return, contacts, galleries, map fallback and administration health. Failure opens a critical incident and recommends rollback; it never republishes automatically.

### Production synthetic monitoring

- Every 10 minutes: API health, scheduler freshness, catalog freshness, availability and quote boundaries.
- Hourly: critical visitor journeys for every world on desktop and mobile profiles.
- Daily: the full component registry, link graph, metadata, redirects, empty/error/loading states and administration reads.
- Weekly: broader visual comparison, performance budgets, accessibility audit, legacy parity sampling and content completeness.

Checks must use known non-destructive fixtures. They must not create bookings, leads, reviews, payments or outbound messages unless a separately approved synthetic fixture and idempotency key exist.

## Data model

### `quality_checks`

Registry and ownership of every check. Definitions are versioned, never silently overwritten.

### `quality_runs`

One row per execution with environment, release SHA, deployment ID, start/end time and summary counts.

### `quality_results`

One row per check result with status, duration, observed value, expected value, evidence URL or artifact and error classification.

### `quality_incidents`

Lifecycle record with severity, first seen, last seen, affected release, owner, acknowledgement, resolution and recovery evidence.

### `quality_notification_deliveries`

Idempotent delivery ledger with recipient, channel, incident revision, provider identifier and confirmed status.

The incident deduplication key is `environment + checkId + route + viewport`. A continuing failure updates the existing incident. A recovered check closes it only after its configured recovery check passes.

## Administration product

Add `/admin/quality` with:

- overall status and current release identity;
- active incidents ordered by severity and age;
- results by world, page family, viewport and release;
- exact screenshot, response excerpt or trace for every failure;
- freshness panels for supplier, cache and scheduler data;
- acknowledge, assign, resolve and reopen actions;
- comparison with the last accepted release;
- a manual read-only run button for safe suites;
- notification delivery history.

The dashboard must distinguish `failed`, `degraded`, `not run`, `blocked` and `passed`. Missing evidence is never shown as passed.

## Notification policy

- Critical: administration incident immediately, then one email after a discriminating confirmation probe unless the site is entirely unavailable.
- High: administration incident and email after confirmation.
- Medium and low: administration incident plus daily digest.
- Recovery: one recovery email tied to the same incident.
- No repeated email while the incident state and evidence revision are unchanged.
- No automated WhatsApp without separate explicit authorization.

Email recipients are Adir, Liran and Palumbo only after each exact email address, consent and sending provider are verified. Names, UI hints or historical messages are not sufficient evidence. A provider response without a message identifier is not delivery proof.

## Performance budgets

Measure real navigation and server timing separately. Initial budgets are recorded as baselines, not invented promises. After seven days of production measurements, approve budgets for:

- homepage cached and cold load;
- search submission to usable results;
- place-to-place navigation;
- place page above-the-fold usability;
- return to homepage;
- image decode and largest contentful paint;
- supplier-dependent availability and quote response.

A regression is evaluated against both the approved absolute budget and the last accepted release.

## Rollout order

1. Import the complete numbered component registry and tag the existing tests with stable check IDs.
2. Add the run, result and incident persistence model with read-only administration views.
3. Add the deployment smoke suite and fail-closed release acceptance report.
4. Add scheduled safe production checks and recovery logic.
5. Configure a verified email provider and exact recipients, then test delivery once with explicit action-time approval.
6. Add visual, accessibility and performance baselines after enough production evidence exists.

## Acceptance gates

The quality platform is complete only when:

- every registered component maps to an automated check, a bounded manual check or an explicit non-applicability reason;
- a deliberately broken fixture opens exactly one incident with useful evidence;
- acknowledgement and resolution persist across reload;
- recovery closes the same incident instead of opening a new one;
- a notification is sent once, has a provider identifier and is visible in delivery history;
- unauthorized administrators cannot view or mutate quality incidents;
- the public site is not slowed or made dependent on the monitoring system;
- one full deployment is guarded end to end and the exact public release is recorded.

## Current blocker for email delivery

The repository currently has no verified transactional email adapter or configured provider contract for quality alerts, and the exact email addresses for all three recipients have not been verified in this task. The administration incident ledger can be implemented independently. Live email sending must remain disabled until provider credentials, sender domain and recipient identities are verified.
