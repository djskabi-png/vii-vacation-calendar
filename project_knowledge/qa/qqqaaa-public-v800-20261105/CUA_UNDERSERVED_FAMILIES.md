# CUA underserved-family QA

**Correction after root verification:** the generic-trail-href assertion in this historical specialist pass was disproved. Actual public hrefs contain area queries for the three regions, q queries for Finger Galilee/Judean Desert, and `/trails/explore/water` for water. Root screenshots/DOM observations and `FINDINGS.json` Q800-013 supersede that assertion. A separate click transition remained unverified while direct North navigation returned six trails; that is a navigation investigation. The unrelated areaTags source patch was reverted.

Date: 2026-11-05 (Asia/Jerusalem)
Environment: public `https://vii.spaplus.co`, Chrome CUA, read-only, desktop viewport. No orders, messages, CMS saves, or admin mutations.

## Checked

- `/trails`: settled page rendered 48 results, filters, map checkbox, cards, FAQ/editorial/footer, and valid detail links. Breadcrumb was `ראשי > מסלולי טיול`.
- `/attractions`: settled page rendered 6 results, filters, map checkbox, cards, FAQ/editorial/footer, and valid detail links. Breadcrumb was `ראשי > אטרקציות`.
- `/corporate`: settled page rendered the corporate package flow, selectable package/add-on controls, contact form with consent links, popular-search rail, editorial/footer. No form was submitted.
- `/hourly` and `/providers` were inspected earlier in this lane and were both settled with cards, filters, navigation and footer controls.

## Concrete finding

On the public `/trails` page, the “popular searches” links for North, Center and South all exposed the root URL `https://vii.spaplus.co/trails` instead of an area-specific URL. The long-tail rails also exposed root `/trails` for multiple labels (for example “אצבע הגליל”, “מדבר יהודה”, and several trail-type labels), although the same page exposed working canonical explore URLs for the main regions such as `/trails/explore/north` and `/trails/explore/jerusalem`.

This was observed in the live CUA accessibility tree after the page settled, not inferred from source. It is a navigation/SEO/content defect: clicking those labels cannot preserve the promised area/type intent.

On `/attractions`, the inspected popular, region, city and type links were populated with specific query or explore URLs. On `/corporate`, popular links and package/contact anchors were populated and structurally consistent.

## Limits

This pass independently exercised desktop settled states only. I did not change the browser viewport to mobile, did not submit the corporate form, and did not claim all route families or all controls were tested. Loading/retry/back behavior was not independently completed for every family.
