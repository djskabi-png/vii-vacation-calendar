"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, BarChart3, Clock3, Eye, MessageCircle, MousePointerClick, Phone, RefreshCw, Search, ShoppingBag, Star, Users } from "lucide-react";
import { businessReportScopes, canonicalBusinessReportScope } from "../../lib/business-report-scopes";
import styles from "./business-performance.module.css";

type Row = { placeId: string; placeName: string; world: string; impressions: number; pageViews: number; phoneReveals: number; phoneClicks: number; whatsappLeads: number; whatsappHandoffs: number; bookingRequests: number; viiBookings: number; reviews: number; uniqueBrowsers: number };
type ConversionBucket = { contacts: number; identified: number; converted: number; rate: number | null; customers: number; orders: number; revenue: number; medianDelay: number | null };
type Conversions = { siteID: number; from: string; till: string; created: string; count: number; summary: Record<"all" | "whatsapp" | "maskyoo" | "form", ConversionBucket>; clicks: { whatsapp: number; showphone: number; phone: number } };
type SortKey = "pageViews" | "impressions" | "actions" | "entryRate" | "actionRate";

const worldLabels: Record<string, string> = { vacation: "נופש", vacations: "נופש", events: "אירועים", event: "אירועים", rooms: "חדרים לפי שעה", hourly: "חדרים לפי שעה", room: "חדרים לפי שעה", spa: "ספא", activities: "אטרקציות", attractions: "אטרקציות", trails: "טיולים", providers: "ספקים" };
const scopeLabels: Record<(typeof businessReportScopes)[number], string> = { all: "כל העסקים", vacations: "כל הנופש", events: "כל האירועים", spa: "כל הספא", rooms: "כל החדרים לפי שעה", activities: "כל האטרקציות", trails: "כל הטיולים", providers: "כל הספקים" };
const sourceLabels = { whatsapp: "WhatsApp", maskyoo: "שיחות מסקיו", form: "טופס באתר" } as const;
const num = (value: number) => value.toLocaleString("he-IL");
const money = (value: number) => `${num(value)} ₪`;
const percent = (part: number, whole: number) => whole ? Math.round(part / whole * 100) : 0;
const actions = (row: Row) => row.phoneClicks + row.whatsappHandoffs + row.bookingRequests;
const isoDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
const conversionSupported = (row: Row) => /^(vacation|event|events|hourly|room|rooms)-\d+$/.test(row.placeId) && ["vacation", "vacations", "events", "hourly", "room", "rooms"].includes(row.world);

function delay(seconds: number | null) {
  if (seconds === null) return "אין עדיין";
  if (seconds < 3600) return `${Math.round(seconds / 60)} דקות`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} שעות`;
  return `${Math.round(seconds / 86400)} ימים`;
}

export default function BusinessPerformance() {
  const today = isoDay(new Date());
  const monthAgo = (() => { const value = new Date(); value.setDate(value.getDate() - 29); return isoDay(value); })();
  const [from, setFrom] = useState(monthAgo);
  const [till, setTill] = useState(today);
  const [basis, setBasis] = useState<"created" | "arrival">("created");
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState("all");
  const [sort, setSort] = useState<SortKey>("pageViews");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [conversions, setConversions] = useState<Conversions | null>(null);
  const [conversionError, setConversionError] = useState("");
  const [conversionLoading, setConversionLoading] = useState(false);
  const conversionRequest = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/business-performance?from=${from}&till=${till}&basis=${basis}`, { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); return; }
      if (!response.ok) throw new Error("נתוני הביצועים עדיין אינם זמינים.");
      const next = (await response.json() as { rows: Row[] }).rows;
      setForbidden(false); setRows(next);
      setSelectedPlaceId((current) => current && next.some((row) => row.placeId === current && conversionSupported(row)) ? current : next.find(conversionSupported)?.placeId || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, [from, till, basis]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const supportedRows = useMemo(() => rows.filter(conversionSupported).sort((a, b) => a.placeName.localeCompare(b.placeName, "he")), [rows]);
  const conversionRows = useMemo(() => supportedRows.filter((row) => world === "all" || canonicalBusinessReportScope(row.world) === world), [supportedRows, world]);
  const selectedRow = conversionRows.find((row) => row.placeId === selectedPlaceId) || null;
  useEffect(() => {
    if (!conversionRows.some((row) => row.placeId === selectedPlaceId)) setSelectedPlaceId(conversionRows[0]?.placeId || "");
  }, [conversionRows, selectedPlaceId]);

  const loadConversions = useCallback(async () => {
    if (!selectedRow) { setConversions(null); setConversionError(""); setConversionLoading(false); return; }
    conversionRequest.current?.abort();
    const controller = new AbortController(); conversionRequest.current = controller;
    setConversionLoading(true); setConversionError("");
    const params = new URLSearchParams({ mode: "conversions", placeId: selectedRow.placeId, world: selectedRow.world, from, till });
    try {
      const response = await fetch(`/api/admin/business-performance?${params}`, { cache: "no-store", signal: controller.signal });
      const payload = await response.json().catch(() => ({})) as { conversions?: Conversions; error?: string };
      if (!response.ok) {
        const message = payload.error === "not_supported" || payload.error === "conversion_not_supported" ? "דוח ההמרות אינו זמין לעסק הזה."
          : payload.error === "supplier_unavailable" ? "מקור ההמרות אינו זמין כרגע. הנתונים הקודמים אינם מוצגים כאילו הם עדכניים."
          : "לא הצלחנו לטעון את דוח ההמרות.";
        throw new Error(message);
      }
      if (!payload.conversions) throw new Error("התקבלה תשובה חסרה ממקור ההמרות.");
      setConversions(payload.conversions);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setConversions(null); setConversionError(cause instanceof Error ? cause.message : "שגיאת טעינה");
    } finally { if (!controller.signal.aborted) setConversionLoading(false); }
  }, [from, till, selectedRow]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversions(), 0);
    return () => { window.clearTimeout(timer); conversionRequest.current?.abort(); };
  }, [loadConversions]);
  const filtered = useMemo(() => rows.filter((row) => (world === "all" || canonicalBusinessReportScope(row.world) === world) && (!query.trim() || `${row.placeName} ${worldLabels[row.world] || row.world}`.toLocaleLowerCase("he").includes(query.trim().toLocaleLowerCase("he")))).sort((a, b) => {
    const value = (row: Row) => sort === "actions" ? actions(row) : sort === "entryRate" ? percent(row.pageViews, row.impressions) : sort === "actionRate" ? percent(actions(row), row.pageViews) : row[sort]; return value(b) - value(a);
  }), [rows, query, world, sort]);
  const totals = useMemo(() => filtered.reduce((sum, row) => ({ impressions: sum.impressions + row.impressions, pageViews: sum.pageViews + row.pageViews, uniqueBrowsers: sum.uniqueBrowsers + row.uniqueBrowsers, phoneReveals: sum.phoneReveals + row.phoneReveals, phoneClicks: sum.phoneClicks + row.phoneClicks, whatsappLeads: sum.whatsappLeads + row.whatsappLeads, whatsappHandoffs: sum.whatsappHandoffs + row.whatsappHandoffs, bookingRequests: sum.bookingRequests + row.bookingRequests, viiBookings: sum.viiBookings + row.viiBookings, reviews: sum.reviews + row.reviews }), { impressions: 0, pageViews: 0, uniqueBrowsers: 0, phoneReveals: 0, phoneClicks: 0, whatsappLeads: 0, whatsappHandoffs: 0, bookingRequests: 0, viiBookings: 0, reviews: 0 }), [filtered]);
  const totalActions = totals.phoneClicks + totals.whatsappHandoffs + totals.bookingRequests;
  function exportCsv() {
    const header = ["עסק", "עולם", "חשיפות", "כניסות", "דפדפנים ייחודיים", "חשיפות טלפון", "לחיצות טלפון", "לידי WhatsApp", "מעברים ל-WhatsApp", "בקשות הזמנה", "הזמנות מ-VII", "הזמנות מ-Biz", "חוות דעת", "כניסה מתוך חשיפה", "פעולה מתוך כניסה"];
    const lines = filtered.map((row) => [row.placeName, worldLabels[row.world] || row.world, row.impressions, row.pageViews, row.uniqueBrowsers, row.phoneReveals, row.phoneClicks, row.whatsappLeads, row.whatsappHandoffs, row.bookingRequests, row.viiBookings, row.placeId === selectedPlaceId && conversions ? conversions.summary.all.orders : "", row.reviews, `${percent(row.pageViews, row.impressions)}%`, `${percent(actions(row), row.pageViews)}%`]);
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })); link.download = `vii-business-performance-${from}-${till}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <main className={styles.page} dir="rtl">
    <header className={styles.header}><div><span>מדידה וביצועים</span><h1>ביצועי עסקים</h1><p>משפך החשיפה של VII לצד פניות והזמנות שאומתו במערכת הספק. נתוני האתר אינם מציגים פתיחת WhatsApp כשיחה שנשלחה, ופתיחת טלפון או WhatsApp אינה נספרת כהזמנה.</p></div><div className={styles.headerActions}><button type="button" onClick={exportCsv} disabled={!filtered.length}><ArrowDownToLine size={16} /> ייצוא CSV</button><button type="button" className={styles.iconButton} onClick={() => void load()} disabled={loading} aria-label="רענון"><RefreshCw size={17} className={loading ? styles.spin : ""} /></button></div></header>
    <section className={styles.funnel} aria-label="סיכום משפך"><article><span><Eye size={17} /> חשיפות</span><strong>{num(totals.impressions)}</strong><small>הופעות כרטיסי עסק</small></article><i aria-hidden="true">←</i><article><span><MousePointerClick size={17} /> כניסות</span><strong>{num(totals.pageViews)}</strong><small>{percent(totals.pageViews, totals.impressions)}% מהחשיפות</small></article><i aria-hidden="true">←</i><article><span><BarChart3 size={17} /> פעולות</span><strong>{num(totalActions)}</strong><small>{percent(totalActions, totals.pageViews)}% מהכניסות</small></article><i aria-hidden="true">←</i><article className={styles.funnelAccent}><span><ShoppingBag size={17} /> הזמנות מ־VII</span><strong>{num(totals.viiBookings)}</strong><small>הזמנות שנשמרו במערכת</small></article></section>
    <section className={styles.breakdown} aria-label="פירוט פעולות"><div><Users size={16} /><span>דפדפנים ייחודיים</span><strong>{num(totals.uniqueBrowsers)}</strong></div><div><Phone size={16} /><span>לחיצות על טלפון</span><strong>{num(totals.phoneClicks)}</strong></div><div><MessageCircle size={16} /><span>מעברים ל־WhatsApp</span><strong>{num(totals.whatsappHandoffs)}</strong></div><div><Star size={16} /><span>חוות דעת</span><strong>{num(totals.reviews)}</strong></div></section>
    <section className={styles.toolbar} aria-label="סינון הדוח"><label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש עסק" /></label><label><span>משפחת עסקים</span><select value={world} onChange={(event) => setWorld(event.target.value)}>{businessReportScopes.map((value) => <option key={value} value={value}>{scopeLabels[value]}</option>)}</select></label><label><span>חיתוך</span><select value={basis} onChange={(event) => setBasis(event.target.value as "created" | "arrival")}><option value="created">תאריך פתיחת פנייה</option><option value="arrival">תאריך הגעה</option></select></label><label><span>מתאריך</span><input type="date" value={from} max={till} onChange={(event) => setFrom(event.target.value)} /></label><label><span>עד תאריך</span><input type="date" value={till} min={from} max={today} onChange={(event) => setTill(event.target.value)} /></label><label><span>מיון</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="pageViews">כניסות</option><option value="impressions">חשיפות</option><option value="actions">פעולות</option><option value="entryRate">יחס כניסה</option><option value="actionRate">יחס פעולה</option></select></label></section>
    {forbidden ? <section className={styles.state}><h2>נדרשת הרשאת מנהל</h2><p>הדוח אינו חושף מידע למשתמשים שאינם מורשים.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fbusiness-performance">כניסה עם Google</a></section> : null}
    {error ? <section className={styles.state} role="alert"><h2>לא הצלחנו לטעון את הדוח</h2><p>{error}</p><button type="button" onClick={() => void load()}>ניסיון חוזר</button></section> : null}
    {loading && !rows.length ? <section className={styles.state} role="status"><RefreshCw className={styles.spin} /><p>טוענים את משפך הביצועים...</p></section> : null}
    {!loading && !forbidden && !error ? <>
      <section className={styles.conversions} aria-labelledby="conversions-title" aria-busy={conversionLoading}><header><div><span>פניות שהפכו להזמנות</span><h2 id="conversions-title">המרות מאומתות לפי עסק</h2><p>הדוח מחבר WhatsApp, שיחות מסקיו וטפסים להזמנה הראשונה של אותו לקוח באותו עסק. פרטי הלקוחות נשארים בשרת.</p></div><label><span>עסק</span><select value={selectedPlaceId} onChange={(event) => setSelectedPlaceId(event.target.value)} disabled={!conversionRows.length}>{conversionRows.length ? conversionRows.map((row) => <option key={`${row.world}:${row.placeId}`} value={row.placeId}>{row.placeName} · {worldLabels[row.world] || row.world}</option>) : <option value="">אין עסקים נתמכים בתחום הזה</option>}</select></label></header>
        {conversionLoading ? <div className={styles.conversionState} role="status"><RefreshCw className={styles.spin} /><p>טוענים פניות והזמנות ממקור הספק...</p></div> : null}
        {conversionError ? <div className={styles.conversionState} role="alert"><p>{conversionError}</p><button type="button" onClick={() => void loadConversions()}>ניסיון חוזר</button></div> : null}
        {!conversionRows.length ? <div className={styles.conversionState}><p>נתוני VII של המשפחה מוצגים בדוח למטה. מקור ההמרות של Biz תומך כרגע בנופש, אירועים וחדרים לפי שעה בלבד.</p></div> : null}
        {!conversionLoading && !conversionError && conversions ? <><div className={styles.conversionTotals}><article><span>פניות</span><strong>{num(conversions.summary.all.contacts)}</strong><small>{num(conversions.summary.all.identified)} ניתנות לזיהוי</small></article><article><span>הומרו להזמנה</span><strong>{num(conversions.summary.all.converted)}</strong><small>{conversions.summary.all.rate === null ? "אין בסיס לחישוב" : `${conversions.summary.all.rate.toLocaleString("he-IL")}% מהפניות`}</small></article><article><span>הזמנות מ־Biz</span><strong>{num(conversions.summary.all.orders)}</strong><small>{num(conversions.summary.all.customers)} לקוחות</small></article><article><span>הכנסה להזמנות</span><strong>{money(conversions.summary.all.revenue)}</strong><small>ללא ספירה כפולה</small></article><article><span><Clock3 size={15} /> זמן המרה חציוני</span><strong>{delay(conversions.summary.all.medianDelay)}</strong><small>{conversions.from} עד {conversions.till}</small></article></div><div className={styles.sourceTable}><table><thead><tr><th>מקור</th><th>פניות</th><th>הומרו</th><th>שיעור</th><th>הזמנות</th><th>הכנסה</th><th>זמן חציוני</th></tr></thead><tbody>{(["whatsapp", "maskyoo", "form"] as const).map((source) => { const item = conversions.summary[source]; return <tr key={source}><td data-label="מקור"><strong>{sourceLabels[source]}</strong></td><td data-label="פניות">{num(item.contacts)}</td><td data-label="הומרו">{num(item.converted)}</td><td data-label="שיעור">{item.rate === null ? "—" : `${item.rate.toLocaleString("he-IL")}%`}</td><td data-label="הזמנות">{num(item.orders)}</td><td data-label="הכנסה">{money(item.revenue)}</td><td data-label="זמן חציוני">{delay(item.medianDelay)}</td></tr>; })}</tbody></table></div><footer>עודכן אצל הספק: <time dateTime={conversions.created}>{new Date(conversions.created).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</time>. לחיצות שאינן פנייה מזוהה מוצגות רק כמדד עניין. נתון Biz נטען לפי העסק שנבחר, כדי לא לבצע מאות בקשות ספק בכל פתיחת דוח.</footer></> : null}
      </section>
      <section className={styles.tableCard}><header><div><h2>עסקים לפי ביצועים</h2><p>{filtered.length} עסקים בתקופה ובמסננים שנבחרו</p></div><small>{basis === "arrival" ? "חיתוך לפי תאריך הגעה: רק להזמנות שבהן נשמר תאריך הגעה" : "חיתוך לפי זמן יצירת הפעולה"} · אזור זמן ישראל</small></header>{filtered.length ? <div className={styles.tableWrap}><table><thead><tr>{["עסק", "תחום", "חשיפות", "כניסות", "ייחודיים", "חשיפת טלפון", "לחיצת טלפון", "ליד WhatsApp", "מעבר WhatsApp", "בקשות", "הזמנות מ־VII", "הזמנות מ־Biz", "חוות דעת", "כניסה / חשיפה", "פעולה / כניסה"].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={`${row.world}:${row.placeId}`}><td data-label="עסק"><strong>{row.placeName}</strong><code dir="ltr">{row.placeId}</code></td><td data-label="תחום"><span className={styles.world}>{worldLabels[row.world] || row.world}</span></td><td data-label="חשיפות">{num(row.impressions)}</td><td data-label="כניסות"><b>{num(row.pageViews)}</b></td><td data-label="ייחודיים">{num(row.uniqueBrowsers)}</td><td data-label="חשיפת טלפון">{num(row.phoneReveals)}</td><td data-label="לחיצת טלפון">{num(row.phoneClicks)}</td><td data-label="ליד WhatsApp">{num(row.whatsappLeads)}</td><td data-label="מעבר WhatsApp">{num(row.whatsappHandoffs)}</td><td data-label="בקשות">{num(row.bookingRequests)}</td><td data-label="הזמנות מ־VII">{num(row.viiBookings)}</td><td data-label="הזמנות מ־Biz">{row.placeId === selectedPlaceId ? conversionLoading ? "טוען" : conversions ? num(conversions.summary.all.orders) : "לא זמין" : "בחר עסק למעלה"}</td><td data-label="חוות דעת">{num(row.reviews)}</td><td data-label="כניסה / חשיפה"><div className={styles.rate}><span><i style={{ width: `${Math.min(100, percent(row.pageViews, row.impressions))}%` }} /></span><b>{row.impressions ? `${percent(row.pageViews, row.impressions)}%` : "—"}</b></div></td><td data-label="פעולה / כניסה"><div className={styles.rate}><span><i style={{ width: `${Math.min(100, percent(actions(row), row.pageViews))}%` }} /></span><b>{row.pageViews ? `${percent(actions(row), row.pageViews)}%` : "—"}</b></div></td></tr>)}</tbody></table></div> : <div className={styles.empty}><BarChart3 size={30} /><h2>אין נתונים במסנן הזה</h2><p>לא נמצאו נתונים בטווח ובבסיס התאריך שנבחרו.</p><button type="button" onClick={() => { setQuery(""); setWorld("all"); setBasis("created"); setFrom(monthAgo); setTill(today); }}>איפוס מסננים</button></div>}</section>
    </> : null}
  </main>;
}
