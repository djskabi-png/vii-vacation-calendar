"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Archive, ArrowLeft, ArrowUpLeft, BarChart3, CalendarClock, CheckCircle2, ChevronLeft, CircleDashed, Clock3, Eye, FileSearch, Filter, History, LayoutDashboard, ListFilter, RefreshCw, Save, Search, Send, Sparkles, Target, Users, X } from "lucide-react";
import styles from "./search-pages.module.css";

type Status = "pending" | "draft" | "review" | "scheduled" | "published" | "archived";
type Opportunity = {
  id: string; origin: "search" | "managed"; world: string; locale: string; location: string;
  filters: Record<string, string | number | boolean>; sourcePath: string; proposedPath: string; suggestedTitle: string;
  latestResultCount: number; firstSeenAt: string; lastSeenAt: string; searches: number; uniqueSessions: number;
  internalSearches: number; internalUniqueSessions: number; internalOnly: boolean;
  zeroResults: number; status: Status; assignee: string | null; title: string; metaTitle: string; metaDescription: string;
  h1: string; summary: string; body: string; faq: Array<{ question: string; answer: string }>; slug: string;
  canonicalPath: string; robotsIndex: boolean; scheduledAt: string | null; publishedAt: string | null; version: number;
  updatedAt: string | null; updatedBy: string | null; readiness: number; priority: number;
};
type Dashboard = {
  periodDays: number; generatedAt: string;
  metrics: { recordedSearches: number; uniqueSessions: number; pending: number; published: number; zeroResultSearches: number; internalSearches: number };
  statusCounts: Record<Status, number>; opportunities: Opportunity[];
};
type Version = { version: number; action: string; actorEmail: string; createdAt: string; snapshot: Partial<Opportunity> };
type Tab = "brief" | "content" | "seo" | "faq" | "publishing" | "history";

const statusLabels: Record<Status, string> = { pending: "ממתין לעריכה", draft: "טיוטה", review: "מוכן לבדיקה", scheduled: "מתוזמן", published: "פורסם", archived: "בארכיון" };
const worldLabels: Record<string, string> = { vacation: "נופש", events: "אירועים", spa: "ספא", hourly: "חדרים לפי שעה" };
const filterLabels: Record<string, string> = { type: "סוג מקום", eventType: "סוג אירוע", guests: "משתתפים", noise: "ללא הגבלת רעש", accessible: "נגישות", hours: "משך", maxPrice: "מחיר מרבי", experience: "חוויה" };
const number = (value: number) => value.toLocaleString("he-IL");
const date = (value: string | null) => value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) : "לא עודכן";
const localDateTime = (value: string | null) => {
  if (!value) return "";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "";
  const part = (number: number) => String(number).padStart(2, "0");
  return `${instant.getFullYear()}-${part(instant.getMonth() + 1)}-${part(instant.getDate())}T${part(instant.getHours())}:${part(instant.getMinutes())}`;
};
const liveReadiness = (item: Opportunity | null) => {
  if (!item) return 0;
  const checks = [item.title.length >= 8, item.metaTitle.length >= 8, item.metaDescription.length >= 40,
    item.h1.length >= 8, item.summary.length >= 30, item.body.length >= 120, /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
};

export default function SearchPagesAdmin() {
  const [period, setPeriod] = useState(30);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [current, setCurrent] = useState<Opportunity | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [statusFilter, setStatusFilter] = useState<Status | "active" | "internal" | "all">("active");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("brief");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(async (days: number, preserve = true) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/search-pages?days=${days}`, { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); setDashboard(null); return null; }
      if (!response.ok) throw new Error("מרכז עמודי החיפוש אינו זמין כרגע.");
      const next = await response.json() as Dashboard;
      setForbidden(false); setDashboard(next);
      const requested = new URLSearchParams(window.location.search).get("id");
      const nextId = preserve && selectedId && next.opportunities.some((item) => item.id === selectedId) ? selectedId : requested && next.opportunities.some((item) => item.id === requested) ? requested : "";
      if (nextId) void loadDetail(nextId); else if (!preserve) { setSelectedId(""); setCurrent(null); }
      return next;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); return null; }
    finally { setLoading(false); }
  }, [selectedId]);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id); setDetailLoading(true); setError(""); setMessage("");
    window.history.replaceState(null, "", `/admin/search-pages?id=${encodeURIComponent(id)}`);
    try {
      const response = await fetch(`/api/admin/search-pages?id=${encodeURIComponent(id)}&days=${period}`, { cache: "no-store" });
      if (!response.ok) throw new Error("לא הצלחנו לטעון את העמוד שבחרתם.");
      const data = await response.json() as { opportunity: Opportunity; versions: Version[] };
      setCurrent(data.opportunity); setVersions(data.versions); setTab("brief");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setDetailLoading(false); }
  }, [period]);

  useEffect(() => { void loadDashboard(period, true); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => (dashboard?.opportunities || []).filter((item) => {
    const statusMatch = statusFilter === "all" || statusFilter === "active" ? statusFilter === "all" || !["published", "archived"].includes(item.status) : statusFilter === "internal" ? item.internalSearches > 0 : item.status === statusFilter;
    const term = query.trim().toLocaleLowerCase("he");
    return statusMatch && (!term || `${item.title} ${item.location} ${worldLabels[item.world] || item.world} ${item.canonicalPath}`.toLocaleLowerCase("he").includes(term));
  }), [dashboard, query, statusFilter]);

  function update<K extends keyof Opportunity>(key: K, value: Opportunity[K]) { setCurrent((item) => item ? { ...item, [key]: value } : item); }

  async function save(status: Status) {
    if (!current) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const scheduledAt = status === "scheduled" && current.scheduledAt ? new Date(current.scheduledAt).toISOString() : null;
      const response = await fetch("/api/admin/search-pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        id: current.id, expectedVersion: current.version, status, assignee: current.assignee || "", title: current.title,
        metaTitle: current.metaTitle, metaDescription: current.metaDescription, h1: current.h1, summary: current.summary,
        body: current.body, faq: current.faq, slug: current.slug, robotsIndex: current.robotsIndex, scheduledAt,
      }) });
      if (!response.ok) {
        const code = (await response.json().catch(() => ({})) as { error?: string }).error;
        throw new Error(code === "version_conflict" ? "מנהל אחר שמר גרסה חדשה. רעננו והשוו לפני שמירה." : code === "invalid_page" ? "חסרים שדות חובה או שאחד השדות אינו תקין. מדד המוכנות מסמן מה נשאר." : "השמירה לא הושלמה. אפשר לנסות שוב בלי לאבד את הטקסט.");
      }
      setMessage(status === "published" ? "העמוד פורסם ונשלח לבדיקת האתר ומפת האתר." : status === "scheduled" ? "העמוד אושר לפרסום עתידי." : status === "review" ? "העמוד הועבר לבדיקה." : status === "archived" ? "העמוד הועבר לארכיון ונשמר ביומן." : "הטיוטה נשמרה.");
      await loadDashboard(period, true); await loadDetail(current.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת שמירה"); }
    finally { setSaving(false); }
  }

  function restore(version: Version) {
    if (!current) return;
    const snapshot = version.snapshot;
    setCurrent({ ...current, ...snapshot, id: current.id, version: current.version } as Opportunity);
    setTab("content");
    setMessage(`גרסה ${version.version} נטענה לעורך. שמרו אותה כדי ליצור גרסה חדשה, בלי למחוק היסטוריה.`);
  }

  const editorReadiness = liveReadiness(current);
  const publishReady = Boolean(current && editorReadiness === 100 && current.robotsIndex);
  const primary = current?.status === "pending" ? { label: "יצירת טיוטה", status: "draft" as Status, icon: Save }
    : current?.status === "draft" ? { label: "העברה לבדיקה", status: "review" as Status, icon: Send }
      : { label: "פרסום עכשיו", status: "published" as Status, icon: Sparkles };
  const PrimaryIcon = primary.icon;

  return <main className={styles.page} dir="rtl">
    <header className={styles.topbar}><div><span className={styles.kicker}>מרכז גילוי ותוכן</span><h1>עמודי חיפוש</h1><p>כל חיפוש אמיתי הופך להזדמנות שאפשר למדוד, לערוך ולפרסם.</p></div><div className={styles.topActions}><div className={styles.period}>{[7, 30, 90].map((days) => <button key={days} type="button" aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} ימים</button>)}</div><button type="button" className={styles.iconButton} onClick={() => void loadDashboard(period)} disabled={loading} aria-label="רענון נתונים" title="רענון"><RefreshCw size={18} className={loading ? styles.spin : ""} /></button></div></header>
    {forbidden ? <section className={styles.authState}><Target size={34} /><h2>כניסה למרכז הניהול</h2><p>המידע פתוח רק למנהלי VII מורשים.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fsearch-pages">כניסה עם Google <ArrowLeft size={17} /></a></section> : null}
    {error ? <div className={styles.alert} role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="סגירת הודעה"><X size={16} /></button></div> : null}
    {message ? <div className={styles.success} role="status"><CheckCircle2 size={18} /><span>{message}</span><button type="button" onClick={() => setMessage("")} aria-label="סגירת הודעה"><X size={16} /></button></div> : null}
    {!forbidden && dashboard ? <>
      <section className={styles.metrics} aria-label="מדדי חיפושים"><article><span><Search size={18} /> חיפושי גולשים</span><strong>{number(dashboard.metrics.recordedSearches)}</strong><small>{period} הימים האחרונים</small></article><article><span><Users size={18} /> מבקרים ייחודיים</span><strong>{number(dashboard.metrics.uniqueSessions)}</strong><small>לפי מזהה מפגש אנונימי</small></article><article className={styles.metricAccent}><span><CircleDashed size={18} /> ממתינים לעבודה</span><strong>{number(dashboard.metrics.pending)}</strong><small>ממתין, טיוטה או בדיקה</small></article><article><span><CheckCircle2 size={18} /> פורסמו</span><strong>{number(dashboard.metrics.published)}</strong><small>עמודים מנוהלים פעילים</small></article><article><span><AlertCircle size={18} /> ללא תוצאות</span><strong>{number(dashboard.metrics.zeroResultSearches)}</strong><small>אות לשיפור היצע או ניסוח</small></article><article><span><Target size={18} /> בדיקות מנהל</span><strong>{number(dashboard.metrics.internalSearches)}</strong><small>מוצגות בנפרד ולא משפיעות על הביקוש</small></article></section>
      <section className={styles.commandCenter}>
        <aside className={styles.queue} aria-label="תור עמודי חיפוש">
          <div className={styles.queueHead}><div><h2>תור עבודה</h2><span>{filtered.length} מתוך {dashboard.opportunities.length}</span></div><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש עמוד, אזור או כתובת" /></label></div>
          <div className={styles.statusTabs} role="tablist" aria-label="סינון לפי סטטוס"><button type="button" aria-pressed={statusFilter === "active"} onClick={() => setStatusFilter("active")}>לטיפול <b>{dashboard.metrics.pending}</b></button><button type="button" aria-pressed={statusFilter === "internal"} onClick={() => setStatusFilter("internal")}>בדיקות שלי <b>{dashboard.metrics.internalSearches}</b></button><button type="button" aria-pressed={statusFilter === "published"} onClick={() => setStatusFilter("published")}>פורסמו <b>{dashboard.statusCounts.published}</b></button><button type="button" aria-pressed={statusFilter === "all"} onClick={() => setStatusFilter("all")}>הכול</button></div>
          <div className={styles.queueList}>{loading ? <div className={styles.queueState}><RefreshCw className={styles.spin} /> טוענים הזדמנויות...</div> : filtered.length ? filtered.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? styles.selected : ""} onClick={() => void loadDetail(item.id)}>
            <div className={styles.itemTop}><span data-status={item.internalOnly ? "internal" : item.status}>{item.internalOnly ? "בדיקת מנהל" : statusLabels[item.status]}</span><small>{worldLabels[item.world] || item.world}</small></div><strong>{item.title || item.suggestedTitle}</strong><p>{item.location}{Object.values(item.filters).length ? ` · ${Object.values(item.filters).join(" · ")}` : ""}</p><div className={styles.itemMetrics}><span><Search size={13} /> {number(item.searches)} גולשים</span>{item.internalSearches > 0 ? <span><Target size={13} /> {number(item.internalSearches)} בדיקות</span> : null}<span><Eye size={13} /> {number(item.latestResultCount)} תוצאות</span><span>{item.readiness}% מוכן</span></div>
          </button>) : <div className={styles.queueState}><ListFilter size={24} /><strong>אין עמודים במסנן הזה</strong><button type="button" onClick={() => { setStatusFilter("all"); setQuery(""); }}>הצגת כל העמודים</button></div>}</div>
        </aside>
        <section className={styles.workspace} aria-live="polite">
          {detailLoading ? <div className={styles.blankState}><RefreshCw className={styles.spin} /><h2>פותחים את סביבת העבודה...</h2></div> : current ? <>
            <header className={styles.editorHeader}><div><div className={styles.editorMeta}><span data-status={current.status}>{statusLabels[current.status]}</span><small>{worldLabels[current.world] || current.world} · {current.location}</small></div><h2>{current.title || current.suggestedTitle}</h2><div className={styles.pathLine}><code dir="ltr">{current.canonicalPath}</code>{current.status === "published" ? <a href={current.canonicalPath} target="_blank" rel="noreferrer">פתיחת העמוד <ArrowUpLeft size={15} /></a> : <a href={current.sourcePath} target="_blank" rel="noreferrer">החיפוש המקורי <ArrowUpLeft size={15} /></a>}</div></div><div className={styles.readiness}><div><strong>{editorReadiness}%</strong><span>מוכנות לפרסום</span></div><i><b style={{ width: `${editorReadiness}%` }} /></i></div></header>
            <nav className={styles.editorTabs} aria-label="אזורי עריכה">{[
              ["brief", "תמונה מלאה", LayoutDashboard], ["content", "תוכן", FileSearch], ["seo", "קידום", Target], ["faq", "שאלות", ListFilter], ["publishing", "פרסום", CalendarClock], ["history", "היסטוריה", History],
            ].map(([id, label, Icon]) => { const TabIcon = Icon as typeof LayoutDashboard; return <button key={String(id)} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id as Tab)}><TabIcon size={16} /> {String(label)}</button>; })}</nav>
            <div className={styles.editorBody}>
              {tab === "brief" ? <div className={styles.briefGrid}><section className={styles.demandCard}><div><BarChart3 size={20} /><h3>למה העמוד נוצר</h3></div><dl><div><dt>חיפושים בתקופה</dt><dd>{number(current.searches)}</dd></div><div><dt>מבקרים ייחודיים</dt><dd>{number(current.uniqueSessions)}</dd></div><div><dt>תוצאות כרגע</dt><dd>{number(current.latestResultCount)}</dd></div><div><dt>חיפושים ללא תוצאה</dt><dd>{number(current.zeroResults)}</dd></div></dl><small>מקור: חיפושים בהסכמה, ללא מנהלים ורובוטים מזוהים. אזור זמן לתצוגה: ישראל.</small></section><section className={styles.intentCard}><div><Filter size={20} /><h3>כוונת החיפוש</h3></div><div className={styles.chips}><span>אזור: {current.location}</span>{Object.entries(current.filters).map(([key, value]) => <span key={key}>{filterLabels[key] || key}: {value === true ? "כן" : value}</span>)}</div><a href={current.sourcePath} target="_blank" rel="noreferrer">פתיחת החיפוש המקורי <ArrowUpLeft size={15} /></a></section><section className={styles.nextCard}><Sparkles size={22} /><div><h3>{editorReadiness < 100 ? "הצעד הבא" : current.status === "published" ? "העמוד פעיל" : "מוכן לפרסום"}</h3><p>{editorReadiness < 100 ? "השלימו את שדות התוכן והקידום. מדד המוכנות מתעדכן בזמן אמת." : current.status === "published" ? "אפשר לבדוק את העמוד הציבורי, לעדכן או להחזיר גרסה קודמת." : "כל בדיקות התוכן עברו. בדקו תצוגה מקדימה ופרסמו."}</p></div><button type="button" onClick={() => setTab(editorReadiness < 100 ? "content" : "publishing")}>{editorReadiness < 100 ? "המשך עריכה" : "לפרסום"} <ChevronLeft size={16} /></button></section></div> : null}
              {tab === "content" ? <div className={styles.formSection}><header><div><h3>התוכן שהגולש יראה</h3><p>כותרת ברורה, תשובה קצרה ותוכן מועיל מתחת לתוצאות.</p></div></header><label><span>שם פנימי לעמוד <b>{current.title.length}/90</b></span><input value={current.title} onChange={(event) => update("title", event.target.value)} maxLength={90} /></label><label><span>כותרת ראשית H1 <b>{current.h1.length}/100</b></span><input value={current.h1} onChange={(event) => update("h1", event.target.value)} maxLength={100} /></label><label><span>תקציר מעל התוצאות <b>{current.summary.length}/420</b></span><textarea value={current.summary} onChange={(event) => update("summary", event.target.value)} rows={4} maxLength={420} placeholder="תשובה קצרה שעוזרת להבין מה נמצא בעמוד" /></label><label><span>תוכן עומק מתחת לתוצאות <b>{current.body.length}/8000</b></span><textarea value={current.body} onChange={(event) => update("body", event.target.value)} rows={12} maxLength={8000} placeholder="מידע מעשי, אמין ומבוסס על התוצאות והאזור" /></label></div> : null}
              {tab === "seo" ? <div className={styles.formSection}><header><div><h3>קידום, מנועי תשובות וכתובת</h3><p>העמוד נכנס למפת האתר רק אחרי פרסום עם אינדוקס פעיל.</p></div></header><label><span>כתובת באנגלית</span><div className={styles.slugInput}><code dir="ltr">/find/</code><input dir="ltr" value={current.slug} onChange={(event) => update("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} /></div></label><label><span>כותרת למנועי חיפוש <b>{current.metaTitle.length}/70</b></span><input value={current.metaTitle} onChange={(event) => update("metaTitle", event.target.value)} maxLength={70} /></label><label><span>תיאור למנועי חיפוש <b>{current.metaDescription.length}/180</b></span><textarea value={current.metaDescription} onChange={(event) => update("metaDescription", event.target.value)} rows={4} maxLength={180} /></label><div className={styles.serpPreview}><small>תצוגה בתוצאות חיפוש</small><strong>{current.metaTitle || current.h1}</strong><code dir="ltr">vii.spaplus.co/find/{current.slug}</code><p>{current.metaDescription || "התיאור יופיע כאן לאחר שתכתבו אותו."}</p></div><label className={styles.switch}><input type="checkbox" checked={current.robotsIndex} onChange={(event) => update("robotsIndex", event.target.checked)} /><span><b>אפשר אינדוקס לאחר פרסום</b><small>העמוד יתווסף למפת האתר ויהיה זמין לסריקה.</small></span></label></div> : null}
              {tab === "faq" ? <div className={styles.formSection}><header><div><h3>שאלות ותשובות</h3><p>שאלות אמיתיות שעוזרות לגולש לקבל החלטה. אפשר להשאיר ריק.</p></div><button type="button" className={styles.secondaryButton} onClick={() => update("faq", [...current.faq, { question: "", answer: "" }].slice(0, 8))} disabled={current.faq.length >= 8}>הוספת שאלה</button></header>{current.faq.length ? <div className={styles.faqEditor}>{current.faq.map((item, index) => <article key={index}><button type="button" onClick={() => update("faq", current.faq.filter((_, itemIndex) => itemIndex !== index))} aria-label={`מחיקת שאלה ${index + 1}`}><X size={16} /></button><label><span>שאלה {index + 1}</span><input value={item.question} onChange={(event) => update("faq", current.faq.map((entry, itemIndex) => itemIndex === index ? { ...entry, question: event.target.value } : entry))} /></label><label><span>תשובה</span><textarea rows={4} value={item.answer} onChange={(event) => update("faq", current.faq.map((entry, itemIndex) => itemIndex === index ? { ...entry, answer: event.target.value } : entry))} /></label></article>)}</div> : <div className={styles.inlineEmpty}><ListFilter size={24} /><p>לא נוספו שאלות לעמוד הזה.</p></div>}</div> : null}
              {tab === "publishing" ? <div className={styles.publishGrid}><section><h3>בקרת פרסום</h3><ul><li data-pass={current.title.length >= 8}>שם עמוד תקין</li><li data-pass={current.h1.length >= 8}>כותרת ראשית תקינה</li><li data-pass={current.summary.length >= 30}>תקציר שימושי</li><li data-pass={current.body.length >= 120}>תוכן עומק</li><li data-pass={current.metaTitle.length >= 8}>כותרת SEO</li><li data-pass={current.metaDescription.length >= 40}>תיאור SEO</li><li data-pass={/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(current.slug)}>כתובת אנגלית תקינה</li><li data-pass={current.robotsIndex}>אינדוקס ומפת אתר מאושרים</li></ul></section><section><h3>פרסום עתידי</h3><p>בחרו מועד לפי השעה המקומית במכשיר. בשרת נשמר זמן חד־משמעי.</p><input type="datetime-local" value={localDateTime(current.scheduledAt)} onChange={(event) => update("scheduledAt", event.target.value || null)} /><button type="button" className={styles.scheduleButton} disabled={saving || !current.scheduledAt || editorReadiness < 100 || !current.robotsIndex} onClick={() => void save("scheduled")}><CalendarClock size={16} /> אישור ותזמון</button><div className={styles.publishMeta}><span>גרסה {current.version}</span><span>עודכן: {date(current.updatedAt)}</span><span>{current.updatedBy || "ללא עורך אחרון"}</span></div></section></div> : null}
              {tab === "history" ? <div className={styles.history}><header><h3>גרסאות ויומן שינויים</h3><p>שחזור טוען את הגרסה לעורך ויוצר גרסה חדשה רק לאחר שמירה.</p></header>{versions.length ? versions.map((version) => <article key={version.version}><div><strong>גרסה {version.version} · {statusLabels[version.action as Status] || version.action}</strong><span>{version.actorEmail}</span></div><time>{date(version.createdAt)}</time><button type="button" onClick={() => restore(version)}>טעינה לעורך</button></article>) : <div className={styles.inlineEmpty}><History size={24} /><p>עדיין אין גרסאות שמורות להזדמנות הזאת.</p></div>}</div> : null}
            </div>
            <footer className={styles.actionBar}><div><button type="button" className={styles.secondaryButton} onClick={() => void save("draft")} disabled={saving}><Save size={16} /> שמירת טיוטה</button>{current.status !== "archived" ? <button type="button" className={styles.archiveButton} onClick={() => void save("archived")} disabled={saving}><Archive size={16} /> ארכיון</button> : null}</div><button type="button" className={styles.primaryAction} disabled={saving || (primary.status !== "draft" && !publishReady)} onClick={() => void save(primary.status)}>{saving ? <RefreshCw className={styles.spin} size={17} /> : <PrimaryIcon size={17} />}{primary.label}</button></footer>
          </> : <div className={styles.blankState}><FileSearch size={42} /><h2>בחרו חיפוש מתור העבודה</h2><p>תראו למה הוא נוצר, מה אנשים חיפשו ומה חסר לפני שאפשר לפרסם.</p></div>}
        </section>
      </section>
      <p className={styles.dataNote}><Clock3 size={14} /> עודכן {date(dashboard.generatedAt)} · חיפושים נשמרים לאחר הסכמת מדידה. בדיקות של מנהל מחובר מוצגות בנפרד ואינן משפיעות על נתוני הביקוש. לחיצה, חשיפה או פתיחת וואטסאפ אינן מוצגות כהזמנה שהושלמה.</p>
    </> : !forbidden && loading ? <div className={styles.authState}><RefreshCw className={styles.spin} /><h2>טוענים את מרכז עמודי החיפוש...</h2></div> : null}
  </main>;
}
