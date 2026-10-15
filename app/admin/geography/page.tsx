"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudDownload, LocateFixed, MapPinned, RefreshCw, Save, Search } from "lucide-react";
import styles from "./geography.module.css";

type NodeLevel = "district" | "area" | "city";
type GeographyNode = {
  key: string; level: NodeLevel; supplierId: number; parentKey: string | null;
  title: string; titleEn: string; effectiveTitle: string; effectiveTitleEn: string;
  titleOverride: string; titleEnOverride: string; slug: string; visible: boolean; featured: boolean;
  gpsLat: number | null; gpsLong: number | null; unassigned: boolean; version: number; updatedAt: string; updatedBy: string;
};

const levelNames: Record<NodeLevel, string> = { district: "מחוז", area: "אזור", city: "עיר או יישוב" };

export default function GeographyAdminPage() {
  const [nodes, setNodes] = useState<GeographyNode[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<NodeLevel | "all">("all");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"refresh" | "save" | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [draft, setDraft] = useState<GeographyNode | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/geography", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "אין הרשאה למערכת הזאת." : "לא הצלחנו לטעון את נתוני האזורים.");
      const payload = await response.json() as { nodes?: GeographyNode[] };
      const next = Array.isArray(payload.nodes) ? payload.nodes : [];
      setNodes(next);
      const key = next.some((node) => node.key === selectedKey) ? selectedKey : next[0]?.key || "";
      setSelectedKey(key);
      setDraft(next.find((node) => node.key === key) || null);
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "הטעינה נכשלה." }); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("he");
    return nodes.filter((node) => (level === "all" || node.level === level)
      && (!term || [node.effectiveTitle, node.effectiveTitleEn, node.title, node.key, node.slug].some((value) => value.toLocaleLowerCase("he").includes(term))));
  }, [level, nodes, query]);

  function choose(node: GeographyNode) { setSelectedKey(node.key); setDraft({ ...node }); setMessage(null); }

  async function post(body: unknown) {
    const response = await fetch("/api/admin/geography", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as { error?: string; nodes?: GeographyNode[]; node?: GeographyNode; imported?: number };
    if (!response.ok) throw new Error(payload.error === "version_conflict" ? "הנתון השתנה מאז שפתחת אותו. טענו מחדש ונסו שוב." : "הפעולה נכשלה. בדקו את החיבור ונסו שוב.");
    return payload;
  }

  async function refresh() {
    if (working) return;
    setWorking("refresh"); setMessage(null);
    try {
      const payload = await post({ action: "refresh" });
      setNodes(payload.nodes || []);
      const next = (payload.nodes || []).find((node) => node.key === selectedKey) || payload.nodes?.[0] || null;
      setSelectedKey(next?.key || ""); setDraft(next);
      setMessage({ kind: "success", text: `${payload.imported || 0} מחוזות, אזורים ויישובים נמשכו מה־API. שינויים ידניים נשמרו.` });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "הרענון נכשל." }); }
    finally { setWorking(null); }
  }

  async function save() {
    if (!draft || working) return;
    setWorking("save"); setMessage(null);
    try {
      const payload = await post({ action: "save", node: { key: draft.key, titleOverride: draft.titleOverride,
        titleEnOverride: draft.titleEnOverride, slug: draft.slug, visible: draft.visible, featured: draft.featured,
        gpsLat: draft.gpsLat, gpsLong: draft.gpsLong, expectedVersion: draft.version } });
      if (!payload.node) throw new Error("השמירה לא הושלמה.");
      setNodes((current) => current.map((node) => node.key === payload.node?.key ? payload.node : node));
      setDraft(payload.node); setMessage({ kind: "success", text: "השינויים נשמרו ויופיעו בחיפוש הציבורי בתוך דקות ספורות." });
    } catch (error) { setMessage({ kind: "error", text: error instanceof Error ? error.message : "השמירה נכשלה." }); }
    finally { setWorking(null); }
  }

  const counts = Object.fromEntries((["district", "area", "city"] as NodeLevel[]).map((item) => [item, nodes.filter((node) => node.level === item).length]));
  const parent = draft?.parentKey ? nodes.find((node) => node.key === draft.parentKey) : null;

  return <main className={styles.page} dir="rtl">
    <header className={styles.hero}><div><span>מפת התוכן של VII</span><h1>ערים, אזורים ומחוזות</h1><p>מקור אמת אחד לנתוני ה־API, לחיפוש, למפות ולדפי הקידום. אפשר לכפות שם, כתובת ונראות בלי לאבד את נתוני הספק.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={Boolean(working)} aria-busy={working === "refresh"}><RefreshCw className={working === "refresh" ? styles.spin : ""} size={18} />{working === "refresh" ? "מושכים נתונים..." : "רענון מה־API"}</button></header>
    {message ? <p className={message.kind === "success" ? styles.success : styles.error} role={message.kind === "error" ? "alert" : "status"}>{message.kind === "success" ? <CheckCircle2 size={18} /> : null}{message.text}</p> : null}
    <section className={styles.metrics} aria-label="סיכום נתוני אזורים">
      <article><MapPinned size={19} /><span>מחוזות</span><strong>{counts.district || 0}</strong></article>
      <article><LocateFixed size={19} /><span>אזורים</span><strong>{counts.area || 0}</strong></article>
      <article><CloudDownload size={19} /><span>ערים ויישובים</span><strong>{counts.city || 0}</strong></article>
      <article><LocateFixed size={19} /><span>עם נקודת מפה</span><strong>{nodes.filter((node) => node.level === "city" && node.gpsLat !== null && node.gpsLong !== null).length}</strong></article>
    </section>
    <section className={styles.controlCenter}>
      <aside className={styles.listPane}><div className={styles.filters}><label><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש עיר או אזור" /></label><div>{(["all", "district", "area", "city"] as const).map((item) => <button type="button" key={item} aria-pressed={level === item} onClick={() => setLevel(item)}>{item === "all" ? "הכול" : levelNames[item]}</button>)}</div></div>
        <p className={styles.identityNote}>מזהי ספק נשמרים לפי רמה. לכן עיר ואזור יכולים לקבל אותו מספר בלי להתנגש.</p>
        <div className={styles.nodeList}>{loading ? <p>טוענים את מפת האזורים...</p> : filtered.length ? filtered.map((node) => <button type="button" key={node.key} className={selectedKey === node.key ? styles.selected : ""} onClick={() => choose(node)}><span><b>{levelNames[node.level]}</b>{node.unassigned ? <em>ללא שיוך</em> : null}</span><strong>{node.effectiveTitle}</strong><small dir="ltr">{node.key}{node.slug ? ` · /${node.slug}` : ""}</small></button>) : <div className={styles.empty}><MapPinned size={28} /><strong>{nodes.length ? "לא נמצאו נתונים במסנן" : "עדיין לא נמשכו נתוני אזורים"}</strong><p>{nodes.length ? "שנו את החיפוש או המסנן." : "לחצו על רענון מה־API כדי להתחיל."}</p></div>}</div>
      </aside>
      <div className={styles.editor}>{draft ? <>
        <header><div><span>{levelNames[draft.level]} · מזהה ספק {draft.supplierId}</span><h2>{draft.effectiveTitle}</h2><p>{parent ? `משויך אל ${parent.effectiveTitle}` : draft.unassigned ? "ממתין לשיוך ידני" : "רמה עליונה"}</p></div><span className={draft.visible ? styles.live : styles.hidden}>{draft.visible ? "מוצג באתר" : "מוסתר"}</span></header>
        <section className={styles.source}><h3>נתוני המקור</h3><dl><div><dt>שם בעברית</dt><dd>{draft.title}</dd></div><div><dt>שם באנגלית</dt><dd dir="ltr">{draft.titleEn || "לא התקבל"}</dd></div><div><dt>מזהה ייחודי במערכת</dt><dd dir="ltr">{draft.key}</dd></div><div><dt>עודכן לאחרונה</dt><dd>{new Date(draft.updatedAt).toLocaleString("he-IL")}</dd></div></dl></section>
        <section className={styles.form}><h3>שליטה ידנית</h3><p>שדה ריק משתמש אוטומטית בערך החדש שיגיע מהספק.</p>
          <label><span>שם חלופי בעברית</span><input value={draft.titleOverride} onChange={(event) => setDraft({ ...draft, titleOverride: event.target.value })} placeholder={draft.title} /></label>
          <label><span>שם חלופי באנגלית</span><input dir="ltr" value={draft.titleEnOverride} onChange={(event) => setDraft({ ...draft, titleEnOverride: event.target.value })} placeholder={draft.titleEn || "English title"} /></label>
          <label><span>כתובת URL באנגלית</span><input dir="ltr" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="netanya-and-sharon" /></label>
          {draft.level === "city" ? <div className={styles.coordinates}><label><span>קו רוחב</span><input dir="ltr" inputMode="decimal" value={draft.gpsLat ?? ""} onChange={(event) => setDraft({ ...draft, gpsLat: event.target.value === "" ? null : Number(event.target.value) })} /></label><label><span>קו אורך</span><input dir="ltr" inputMode="decimal" value={draft.gpsLong ?? ""} onChange={(event) => setDraft({ ...draft, gpsLong: event.target.value === "" ? null : Number(event.target.value) })} /></label></div> : null}
          <div className={styles.toggles}><label><input type="checkbox" checked={draft.visible} onChange={(event) => setDraft({ ...draft, visible: event.target.checked })} /><span><b>מוצג באתר</b><small>מופיע באפשרויות החיפוש הציבוריות</small></span></label><label><input type="checkbox" checked={draft.featured} onChange={(event) => setDraft({ ...draft, featured: event.target.checked })} /><span><b>יעד מוביל</b><small>מקודם בתחילת רשימת היעדים</small></span></label></div>
        </section>
        <footer><span>גרסה {draft.version} · השינויים נשמרים עם היסטוריה מלאה</span><button type="button" onClick={() => void save()} disabled={Boolean(working)} aria-busy={working === "save"}><Save size={17} />{working === "save" ? "שומרים..." : "שמירת שינויים"}</button></footer>
      </> : <div className={styles.blank}><MapPinned size={38} /><h2>בחרו עיר או אזור לעריכה</h2><p>אפשר לשמור שם חלופי, כתובת באנגלית, נראות וקואורדינטות.</p></div>}</div>
    </section>
  </main>;
}
