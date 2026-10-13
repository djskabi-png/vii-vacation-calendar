"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";

type Item = { path: string; title: string; world: string; location: string; searches: number; status: "needs_review" | "draft" | "scheduled" };
const names: Record<string, string> = { events: "אירועים", hourly: "חדרים לפי שעה", spa: "ספא" };

export default function ContentQueuePage() {
  const [items, setItems] = useState<Item[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [forbidden, setForbidden] = useState(false);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch("/api/admin/content-queue", { cache: "no-store" }); if (response.status === 403) { setForbidden(true); return; } if (!response.ok) throw new Error("תור התוכן אינו זמין כרגע."); setForbidden(false); setItems((await response.json() as { queue: Item[] }).queue); } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <main dir="rtl" style={{ maxWidth: 1040, margin: "auto", padding: "32px 20px", fontFamily: "Heebo,Assistant,Arial,sans-serif", color: "#18312e" }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}><div><p style={{ color: "#087b82", fontSize: ".78rem", fontWeight: 700 }}>קידום ותוכן</p><h1 style={{ margin: 0 }}>עמודים שממתינים לבדיקה</h1><p style={{ color: "#55706a" }}>הצעות מתוך חיפושים אמיתיים ב־30 הימים האחרונים, ללא חשבונות מנהל או רובוטים. אישור אינו אוטומטי: בודקים שהעמוד, התוכן והמידע על הספקים נכונים.</p></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="רענון התור" title="רענון"><RefreshCw size={18} /></button></header>
    {forbidden ? <p>יש להיכנס עם חשבון מנהל מורשה.</p> : null}{error ? <p role="alert">{error}</p> : null}{loading ? <p role="status">טוענים אותות חיפוש...</p> : null}
    {!loading && !forbidden && !error ? <section style={{ marginTop: 26, background: "#fff", border: "1px solid #dce6e2", borderRadius: 8, overflow: "hidden" }}><div style={{ padding: "15px 18px", borderBottom: "1px solid #e7efeb" }}><strong>{items.length} עמודים לבדיקה</strong><small style={{ display: "block", color: "#647872", marginTop: 4 }}>רק עמודים עם אות חיפוש ודף נחיתה קיים ב־VII מופיעים כאן.</small></div>{items.length ? items.map((item) => <article key={`${item.path}-${item.location}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "15px 18px", borderBottom: "1px solid #eef2f0", flexWrap: "wrap" }}><div><strong>{item.title}</strong><small style={{ display: "block", color: "#647872", marginTop: 4 }}>{names[item.world] || item.world} · {item.location} · {item.searches} חיפושים מתועדים</small><small dir="ltr" style={{ color: "#728681" }}>{item.path}</small></div><a href={`/admin/search-pages?path=${encodeURIComponent(item.path)}`} style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "#087b82", fontWeight: 700 }}>לבדיקה ועריכה <ArrowLeft size={16} /></a></article>) : <p style={{ padding: 18 }}>אין כרגע עמודים חדשים שמחכים לבדיקה. נתוני חיפוש יופיעו כאן לאחר הסכמה למדידה.</p>}</section> : null}
  </main>;
}
