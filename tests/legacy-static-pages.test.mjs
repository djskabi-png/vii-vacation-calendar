import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("preserves the old site general footer destinations", async () => {
  const [footer, config] = await Promise.all([
    read("../app/components/site-footer.tsx"),
    read("../next.config.ts"),
  ]);
  assert.match(footer, /href="\/legal\/privacy"/);
  assert.match(footer, /href="\/legal\/terms"/);
  assert.match(footer, /href="\/legal\/cancellation"/);
  assert.match(footer, /href="\/accessibility"/);
  assert.match(footer, /href="https:\/\/www\.spaplus\.co\.il\/club\/\?src=vii"/);
  assert.match(footer, /target="_blank" rel="noopener noreferrer"/);
  assert.match(config, /source: "\/privacy_policy", destination: "\/legal\/privacy", permanent: true/);
  assert.match(config, /source: "\/term_and_conditions", destination: "\/legal\/terms", permanent: true/);
  assert.match(config, /source: "\/:locale\(en\|ru\|fr\)\/privacy_policy", destination: "\/:locale\/legal\/privacy", permanent: true/);
  assert.match(config, /source: "\/:locale\(en\|ru\|fr\)\/term_and_conditions", destination: "\/:locale\/legal\/terms", permanent: true/);
});

test("migrates the substantive privacy and terms structure", async () => {
  const [privacy, terms] = await Promise.all([
    read("../app/legal/privacy/page.tsx"),
    read("../app/legal/terms/page.tsx"),
  ]);
  for (const heading of ["מסירת פרטים ומידע אישי", "מידע שנאסף במהלך השימוש באתר", "מסירת מידע לצדדים שלישיים", "עוגיות וטכנולוגיות דומות", "עיון, תיקון ומחיקת מידע", "שינויים במדיניות"]) assert.match(privacy, new RegExp(heading));
  for (const heading of ["שירותי הפלטפורמה", "גישה ושימוש באתר", "מידע, תוכן וקניין רוחני", "הזמנות וביטול עסקה", "בריאות, בטיחות ואחריות", "דין וסמכות שיפוט"]) assert.match(terms, new RegExp(heading));
  assert.match(privacy, /514301837/);
  assert.match(terms, /514301837/);
});

test("does not invent a universal cancellation policy", async () => {
  const cancellation = await read("../app/legal/cancellation/page.tsx");
  assert.match(cancellation, /אין באתר מדיניות ביטול אחת לכל המקומות/);
  assert.match(cancellation, /התנאים המחייבים הם התנאים שהוצגו ואושרו בהזמנה המסוימת/);
  assert.match(cancellation, /href="\/booking\?action=manage"/);
  assert.doesNotMatch(cancellation, /ללא תשלום דמי ביטול/);
});
