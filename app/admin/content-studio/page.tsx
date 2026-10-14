"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./content-studio.module.css";
import extras from "./content-studio-extras.module.css";

type LinkItem = { id: string; label: string; href: string; group: string; order: number; visible: boolean; newWindow: boolean };
type Content = { title: string; summary: string; body: string; metaTitle: string; metaDescription: string; slug: string; imageAlt: string; indexable: boolean; links: LinkItem[]; attributes: Record<string, string> };
type Item = { id: string; contentType: string; entityKey: string; world: string; locale: string; sourceLabel: string; source: Content; draft: Content; status: string; scheduledAt: string | null; version: number; publishedVersion: number | null; updatedAt: string; updatedBy: string; publicPath: string };
type Version = { version: number; action: string; status: string; content: Content; createdAt: string; createdBy: string };
type Payload = { items: Item[]; counts: Record<string, number>; total: number; truncated: boolean; selected: (Item & { versions: Version[] }) | null };

const types = [["spa", "ספא"], ["vacation", "נופש"], ["events", "אירועים"], ["hourly", "לפי שעה"], ["providers", "ספקים"], ["attractions", "אטרקציות"], ["trails", "טיולים"], ["magazine", "מגזין"], ["navigation", "תפריטים"], ["footer", "פוטר"]] as const;
const statusLabel: Record<string, string> = { draft: "טיוטה", review: "ממתין לאישור", scheduled: "מתוזמן", published: "פורסם", archived: "בארכיון" };
const attributeFields: Record<string, Array<[string, string]>> = {
  trails: [["mainArea", "אזור ראשי"], ["region", "אזור מדויק"], ["nature", "סוגי טבע, מופרדים בפסיק"], ["distance", "מרחק"], ["duration", "משך"], ["difficulty", "דרגת קושי"], ["routeType", "סוג מסלול"], ["bestSeason", "עונה מומלצת"], ["familyFit", "התאמה למשפחות"], ["accessibility", "נגישות"], ["officialSource", "קישור למקור רשמי"], ["sourceName", "שם המקור"], ["mapQuery", "חיפוש במפה"]],
  providers: [["location", "מיקום"], ["area", "תחום"], ["features", "שירותים, מופרדים בפסיק"], ["image", "כתובת תמונה"], ["priceLabel", "תיאור מחיר"], ["phone", "טלפון"], ["sourceUrl", "אתר מקור"], ["sourceName", "שם המקור"]],
  attractions: [["location", "מיקום"], ["area", "סוג חוויה"], ["features", "מאפיינים, מופרדים בפסיק"], ["image", "כתובת תמונה"], ["priceLabel", "תיאור מחיר"], ["phone", "טלפון"], ["sourceUrl", "אתר מקור"], ["sourceName", "שם המקור"]],
  magazine: [["category", "קטגוריה"], ["image", "כתובת תמונה"], ["dateLabel", "תאריך תצוגה"], ["readTime", "דקות קריאה"], ["takeaway", "השורה התחתונה"], ["tags", "תגיות, מופרדות בפסיק"]],
};
const date = (value: string | null) => value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) : "לא עודכן";

export default function ContentStudioPage() {
  const [type, setType] = useState("spa"); const [locale, setLocale] = useState("he"); const [query, setQuery] = useState("");
  const [data, setData] = useState<Payload | null>(null); const [selected, setSelected] = useState<(Item & { versions: Version[] }) | null>(null);
  const [draft, setDraft] = useState<Content | null>(null); const [tab, setTab] = useState<"content" | "seo" | "links" | "preview" | "history">("content");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false); const [newTitle, setNewTitle] = useState(""); const [newKey, setNewKey] = useState("");
  const [scheduledAt, setScheduledAt] = useState(""); const [restoring, setRestoring] = useState(false);

  const load = useCallback(async (nextType = type, id = "") => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ type: nextType, locale }); if (query.trim()) params.set("q", query.trim()); if (id) params.set("id", id);
      const response = await fetch(`/api/admin/content-studio?${params}`, { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); return; }
      if (!response.ok) throw new Error("סטודיו התוכן אינו זמין כרגע.");
      const next = await response.json() as Payload; setForbidden(false); setData(next);
      if (next.selected) { setSelected(next.selected); setDraft(structuredClone(next.selected.draft)); setScheduledAt(next.selected.scheduledAt ? next.selected.scheduledAt.slice(0, 16) : ""); }
      else { setSelected(null); setDraft(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, [locale, query, type]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer); }, [load]);

  function clearInventory() { setData(null); setSelected(null); setDraft(null); setCreating(false); }

  const visible = useMemo(() => data?.items || [], [data]);
  const update = <K extends keyof Content>(key: K, value: Content[K]) => setDraft((current) => current ? { ...current, [key]: value } : current);
  async function save(status: string, action: string, content = draft) {
    if (!selected || !content) return; setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/content-studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, expectedVersion: selected.version, status, action, content, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error === "version_conflict" ? "מישהו שמר גרסה חדשה. רעננו לפני שמירה כדי לא לדרוס עבודה." : result.error === "invalid_content" ? "חסר תוכן חובה או שהכתובת אינה באנגלית תקינה." : "השמירה נכשלה בלי לאבד את הטקסט.");
      setMessage(status === "published" ? "הגרסה פורסמה. אפשר לפתוח את העמוד הציבורי לבדיקה." : status === "scheduled" ? "הגרסה נשמרה ותעלה אוטומטית במועד שנבחר." : status === "review" ? "הגרסה הועברה לאישור." : "הגרסה נשמרה ביומן."); setRestoring(false); await load(type, selected.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת שמירה"); }
    finally { setSaving(false); }
  }
  function restore(version: Version) { setDraft(structuredClone(version.content)); setRestoring(true); setTab("content"); setMessage(`גרסה ${version.version} נטענה לעורך. שמירה תיצור גרסה חדשה ולא תמחק היסטוריה.`); }
  function updateLink(index: number, key: keyof LinkItem, value: string | number | boolean) { if (!draft) return; update("links", draft.links.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  function updateAttribute(key: string, value: string) { if (!draft) return; update("attributes", { ...draft.attributes, [key]: value }); }
  async function createItem() {
    if (!newTitle.trim() || !newKey.trim()) return; setSaving(true); setError("");
    try {
      const response = await fetch("/api/admin/content-studio", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, locale, title: newTitle, key: newKey }) });
      const result = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error === "already_exists" ? "כבר קיים פריט עם הכתובת הזאת." : "לא ניתן ליצור את הפריט. בדקו שהכתובת באנגלית ובמקפים בלבד.");
      setCreating(false); setNewTitle(""); setNewKey(""); setMessage("הפריט נוצר כטיוטה ואינו מוצג לציבור."); await load(type, result.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת יצירה"); }
    finally { setSaving(false); }
  }

  if (forbidden) return <section className={styles.empty}><h1>נדרשת הרשאת מנהל</h1><p>תוכן ספקים וטיוטות אינם חשופים ללא הרשאה.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fcontent-studio">כניסה עם Google</a></section>;
  return <main className={styles.page}>
    <section className={styles.hero}><div><span className={styles.eyebrow}>VII CONTENT STUDIO</span><h1>כל התוכן. מקור אמת אחד.</h1><p>משווים למקור, עורכים את שכבת VII, מאשרים ורק אז מפרסמים.</p></div><div className={styles.heroStats}><span><strong>{data?.total || 0}</strong><small>פריטים בתחום</small></span><span><strong>{data?.items.filter((item) => item.status === "review").length || 0}</strong><small>ממתינים בתצוגה</small></span></div></section>
    <nav className={styles.toolbar} aria-label="תחומי תוכן">{types.map(([id, label]) => <button key={id} type="button" data-active={type === id} onClick={() => { clearInventory(); setType(id); setTab("content"); }}>{label}</button>)}<select aria-label="שפת תוכן" value={locale} onChange={(event) => { clearInventory(); setLocale(event.target.value); }}><option value="he">עברית</option><option value="en">English</option><option value="ru">Русский</option><option value="fr">Français</option></select></nav>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <section className={styles.workspace}>
      <aside className={styles.inventory}><div className={styles.inventoryHeader}><input value={query} onChange={(event) => { clearInventory(); setQuery(event.target.value); }} placeholder="חיפוש בשם או במזהה" />{["providers", "attractions", "trails", "magazine"].includes(type) ? <button className={extras.createButton} type="button" onClick={() => setCreating((value) => !value)}>יצירת פריט חדש</button> : null}{creating ? <div className={extras.createPanel}><input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="שם הפריט" /><input dir="ltr" value={newKey} onChange={(event) => setNewKey(event.target.value.toLowerCase())} placeholder="english-slug" /><button type="button" disabled={saving} onClick={() => void createItem()}>יצירת טיוטה</button></div> : null}</div>{loading && !data ? <p className={styles.loading}>טוענים את מקור התוכן...</p> : visible.length ? visible.map((item) => <button className={styles.item} data-active={selected?.id === item.id} key={item.id} type="button" onClick={() => void load(type, item.id)}><strong>{item.draft.title}</strong><span>{item.sourceLabel}</span><small>{item.entityKey} · גרסה {item.version}</small><span className={styles.status}>{statusLabel[item.status]}</span></button>) : <div className={styles.empty}><strong>אין פריטים מתאימים</strong><p>אפשר להחליף תחום או לנקות את החיפוש.</p></div>}</aside>
      <article className={styles.editor}>{loading && selected ? <p className={styles.loading}>פותחים את הגרסה...</p> : selected && draft ? <>
        <header className={styles.editorHead}><div><span className={styles.eyebrow}>{types.find(([id]) => id === selected.contentType)?.[1]}</span><h2>{draft.title}</h2><p>{statusLabel[selected.status]} · גרסה {selected.version} · {date(selected.updatedAt)}</p></div><a href={selected.publicPath} target="_blank" rel="noopener noreferrer">פתיחת העמוד הציבורי</a></header>
        <details className={styles.source}><summary>הצגת המקור: {selected.sourceLabel}</summary><div><strong>{selected.source.title}</strong>{"\n"}{selected.source.summary}{selected.source.body ? `\n\n${selected.source.body}` : ""}</div></details>
        <nav className={styles.tabs} aria-label="כלי עריכה"><button data-active={tab === "content"} onClick={() => setTab("content")}>תוכן</button><button data-active={tab === "seo"} onClick={() => setTab("seo")}>SEO</button>{["navigation", "footer"].includes(selected.contentType) ? <button data-active={tab === "links"} onClick={() => setTab("links")}>קישורים</button> : null}<button data-active={tab === "preview"} onClick={() => setTab("preview")}>תצוגה מקדימה</button><button data-active={tab === "history"} onClick={() => setTab("history")}>היסטוריה</button></nav>
        {tab === "content" ? <div className={styles.form}><label className={styles.field}><span>כותרת</span><input value={draft.title} onChange={(event) => update("title", event.target.value)} /></label><label className={styles.field}><span>טקסט קצר לכרטיס</span><textarea value={draft.summary} onChange={(event) => update("summary", event.target.value)} /></label><label className={`${styles.field} ${styles.wide}`}><span>תוכן מלא</span><textarea value={draft.body} onChange={(event) => update("body", event.target.value)} rows={12} /></label><label className={`${styles.field} ${styles.wide}`}><span>תיאור תמונה חלופי</span><input value={draft.imageAlt} onChange={(event) => update("imageAlt", event.target.value)} /></label>{(attributeFields[selected.contentType] || []).map(([key, label]) => <label className={styles.field} key={key}><span>{label}</span><input dir={["officialSource", "sourceUrl", "image"].includes(key) ? "ltr" : undefined} value={draft.attributes[key] || ""} onChange={(event) => updateAttribute(key, event.target.value)} /></label>)}</div> : null}
        {tab === "seo" ? <div className={styles.form}><label className={styles.field}><span>כותרת SEO</span><input value={draft.metaTitle} onChange={(event) => update("metaTitle", event.target.value)} /></label><label className={styles.field}><span>כתובת באנגלית</span><input dir="ltr" value={draft.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} /></label><label className={`${styles.field} ${styles.wide}`}><span>תיאור מטא</span><textarea value={draft.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={draft.indexable} onChange={(event) => update("indexable", event.target.checked)} /> פתוח לאינדוקס לאחר פרסום</label></div> : null}
        {tab === "links" ? <div className={styles.links}>{draft.links.map((item, index) => <div className={styles.linkRow} key={item.id}><input aria-label="תווית" value={item.label} onChange={(event) => updateLink(index, "label", event.target.value)} /><input aria-label="כתובת" dir="ltr" value={item.href} onChange={(event) => updateLink(index, "href", event.target.value)} /><input aria-label="קבוצה" value={item.group} onChange={(event) => updateLink(index, "group", event.target.value)} /><input aria-label="סדר" type="number" value={item.order} onChange={(event) => updateLink(index, "order", Number(event.target.value))} /><button className={styles.remove} type="button" onClick={() => update("links", draft.links.filter((_, itemIndex) => itemIndex !== index))}>הסרה</button><div className={extras.linkFlags}><label><input type="checkbox" checked={item.visible} onChange={(event) => updateLink(index, "visible", event.target.checked)} /> מוצג באתר</label><label><input type="checkbox" checked={item.newWindow} onChange={(event) => updateLink(index, "newWindow", event.target.checked)} /> פתיחה בחלון חדש</label></div></div>)}<button className={styles.add} type="button" onClick={() => update("links", [...draft.links, { id: `link-${Date.now()}`, label: "קישור חדש", href: "/", group: "כללי", order: draft.links.length + 1, visible: true, newWindow: false }])}>הוספת קישור</button></div> : null}
        {tab === "preview" ? <section className={styles.preview}><small>תצוגה מקדימה של הגרסה הנוכחית, לפני פרסום</small><h3>{draft.title}</h3><p>{draft.summary}</p>{draft.body ? <p>{draft.body}</p> : null}{draft.links.length ? <nav>{draft.links.filter((item) => item.visible).map((item) => <a key={item.id} href={item.href} onClick={(event) => event.preventDefault()}>{item.label}</a>)}</nav> : null}</section> : null}
        {tab === "history" ? <div className={styles.history}>{selected.versions.length ? selected.versions.map((version) => <div className={styles.version} key={version.version}><div><strong>גרסה {version.version} · {statusLabel[version.status]}</strong><small>{date(version.createdAt)} · {version.createdBy}</small></div><button type="button" onClick={() => restore(version)}>טעינה לעורך</button></div>) : <p>עדיין אין גרסאות שמורות.</p>}</div> : null}
        <footer className={styles.actions}><button disabled={saving} onClick={() => void save("draft", restoring ? "restore" : "save")}>{restoring ? "שמירת שחזור כגרסה חדשה" : "שמירת טיוטה"}</button><button disabled={saving} onClick={() => void save("review", "review")}>העברה לאישור</button><label className={extras.schedule}><span>מועד פרסום</span><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label><button disabled={saving || !scheduledAt} onClick={() => void save("scheduled", "schedule")}>תזמון</button><button className={styles.primary} disabled={saving} onClick={() => void save("published", "publish")}>{saving ? "שומרים..." : "פרסום"}</button><button disabled={saving} onClick={() => void save("archived", "archive")}>העברה לארכיון</button>{message ? <span className={styles.message} role="status">{message}</span> : null}</footer>
      </> : <div className={styles.empty}><h2>בחרו פריט לעריכה</h2><p>המקור והשכבה של VII יוצגו זה לצד זה, בלי לדרוס נתוני ספק.</p></div>}</article>
    </section>
  </main>;
}
