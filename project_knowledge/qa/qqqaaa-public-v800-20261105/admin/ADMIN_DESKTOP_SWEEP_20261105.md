# VII admin desktop read-only sweep

Date: 2026-11-05 05:00 Asia/Jerusalem  
Environment: public `vii.spaplus.co`, signed-in production admin session  
Build context: v800 / Site800 `905d5f64` (release context supplied by parent; not independently exposed in the UI)  
Viewport: Chrome desktop default, exact CSS width/height not instrumented in this sweep  
Method: one temporary Chrome tab, accessibility-tree inspection, no save/sync/run/message actions

## Coverage

Visited every distinct route discovered from `app/admin` and the admin navigation, except the login route because the authenticated session was already valid:

| Route | Observed result | Read-only controls seen |
|---|---|---|
| `/admin` | dashboard shell and navigation rendered | global tool search, logout |
| `/admin/growth` | loading state at capture; refresh disabled | sitemap/robots links, report links |
| `/admin/search-pages` | loading state at capture; refresh disabled | 7/30/90-day filters |
| `/admin/business-performance` | funnel shell rendered, report remained loading at capture | tabs, date range, filters, disabled export/refresh |
| `/admin/professor` | question screen rendered; 20 questions available | prompt, suggestions, disabled submit |
| `/admin/quality` | QQQAAA screen rendered; quality state loading | disabled refresh, enabled run button (not activated) |
| `/admin/content-studio` | content source shell rendered; content loading | category and language selectors, search |
| `/admin/worlds` | world-management shell rendered; loading state at capture | no toggle activated |
| `/admin/search-analytics` | loading state at capture; refresh disabled | 24h/7d/30d period filters |
| `/admin/content-queue` | queue shell rendered; search signals loading | status filters and search |
| `/admin/discovery-promotions` | loaded: draft editor, one archived draft, change log | no draft/save/edit action activated |
| `/admin/redirects` | editor and inventory shell rendered; inventory showed 0 and “מעדכנים...” at capture | filters and pagination disabled while updating |
| `/admin/catalog-sync` | loading state at capture; refresh disabled | links to exposure/operations/WhatsApp |
| `/admin/geography` | loading state at capture; summary counters 0 | API refresh and list view not activated |
| `/admin/operations` | loading state at capture; refresh/search disabled | read-only query field |
| `/admin/whatsapp-leads` | loading state at capture; refresh/report disabled | date range, world selector, query field |
| `/admin/users` | initially loading; after ~5 seconds loaded access list | add/edit/history controls not activated |

## Confirmed observations

1. A repeated loading/disabled-control pattern was visible across growth, search pages, business performance, search analytics, content queue, catalog sync, geography, operations and WhatsApp leads during the capture. This is confirmed as a state at capture, not yet proof that every page is permanently stuck.
2. `/admin/business-performance` initially showed `טוענים את משפך הביצועים...`, but a focused follow-up opened `#businesses` and allowed the page to settle. After the bounded wait, the page rendered `921 עסקים`, a populated table, and pagination `עמוד 1 מתוך 19` with `50` rows visible. Therefore the initial loading state is not a confirmed persistent defect. The earlier bounded report remains a historical observation, not a current failure proof.
3. `/admin/redirects` showed `סה״כ במערכת 0 מתוך 0 במיפוי המקורי`, `0` for 301/410 counts, and `מעדכנים...` with disabled pagination at capture. Treat as an operational data-load warning until a bounded refresh/recheck proves whether the inventory is genuinely empty.
4. `/admin/geography` showed all summary counters as `0` while `טוענים את מפת האזורים...` was present. No API refresh was triggered.
5. `/admin/users` eventually resolved after approximately five seconds and exposed two protected owner accounts plus Liran's account marked as saved but not yet signed in. This was observed only for access-state verification; no identity details beyond the rendered admin labels are included here.
6. A focused post-settling recheck showed `/admin/redirects` resolving to 3,554 inventory records, 3,149 301 mappings, 405 410 records, and pagination of 36 pages. This disproves the initial zero/loading snapshot for that route.
7. A focused post-settling recheck showed `/admin/geography` resolving to 3 districts, 25 regions, 1,245 cities/settlements, 1,221 with map points and 24 without. The list showed 1,273 items and the South district editor. This disproves the initial zero/loading snapshot for that route.
8. A focused post-settling recheck showed `/admin/catalog-sync` resolving fully, but its operational alerts explicitly reported that Events, Hourly, Spa and Vacation catalogs had not published successfully within the last 24 hours. It also showed 21 verified online-booking places retained in the fast list, with the last refresh reported as late. This is a confirmed operational alert requiring owner follow-up, not a browser-loading defect.
9. A follow-up on `/admin/search-pages` resolved to a populated work center with search/page counts and a last-updated timestamp, so its initial loading snapshot was transient. `/admin/growth` still visibly displayed `בודקים את מפת האתר...`, `בודקים את הקובץ...` and `בדיקה אחרונה: בתהליך` during the follow-up, so its SEO checks remain unverified rather than marked as a hard failure.
10. Final settling pass covered the remaining ten routes: professor, quality, content studio, worlds, search analytics, content queue, operations, WhatsApp leads, users and discovery promotions. All ten reached a non-loading DOM state on the second observation. Users exposed the access list and add-access control; discovery promotions exposed the draft editor and saved-drafts table; content queue exposed its filter/data shell. No route was marked persistently stuck.

## Safety and evidence limits

- No QQQAAA run, catalog sync, API refresh, draft save, permission edit, logout, message, booking, or destructive action was performed.
- No customer leads, phone numbers, booking details, or raw private payloads were copied.
- The sweep did not test mobile/responsive behavior, keyboard traversal, refresh/retry, or post-load data correctness.
- A loading state needs a timed network/error trace to establish the causal backend failure. The next safe diagnostic is one bounded browser recheck per affected route plus server logs/request timing, not repeated refresh clicks.

## Verdict

The full admin route family reached a non-loading state in this read-only desktop sweep. This is not a complete release sign-off: action outcomes, permissions boundaries, mobile behavior, QQQAAA execution, SEO check completion and operational catalog recovery still require separate evidence. The confirmed operational issue is the stale catalog publication alert; Growth's SEO checks also remained in-progress at capture. This report is an independent observation record, not a deployment claim.
