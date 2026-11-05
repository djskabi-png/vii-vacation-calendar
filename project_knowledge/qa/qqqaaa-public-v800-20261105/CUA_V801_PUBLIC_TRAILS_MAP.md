# Public v801 CUA verification

Date: 2026-11-05
URL verified: `https://vii.spaplus.co/trails?area=%D7%A6%D7%A4%D7%95%D7%9F`

Read-only Chrome CUA verification after settle:

- Filter summary visibly retained `צפון`.
- Popular links contained area-specific query URLs for North, Center and South.
- Result count was `6 מסלולים מתאימים`.
- Six visible cards matched the North context: תל דן, נחל חרמון, מערת קשת, נחל כזיב, נחל שניר and הר כפיר.
- Breadcrumb remained `ראשי > מסלולי טיול`.
- Long-tail region/type links used `/trails/explore/north?...` URLs with the selected query.

Navigation click:

- Starting from public `/trails`, activating the “מסלולים בצפון” popular card first showed the navigation loading state, then settled at `https://vii.spaplus.co/trails?area=צפון`.
- After settle, the summary read `צפון`, the filter button read `אזור צפון`, and the result count was `6 מסלולים מתאימים`.
- The six settled cards were North entries including תל דן, נחל חרמון, מערת קשת, נחל כזיב, נחל שניר and הר כפיר.

Map interaction:

- Toggled the map checkbox read-only.
- UI changed to `6 מסלולים באזור המוצג במפה` and exposed `חזרה לרשימת המסלולים`.
- Map pane exposed zoom controls, map-type control, Leaflet/OpenStreetMap attribution, one map-area marker summary, and a visible `חזרה לרשימה` button.
- Visible card headings remained the same six North results while map view was open.

Limits of the first checker pass: default desktop viewport only; no mobile viewport, geolocation, booking, message, or admin mutation was performed.

Root follow-up through the documented DOM browser API exercised `back()` and `forward()`: the base route restored the all-country summary and the forward navigation restored North with six cards. An earlier checker inference that the popular links dropped their query was retracted after reading the actual anchor href. The root screenshot did expose a real map defect: one regional marker represented six trails, while the overlay said one place. The follow-up source adds an explicit represented-result count and translated approximate-area label; live verification of that new source remains required.
