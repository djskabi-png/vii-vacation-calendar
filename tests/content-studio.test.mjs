import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  createContentItem, ensureContentItem, parseContentChange, parseContentCreate, readContentItems,
  readContentVersions, readPublishedContent, readPublishedItems, saveContentItem,
} from "../app/lib/content-studio.ts";

async function database() {
  const sqlite = new DatabaseSync(":memory:");
  const source = await readFile(new URL("../drizzle/0008_content_studio.sql", import.meta.url), "utf8");
  for (const sql of source.split("--> statement-breakpoint").map((part) => part.trim()).filter(Boolean)) sqlite.exec(sql);
  return {
    prepare(sql) { let values = []; return { bind(...next) { values = next; return this; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...values).changes } }; },
      async first() { return sqlite.prepare(sql).get(...values) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...values) }; } }; },
    close() { sqlite.close(); }, sqlite,
  };
}

const source = { type: "spa", key: "77", world: "spa", sourceLabel: "Gal / Spa Plus API", locale: "he",
  title: "ספא מקור", summary: "זהו טקסט המקור שהתקבל ממערכת הספק ונשמר להשוואה.", body: "פסקת מקור", slug: "spa-source", indexable: true };

function change(item, status, title, action = "save", scheduledAt = null) {
  return parseContentChange({ id: item.id, expectedVersion: item.version, status, action, scheduledAt,
    content: { ...item.draft, title, summary: "זהו תקציר עריכתי מלא של VII שמוכן להצגה בעמוד הציבורי.",
      metaTitle: `${title} באתר VII`, metaDescription: "תיאור מטא עריכתי מלא שמסביר לגולש מה ימצא בעמוד הציבורי לפני הכניסה אליו.", indexable: true } });
}

test("content studio preserves supplier source while publishing and versioning a VII override", async () => {
  const db = await database();
  try {
    const item = await ensureContentItem(db, source);
    assert.equal(item.source.title, "ספא מקור");
    const published = await saveContentItem(db, change(item, "published", "ספא בעריכת VII", "publish"), "editor@vii.co.il");
    assert.equal(published.version, 2);
    assert.equal((await readPublishedContent(db, "spa", "77")).content.title, "ספא בעריכת VII");

    const [current] = await readContentItems(db, "spa", "he");
    await saveContentItem(db, change(current, "draft", "טיוטה חדשה"), "editor@vii.co.il");
    assert.equal((await readPublishedContent(db, "spa", "77")).content.title, "ספא בעריכת VII", "a draft must not replace the live version");
    assert.equal((await readContentVersions(db, item.id)).length, 2);
  } finally { db.close(); }
});

test("archiving removes the managed public override and stale writers cannot overwrite a newer version", async () => {
  const db = await database();
  try {
    const item = await ensureContentItem(db, source);
    await saveContentItem(db, change(item, "published", "גרסה חיה", "publish"), "one@vii.co.il");
    assert.deepEqual(await saveContentItem(db, change(item, "draft", "כתיבה ישנה"), "two@vii.co.il"), { error: "version_conflict" });
    const [current] = await readContentItems(db, "spa", "he");
    await saveContentItem(db, change(current, "archived", "גרסה חיה", "archive"), "one@vii.co.il");
    assert.equal(await readPublishedContent(db, "spa", "77"), null);
  } finally { db.close(); }
});

test("navigation publishes links without fake article copy and original items start as private drafts", async () => {
  const nav = parseContentChange({ id: "navigation:primary:he", expectedVersion: 1, status: "published", action: "publish", scheduledAt: null,
    content: { title: "תפריט ראשי", summary: "", body: "", metaTitle: "", metaDescription: "", slug: "", imageAlt: "", indexable: false,
      links: [{ id: "spa", label: "ספא", href: "/spas", group: "עולמות", order: 1, visible: true, newWindow: false }] } });
  assert.ok(nav);
  const created = parseContentCreate({ type: "trails", key: "new-desert-trail", locale: "he", title: "מסלול מדברי חדש" });
  assert.ok(created);
  const db = await database();
  try {
    const result = await createContentItem(db, created, "editor@vii.co.il");
    assert.equal(result.status, "draft");
    assert.equal((await readContentItems(db, "trails", "he"))[0].sourceLabel, "VII original content");
    assert.equal(await readPublishedContent(db, "trails", "new-desert-trail"), null);
    const [draft] = await readContentItems(db, "trails", "he");
    const publish = parseContentChange({ id: draft.id, expectedVersion: draft.version, status: "published", action: "publish", scheduledAt: null,
      content: { ...draft.draft, summary: "מסלול מדברי עצמאי עם תכנון ברור ומידע בטיחותי לפני היציאה.", body: "יוצאים בשעות הבוקר.\n\nבודקים תנאי שטח.",
        metaTitle: "מסלול מדברי חדש", metaDescription: "מדריך מלא למסלול מדברי עצמאי עם משך, קושי, מפה ומקור רשמי לבדיקה לפני היציאה.", indexable: true,
        attributes: { mainArea: "דרום ונגב", region: "הנגב", nature: "מדבר, תצפית", duration: "שעתיים", difficulty: "בינוני",
          officialSource: "https://example.com/trail", sourceName: "מקור רשמי", mapQuery: "הנגב" } } });
    assert.ok(publish);
    await saveContentItem(db, publish, "editor@vii.co.il");
    assert.equal((await readPublishedItems(db, "trails"))[0].key, "new-desert-trail");
  } finally { db.close(); }
});

test("non-Hebrew CMS content cannot publish while supplier or editorial fields still contain Hebrew", () => {
  const base = { title: "Spa in Paris", summary: "A complete approved description for visitors in France.", body: "Approved body.",
    metaTitle: "Spa in Paris | VII", metaDescription: "A complete approved metadata description for this public page.", slug: "spa-paris",
    imageAlt: "Spa room", indexable: true, links: [], attributes: {} };
  assert.ok(parseContentChange({ id: "spa:paris:fr", expectedVersion: 1, status: "published", action: "publish", scheduledAt: null, content: base }));
  assert.equal(parseContentChange({ id: "spa:paris:fr", expectedVersion: 1, status: "published", action: "publish", scheduledAt: null,
    content: { ...base, summary: "Texte approuvé עם שארית עברית" } }), null);
  assert.ok(parseContentChange({ id: "spa:paris:fr", expectedVersion: 1, status: "draft", action: "save", scheduledAt: null,
    content: { ...base, summary: "טיוטה שעדיין דורשת תרגום" } }), "drafts remain editable until an approved translation exists");
});

