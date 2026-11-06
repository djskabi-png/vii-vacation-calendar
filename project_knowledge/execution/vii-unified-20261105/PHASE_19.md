# Phase 19: event rail server-to-client boundary

Status: local implementation, focused tests and TypeScript check. Frozen build
and exact rendered artifact verification still required. No public deployment.

The events landing page passed complete supplier records into a client slider,
even though its initial/fallback cards use a small presentation contract. The
accepted local 132-venue sample serialized 249,463 bytes after the existing
image/description bounds. The explicit rail contract serializes 60,540 bytes.
This measures rail JSON only, not total HTML, compressed transfer or browser LCP.

The new projection retains every venue in the same order, all supplied images,
name, location, area, type, capacity, source URL/property identity, phone,
WhatsApp and seasonal starting prices. The source catalog is not changed.
Business detail pages, full galleries, taxonomy and live availability APIs keep
their full records. No venue/image cap was added.

Only the server boundaries on the events landing page and the three preset
pages project the initial props. The client component accepts the narrower
type; live search results keep their separate existing contract. The existing
homepage/regional callers remain structurally compatible.

The three new tests check actual business/quote links, all four locale labels,
geography, seasonal prices, contact/media parity, no source mutation, every
accepted venue ID and the real snapshot payload budget. Existing event,
catalog and homepage tests passed. The initial 31-test run also found that the
newly touched shared event rail had no explicit impact owner. It was assigned
to events, and all seven impact tests then passed. Full TypeScript passed.

Independent code review found no omitted field consumed by the slider. This
does not approve public publication or claim that the full project is complete.

This slice affects only the managed Site's build inputs. The four phase-18
Worker artifacts should be reused only after actual input/digest/ancestry
validation; an application target configuration change remains separate from
service code compilation. No unchanged service needs a speculative rebuild.
