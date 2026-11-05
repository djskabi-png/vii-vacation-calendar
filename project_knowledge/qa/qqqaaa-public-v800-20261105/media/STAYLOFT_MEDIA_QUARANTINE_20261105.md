# StayLoft media quarantine and retest

Date: 2026-11-05

## Finding

The verified public Event `event-1153` (`StayLoft`) referenced
`796a2fc6bf52100.png` in both its catalog cover and its detail `galleryGroups`
entry. The served image is an availability placeholder containing the text
`מתחם זה אינו זמין באתר`, not a valid StayLoft photograph. The same filename is
present in the migrated legacy media manifest, so allowlisting alone could not
prevent the bad asset from rendering.

## Repair

The shared `localGalleryMediaUrl` normalization boundary now quarantines this
exact filename across local media URLs, legacy `/gallery/` URLs, absolute
legacy URLs, query-bearing URLs and URL-decoded path variants. Invalid media is
dropped. No replacement image is selected from another business or unit, and
valid images in the same general or unit gallery remain unchanged.

Changed files:

- `app/lib/legacy-gallery-media.ts`
- `app/lib/sergey-public-catalog-projection.ts`
- `tests/quarantined-media-normalization.test.mjs`

No catalog, manifest, R2 object, booking data or deployment was changed.

## Evidence

Focused runtime tests passed 9/9:

```text
node --test tests/quarantined-media-normalization.test.mjs tests/legacy-gallery-media-independence.test.mjs
```

The regression covers the exact bad filename in local, legacy and query forms,
valid-image retention, cover projection to the first valid image from the same
business, general-gallery pruning, and unit-gallery identity preservation
without cross-business fallback.

This is source and focused-test evidence only. Publication and public-browser
verification remain outside this lane.
