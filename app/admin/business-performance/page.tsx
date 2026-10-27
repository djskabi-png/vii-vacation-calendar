"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowDownToLine, ArrowUp, BarChart3, CheckCircle2, Clock3, Eye, MessageCircle, MousePointerClick, Phone, PhoneCall, RefreshCw, Search, ShoppingBag, Star, Users, XCircle } from "lucide-react";
import { businessReportScopes, canonicalBusinessReportScope } from "../../lib/business-report-scopes";
import styles from "./business-performance.module.css";

type Row = { placeId: string; placeName: string; world: string; impressions: number; pageViews: number; phoneReveals: number; phoneClicks: number; whatsappLeads: number; whatsappHandoffs: number; bookingRequests: number; viiBookings: number; reviews: number; uniqueBrowsers: number };
type ConversionBucket = { contacts: number; identified: number; converted: number; rate: number | null; customers: number; orders: number; revenue: number; medianDelay: number | null };
type ConversionSource = "whatsapp" | "maskyoo" | "form";
type ConversionContact = { source: ConversionSource; id: number; domainID: number | null; time: string; phone: string | null; details: { status?: string; duration?: number; date?: string | null; guests?: number }; order: { orderID: string; orderIDBySite: string | null; created: string; price: number } | null; delay: number | null; moreOrders: string[] };
type Conversions = { siteID: number; from: string; till: string; created: string; count: number; summary: Record<"all" | ConversionSource, ConversionBucket>; clicks: { whatsapp: number; showphone: number; phone: number }; contacts?: ConversionContact[] };
type BizCache = { status: "saved" | "fresh" | "stale_fallback" | "failure_cached"; savedAt: string; stale: boolean; retryAt?: string };
type BizSummary = { summary: Conversions["summary"]; clicks: Conversions["clicks"]; cache?: BizCache; error?: string };
type BizBatchJob = { id: string; from: string; till: string; scope: string; forceRefresh: boolean; targets: Array<{ placeId: string; world: string }> };
type BizReportRun = { jobId: string; actorEmail: string; from: string; till: string; scope: string; forceRefresh: boolean; total: number; processed: number; succeeded: number; unsupported: number; failed: number; status: "running" | "completed" | "stopped"; startedAt: string; updatedAt: string };
type SortKey = "placeName" | "impressions" | "pageViews" | "uniqueBrowsers" | "phoneClicks" | "whatsappHandoffs" | "maskyoo" | "bizWhatsapp" | "bookingRequests" | "viiBookings" | "bizOrders" | "bizRevenue" | "reviews" | "actions" | "entryRate" | "actionRate";

const worldLabels: Record<string, string> = { vacation: "נופש", vacations: "נופש", events: "אירועים", event: "אירועים", rooms: "חדרים לפי שעה", hourly: "חדרים לפי שעה", room: "חדרים לפי שעה", spa: "ספא", activities: "אטרקציות", attractions: "אטרקציות", trails: "טיולים", providers: "ספקים" };
const scopeLabels: Record<(typeof businessReportScopes)[number], string> = { all: "כל העסקים", vacations: "כל הנופש", events: "כל האירועים", spa: "כל הספא", rooms: "כל החדרים לפי שעה", activities: "כל האטרקציות", trails: "כל הטיולים", providers: "כל הספקים" };
const sourceLabels = { whatsapp: "WhatsApp", maskyoo: "שיחות מסקיו", form: "טופס באתר" } as const;
const num = (value: number) => value.toLocaleString("he-IL");
const money = (value: number) => `${num(value)} ₪`;
const percent = (part: number, whole: number) => whole ? Math.round(part / whole * 100) : 0;
const actions = (row: Row) => row.phoneClicks + row.whatsappHandoffs + row.bookingRequests;
const isoDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
const previousMonth = (day: string) => { const date = new Date(`${monthStart(day)}T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); const from = date.toISOString().slice(0, 7) + "-01"; date.setUTCMonth(date.getUTCMonth() + 1); date.setUTCDate(0); return { from, till: date.toISOString().slice(0, 10) }; };
const conversionSupported = (row: Row) => /^(vacation|event|events|hourly|room|rooms)-\d+$/.test(row.placeId) && ["vacation", "vacations", "events", "hourly", "room", "rooms"].includes(row.world);
function uniqueConversionBusinesses(rows: Row[]) {
  const unique = new Map<string, Row>();
  for (const row of rows) {
    const key = `${canonicalBusinessReportScope(row.world)}:${row.placeId}`;
    if (!unique.has(key)) unique.set(key, row);
  }
  return [...unique.values()];
}
const sortKeys = new Set<SortKey>(["placeName", "impressions", "pageViews", "uniqueBrowsers", "phoneClicks", "whatsappHandoffs", "maskyoo", "bizWhatsapp", "bookingRequests", "viiBookings", "bizOrders", "bizRevenue", "reviews", "actions", "entryRate", "actionRate"]);
const reportViewKey = "vii-admin-business-performance-view-v1";
const emptyBucket = (): ConversionBucket => ({ contacts: 0, identified: 0, converted: 0, rate: null, customers: 0, orders: 0, revenue: 0, medianDelay: null });

function sumBucket(rows: ConversionBucket[]) {
  const total = rows.reduce((sum, row) => ({ ...sum, contacts: sum.contacts + row.contacts, identified: sum.identified + row.identified, converted: sum.converted + row.converted, customers: sum.customers + row.customers, orders: sum.orders + row.orders, revenue: sum.revenue + row.revenue }), emptyBucket());
  return { ...total, rate: total.contacts ? Math.round(total.converted / total.contacts * 1000) / 10 : null };
}

function delay(seconds: number | null) {
  if (seconds === null) return "אין עדיין";
  if (seconds < 3600) return `${Math.round(seconds / 60)} דקות`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} שעות`;
  return `${Math.round(seconds / 86400)} ימים`;
}

function duration(seconds?: number) {
  if (seconds === undefined) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}:${String(rest).padStart(2, "0")} דקות` : `${rest} שניות`;
}

function contactStatus(contact: ConversionContact) {
  if (contact.source === "maskyoo") return contact.details.status === "ANSWER" ? "נענתה" : contact.details.status || "סטטוס לא ידוע";
  if (contact.source === "whatsapp") return "שיחת WhatsApp נפתחה";
  return "טופס נשלח";
}

function reportRunStatus(run: BizReportRun) {
  if (run.status === "completed") return "הושלם";
  if (run.status === "stopped") return "נעצר בבטחה";
  return Date.now() - Date.parse(run.updatedAt) > 30 * 60 * 1000 ? "נקטע לפני השלמה" : "מתבצע כעת";
}

export default function BusinessPerformance() {
  const today = isoDay(new Date());
  const priorMonth = previousMonth(today);
  const [from, setFrom] = useState(today);
  const [till, setTill] = useState(today);
  const [basis, setBasis] = useState<"created" | "arrival">("created");
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState("all");
  const [sort, setSort] = useState<SortKey>("pageViews");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [contactSource, setContactSource] = useState<"all" | ConversionSource>("all");
  const [contactConverted, setContactConverted] = useState<"all" | "yes" | "no">("all");
  const [conversions, setConversions] = useState<Conversions | null>(null);
  const [conversionError, setConversionError] = useState("");
  const [conversionLoading, setConversionLoading] = useState(false);
  const conversionRequest = useRef<AbortController | null>(null);
  const conversionBatchRequest = useRef<AbortController | null>(null);
  const [bizByPlace, setBizByPlace] = useState<Record<string, BizSummary>>({});
  const [bizBatchProgress, setBizBatchProgress] = useState({ loaded: 0, total: 0, running: false, stopped: false });
  const [bizBatchError, setBizBatchError] = useState("");
  const [bizBatchJob, setBizBatchJob] = useState<BizBatchJob | null>(null);
  const [runHistory, setRunHistory] = useState<BizReportRun[]>([]);
  const [degradedDatabase, setDegradedDatabase] = useState(false);
  const reportViewReady = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(reportViewKey) || "null") as { sort?: string; direction?: string } | null;
      if (saved?.sort && sortKeys.has(saved.sort as SortKey)) setSort(saved.sort as SortKey);
      if (saved?.direction === "asc" || saved?.direction === "desc") setSortDirection(saved.direction);
    } catch { /* An invalid local preference must never block the report. */ }
    reportViewReady.current = true;
  }, []);

  useEffect(() => {
    if (!reportViewReady.current) return;
    window.localStorage.setItem(reportViewKey, JSON.stringify({ sort, direction: sortDirection }));
  }, [sort, sortDirection]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/business-performance?from=${from}&till=${till}&basis=${basis}`, { cache: "no-store" });
      if (response.status === 403) { setForbidden(true); return; }
      if (!response.ok) throw new Error("נתוני הביצועים עדיין אינם זמינים.");
      const payload = await response.json() as { rows: Row[]; bizSnapshots?: Record<string, BizSummary>; runHistory?: BizReportRun[]; degraded?: boolean };
      const next = payload.rows;
      setForbidden(false); setRows(next); setBizByPlace(payload.bizSnapshots || {}); setRunHistory(payload.runHistory || []);
      setDegradedDatabase(payload.degraded === true);
      setSelectedPlaceId((current) => current && next.some((row) => row.placeId === current && conversionSupported(row)) ? current : next.find(conversionSupported)?.placeId || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, [from, till, basis]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const supportedRows = useMemo(() => rows.filter(conversionSupported).sort((a, b) => a.placeName.localeCompare(b.placeName, "he")), [rows]);
  const conversionRows = useMemo(() => uniqueConversionBusinesses(supportedRows.filter((row) => world === "all" || canonicalBusinessReportScope(row.world) === world)), [supportedRows, world]);
  const conversionFamilySupported = world === "all" || world === "vacations" || world === "events" || world === "rooms";
  const selectedRow = conversionRows.find((row) => row.placeId === selectedPlaceId) || null;
  useEffect(() => {
    if (!conversionRows.some((row) => row.placeId === selectedPlaceId)) setSelectedPlaceId(conversionRows[0]?.placeId || "");
  }, [conversionRows, selectedPlaceId]);

  const startBizBatch = (forceRefresh = false) => {
    conversionBatchRequest.current?.abort();
    setBizBatchError("");
    const unresolved = conversionRows.filter(({ placeId }) => {
      const value = bizByPlace[placeId];
      return !value || value.cache?.stale || (value.error && value.cache?.status !== "failure_cached");
    });
    const targets = forceRefresh ? conversionRows : unresolved;
    if (!targets.length) {
      setBizBatchProgress({ loaded: conversionRows.length, total: conversionRows.length, running: false, stopped: false });
      return;
    }
    setBizBatchJob({
      id: crypto.randomUUID(),
      from,
      till,
      scope: world,
      forceRefresh,
      targets: targets.map(({ placeId, world: rowWorld }) => ({ placeId, world: rowWorld })),
    });
  };

  const loadRunHistory = useCallback(async () => {
    const response = await fetch("/api/admin/business-performance?mode=run-history", { cache: "no-store" });
    if (response.ok) setRunHistory((await response.json() as { runHistory: BizReportRun[] }).runHistory);
  }, []);

  const stopBizBatch = () => {
    const jobId = bizBatchJob?.id;
    conversionBatchRequest.current?.abort();
    setBizBatchProgress((current) => ({ ...current, running: false, stopped: current.loaded < current.total }));
    if (jobId) void fetch("/api/admin/business-performance", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "stop", jobId }) }).then(() => loadRunHistory()).catch(() => undefined);
  };

  useEffect(() => {
    conversionBatchRequest.current?.abort();
    setBizBatchJob(null);
    setBizBatchProgress({ loaded: 0, total: 0, running: false, stopped: false });
    setBizBatchError("");
  }, [from, till, world]);

  useEffect(() => { setBizByPlace({}); }, [from, till]);

  useEffect(() => {
    if (!bizBatchJob) return;
    conversionBatchRequest.current?.abort();
    const controller = new AbortController();
    conversionBatchRequest.current = controller;
    setBizBatchError("");
    setBizBatchProgress({ loaded: 0, total: bizBatchJob.targets.length, running: bizBatchJob.targets.length > 0, stopped: false });
    const loadAll = async () => {
      const collected: Record<string, BizSummary> = {};
      let succeeded = 0;
      let unsupported = 0;
      let failed = 0;
      for (let offset = 0; offset < bizBatchJob.targets.length; offset += 12) {
        if (controller.signal.aborted) return;
        const group = bizBatchJob.targets.slice(offset, offset + 12);
        const response = await fetch("/api/admin/business-performance", {
          method: "POST", signal: controller.signal, headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobId: bizBatchJob.id, from: bizBatchJob.from, till: bizBatchJob.till,
            scope: bizBatchJob.scope, total: bizBatchJob.targets.length, processedBefore: offset,
            succeededBefore: succeeded, unsupportedBefore: unsupported, failedBefore: failed, targets: group, forceRefresh: bizBatchJob.forceRefresh }),
        });
        if (!response.ok) throw new Error("לא ניתן להשלים את נתוני Biz לכל העסקים כרגע.");
        const payload = await response.json() as { results: Array<{ placeId: string; conversions?: Conversions; cache?: BizCache; error?: string }>; run: { jobId: string; processed: number; succeeded: number; unsupported: number; failed: number; total: number; status: "running" | "completed" } };
        if (payload.run.jobId !== bizBatchJob.id || payload.run.total !== bizBatchJob.targets.length) throw new Error("התקבלה התקדמות שאינה שייכת למשיכה הפעילה.");
        for (const result of payload.results) {
          const all = result.conversions?.summary.all;
          collected[result.placeId] = all && result.conversions
            ? { summary: result.conversions.summary, clicks: result.conversions.clicks, cache: result.cache }
            : { summary: { all: emptyBucket(), whatsapp: emptyBucket(), maskyoo: emptyBucket(), form: emptyBucket() },
              clicks: { whatsapp: 0, showphone: 0, phone: 0 }, error: result.error || "supplier_unavailable", cache: result.cache };
        }
        succeeded = payload.run.succeeded;
        unsupported = payload.run.unsupported;
        failed = payload.run.failed;
        setBizByPlace((current) => ({ ...current, ...collected }));
        setBizBatchProgress({ loaded: payload.run.processed, total: payload.run.total, running: payload.run.status === "running", stopped: false });
      }
      await loadRunHistory();
    };
    void loadAll().catch((cause) => {
      if (!controller.signal.aborted) {
        setBizBatchProgress((current) => ({ ...current, running: false, stopped: current.loaded < current.total }));
        setBizBatchError(cause instanceof Error ? cause.message : "שגיאת טעינת נתוני Biz");
      }
    });
    return () => controller.abort();
  }, [bizBatchJob, loadRunHistory]);

  const loadConversions = useCallback(async () => {
    if (!selectedRow) { setConversions(null); setConversionError(""); setConversionLoading(false); return; }
    conversionRequest.current?.abort();
    const controller = new AbortController(); conversionRequest.current = controller;
    setConversionLoading(true); setConversionError("");
    const params = new URLSearchParams({ mode: "conversions", placeId: selectedRow.placeId, world: selectedRow.world, from, till, details: "1" });
    if (contactSource !== "all") params.set("source", contactSource);
    if (contactConverted !== "all") params.set("converted", contactConverted);
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
      setBizByPlace((current) => ({ ...current, [selectedRow.placeId]: { summary: payload.conversions!.summary, clicks: payload.conversions!.clicks } }));
    } catch (cause) {
      if (controller.signal.aborted) return;
      setConversions(null); setConversionError(cause instanceof Error ? cause.message : "שגיאת טעינה");
    } finally { if (!controller.signal.aborted) setConversionLoading(false); }
  }, [from, till, selectedRow, contactSource, contactConverted]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConversions(), 0);
    return () => { window.clearTimeout(timer); conversionRequest.current?.abort(); };
  }, [loadConversions]);
  const filtered = useMemo(() => rows.filter((row) => (world === "all" || canonicalBusinessReportScope(row.world) === world) && (!query.trim() || `${row.placeName} ${worldLabels[row.world] || row.world}`.toLocaleLowerCase("he").includes(query.trim().toLocaleLowerCase("he")))).sort((a, b) => {
    if (sort === "placeName") return (sortDirection === "asc" ? 1 : -1) * a.placeName.localeCompare(b.placeName, "he");
    const value = (row: Row): number | null => sort === "actions" ? actions(row) : sort === "entryRate" ? percent(row.pageViews, row.impressions) : sort === "actionRate" ? percent(actions(row), row.pageViews)
      : sort === "bizOrders" ? bizByPlace[row.placeId]?.summary?.all.orders ?? null : sort === "bizRevenue" ? bizByPlace[row.placeId]?.summary?.all.revenue ?? null
      : sort === "maskyoo" ? bizByPlace[row.placeId]?.summary?.maskyoo.contacts ?? null : sort === "bizWhatsapp" ? bizByPlace[row.placeId]?.summary?.whatsapp.contacts ?? null : row[sort];
    const left = value(a); const right = value(b);
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return (sortDirection === "asc" ? 1 : -1) * (left - right);
  }), [rows, query, world, sort, sortDirection, bizByPlace]);
  const chooseSort = (key: SortKey) => { if (sort === key) setSortDirection((value) => value === "desc" ? "asc" : "desc"); else { setSort(key); setSortDirection("desc"); } };
  const totals = useMemo(() => filtered.reduce((sum, row) => ({ impressions: sum.impressions + row.impressions, pageViews: sum.pageViews + row.pageViews, uniqueBrowsers: sum.uniqueBrowsers + row.uniqueBrowsers, phoneReveals: sum.phoneReveals + row.phoneReveals, phoneClicks: sum.phoneClicks + row.phoneClicks, whatsappLeads: sum.whatsappLeads + row.whatsappLeads, whatsappHandoffs: sum.whatsappHandoffs + row.whatsappHandoffs, bookingRequests: sum.bookingRequests + row.bookingRequests, viiBookings: sum.viiBookings + row.viiBookings, reviews: sum.reviews + row.reviews }), { impressions: 0, pageViews: 0, uniqueBrowsers: 0, phoneReveals: 0, phoneClicks: 0, whatsappLeads: 0, whatsappHandoffs: 0, bookingRequests: 0, viiBookings: 0, reviews: 0 }), [filtered]);
  const totalActions = totals.phoneClicks + totals.whatsappHandoffs + totals.bookingRequests;
  const reportConversionRows = useMemo(() => uniqueConversionBusinesses(filtered.filter(conversionSupported)), [filtered]);
  const loadedBiz = useMemo(() => reportConversionRows.flatMap((row) => bizByPlace[row.placeId]?.summary && !bizByPlace[row.placeId].error ? [bizByPlace[row.placeId]] : []), [reportConversionRows, bizByPlace]);
  const staleBiz = useMemo(() => loadedBiz.filter((item) => item.cache?.stale), [loadedBiz]);
  const bizCoverageComplete = reportConversionRows.length > 0 && loadedBiz.length === reportConversionRows.length;
  const latestBizSave = useMemo(() => loadedBiz.map((item) => item.cache?.savedAt || "").filter(Boolean).sort().at(-1) || "", [loadedBiz]);
  const bizTotals = useMemo(() => ({ all: sumBucket(loadedBiz.map((row) => row.summary!.all)), whatsapp: sumBucket(loadedBiz.map((row) => row.summary!.whatsapp)), maskyoo: sumBucket(loadedBiz.map((row) => row.summary!.maskyoo)), form: sumBucket(loadedBiz.map((row) => row.summary!.form)) }), [loadedBiz]);
  const worldBreakdown = useMemo(() => (["vacations", "events", "spa", "rooms", "activities", "trails", "providers"] as const).map((scope) => {
    const allScopeRows = filtered.filter((row) => canonicalBusinessReportScope(row.world) === scope);
    const scopeRows = allScopeRows.filter(conversionSupported);
    const summaries = scopeRows.flatMap((row) => bizByPlace[row.placeId]?.summary && !bizByPlace[row.placeId].error ? [bizByPlace[row.placeId].summary!] : []);
    return { scope, businesses: allScopeRows.length, loaded: summaries.length, supported: scope === "vacations" || scope === "events" || scope === "rooms", all: sumBucket(summaries.map((item) => item.all)), whatsapp: sumBucket(summaries.map((item) => item.whatsapp)), maskyoo: sumBucket(summaries.map((item) => item.maskyoo)) };
  }), [filtered, bizByPlace]);
  function exportCsv() {
    const header = ["עסק", "עולם", "חשיפות", "כניסות", "דפדפנים ייחודיים", "חשיפות טלפון", "לחיצות טלפון", "לידי WhatsApp", "מעברים ל-WhatsApp", "בקשות הזמנה", "הזמנות מ-V", "שיחות מסקיו", "פניות WhatsApp ב-Biz", "פניות שהומרו", "הזמנות מ-Biz", "הכנסות Biz", "חוות דעת", "כניסה מתוך חשיפה", "פעולה מתוך כניסה"];
    const lines = filtered.map((row) => { const biz = bizByPlace[row.placeId]; return [row.placeName, worldLabels[row.world] || row.world, row.impressions, row.pageViews, row.uniqueBrowsers, row.phoneReveals, row.phoneClicks, row.whatsappLeads, row.whatsappHandoffs, row.bookingRequests, row.viiBookings, conversionSupported(row) ? biz?.error ? "לא זמין" : biz?.summary ? biz.summary.maskyoo.contacts : "לא נטען" : "לא נתמך", conversionSupported(row) ? biz?.error ? "לא זמין" : biz?.summary ? biz.summary.whatsapp.contacts : "לא נטען" : "לא נתמך", conversionSupported(row) ? biz?.error ? "לא זמין" : biz?.summary ? biz.summary.all.converted : "לא נטען" : "לא נתמך", conversionSupported(row) ? biz?.error ? "לא זמין" : biz?.summary ? biz.summary.all.orders : "לא נטען" : "לא נתמך", conversionSupported(row) ? biz?.error ? "לא זמין" : biz?.summary ? biz.summary.all.revenue : "לא נטען" : "לא נתמך", row.reviews, `${percent(row.pageViews, row.impressions)}%`, `${percent(actions(row), row.pageViews)}%`]; });
    const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })); link.download = `vii-business-performance-${from}-${till}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <main className={styles.page} dir="rtl">
    <header className={styles.header}><div><span>מרכז המרות ומכירות</span><h1>מהפנייה להזמנה</h1><p>כל הפעילות במקום אחד: שיחות מסקיו, פניות WhatsApp, הזמנות Biz והכנסות. כל מספר ניתן לפתיחה עד לעסק ולרשומת הפנייה שהרכיבה אותו.</p></div><div className={styles.headerActions}><button type="button" onClick={exportCsv} disabled={!filtered.length}><ArrowDownToLine size={16} /> ייצוא CSV</button><button type="button" className={styles.iconButton} onClick={() => void load()} disabled={loading} aria-label="רענון"><RefreshCw size={17} className={loading ? styles.spin : ""} /></button></div></header>
    <section className={styles.periodPresets} aria-label="תקופות מהירות"><button type="button" data-active={from === today && till === today} onClick={() => { setFrom(today); setTill(today); }}>היום</button><button type="button" data-active={from === monthStart(today) && till === today} onClick={() => { setFrom(monthStart(today)); setTill(today); }}>החודש</button><button type="button" data-active={from === priorMonth.from && till === priorMonth.till} onClick={() => { setFrom(priorMonth.from); setTill(priorMonth.till); }}>חודש קודם</button><span>{from} עד {till} · שעון ישראל</span></section>
    {degradedDatabase ? <section className={styles.degradedNotice} role="status"><strong>הדוח פועל במצב גיבוי</strong><span>גשר הנתונים הראשי אינו זמין כרגע. נתוני V נקראים מהעותק האחרון ב־Sites ונתוני Biz החדשים נשמרים במטמון הדוחות. הזמנות והרשאות אינן נכתבות למסד הגיבוי.</span></section> : null}
    <section className={styles.funnel} aria-label="סיכום משפך"><article><span><Eye size={17} /> חשיפות</span><strong>{num(totals.impressions)}</strong><small>הופעות כרטיסי עסק</small></article><i aria-hidden="true">←</i><article><span><MousePointerClick size={17} /> כניסות</span><strong>{num(totals.pageViews)}</strong><small>{percent(totals.pageViews, totals.impressions)}% מהחשיפות</small></article><i aria-hidden="true">←</i><article><span><BarChart3 size={17} /> פעולות</span><strong>{num(totalActions)}</strong><small>{percent(totalActions, totals.pageViews)}% מהכניסות</small></article><i aria-hidden="true">←</i><article className={styles.funnelAccent}><span><ShoppingBag size={17} /> הזמנות מ־V</span><strong>{num(totals.viiBookings)}</strong><small>הזמנות שנשמרו במערכת</small></article></section>
    <section className={styles.breakdown} aria-label="פירוט פעולות"><div><Users size={16} /><span>דפדפנים ייחודיים</span><strong>{num(totals.uniqueBrowsers)}</strong></div><div><Phone size={16} /><span>לחיצות על טלפון</span><strong>{num(totals.phoneClicks)}</strong></div><div><MessageCircle size={16} /><span>מעברים ל־WhatsApp</span><strong>{num(totals.whatsappHandoffs)}</strong></div><div><Star size={16} /><span>חוות דעת</span><strong>{num(totals.reviews)}</strong></div></section>
    <section className={styles.salesDashboard} aria-labelledby="sales-dashboard-title"><header><div><span>נתוני Biz מאומתים</span><h2 id="sales-dashboard-title">תמונת מצב לתקופה</h2><p>המספרים נשמרים במסד הנתונים ונפתחים מיד גם אחרי יציאה או רענון. טווחים היסטוריים מתעדכנים ברקע לכל היותר פעם בשבוע, מפני שהזמנה חדשה עשויה להיקשר לפנייה ישנה.</p>{!bizCoverageComplete ? <small role="alert">הסיכום כרגע חלקי: הוא כולל רק {loadedBiz.length} מתוך {reportConversionRows.length} עסקים. יש להשלים את הנתונים החסרים לפני שימוש בסכומים הכוללים.</small> : latestBizSave ? <small role="status">נשמר לאחרונה: {new Date(latestBizSave).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}{staleBiz.length ? ` · ${staleBiz.length} עסקים מוצגים מיד מהשמירה ומתעדכנים ברקע` : ""}</small> : null}</div><div className={styles.coverage}><strong dir="ltr">{loadedBiz.length} / {reportConversionRows.length}</strong><span>עסקים עם נתוני Biz שמורים מתוך כלל העסקים הנתמכים</span></div></header><div className={styles.salesCards}><article data-tone="call"><span><PhoneCall size={18} /> {bizCoverageComplete ? "כל" : "חלק מ־"}שיחות מסקיו</span><strong>{num(bizTotals.maskyoo.contacts)}</strong><small>{num(bizTotals.maskyoo.converted)} הפכו להזמנה</small></article><article data-tone="whatsapp"><span><MessageCircle size={18} /> {bizCoverageComplete ? "כל" : "חלק מ־"}פניות WhatsApp</span><strong>{num(bizTotals.whatsapp.contacts)}</strong><small>{num(bizTotals.whatsapp.converted)} הפכו להזמנה</small></article><article data-tone="orders"><span><ShoppingBag size={18} /> הזמנות Biz{bizCoverageComplete ? "" : " שנמשכו"}</span><strong>{num(bizTotals.all.orders)}</strong><small>{num(bizTotals.all.customers)} לקוחות מזמינים</small></article><article data-tone="revenue"><span><BarChart3 size={18} /> הכנסות Biz{bizCoverageComplete ? "" : " שנמשכו"}</span><strong>{money(bizTotals.all.revenue)}</strong><small>{bizTotals.all.rate === null ? "אין עדיין בסיס לחישוב" : `${bizTotals.all.rate.toLocaleString("he-IL")}% המרה מכל הפניות`}</small></article></div><div className={styles.worldMatrix}><table><thead><tr><th>עולם</th><th>כיסוי Biz</th><th>מסקיו</th><th>WhatsApp</th><th>הומרו</th><th>הזמנות</th><th>הכנסות</th></tr></thead><tbody>{worldBreakdown.filter((item) => world === "all" || item.scope === world).map((item) => <tr key={item.scope}><td data-label="עולם"><strong>{scopeLabels[item.scope]}</strong></td><td data-label="כיסוי Biz">{item.supported ? <bdi dir="ltr">{item.loaded} / {item.businesses}</bdi> : "לא נתמך ב־Biz"}</td><td data-label="מסקיו">{item.supported ? num(item.maskyoo.contacts) : "—"}</td><td data-label="WhatsApp">{item.supported ? num(item.whatsapp.contacts) : "—"}</td><td data-label="הומרו">{item.supported ? num(item.all.converted) : "—"}</td><td data-label="הזמנות">{item.supported ? num(item.all.orders) : "—"}</td><td data-label="הכנסות">{item.supported ? money(item.all.revenue) : "—"}</td></tr>)}</tbody></table></div></section>
    <section className={styles.toolbar} aria-label="סינון הדוח"><label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש עסק" /></label><label><span>משפחת עסקים</span><select value={world} onChange={(event) => setWorld(event.target.value)}>{businessReportScopes.map((value) => <option key={value} value={value}>{scopeLabels[value]}</option>)}</select></label><label><span>חיתוך נתוני V</span><select value={basis} onChange={(event) => setBasis(event.target.value as "created" | "arrival")}><option value="created">תאריך פתיחת פנייה</option><option value="arrival">תאריך הגעה</option></select></label><label><span>מתאריך</span><input type="date" value={from} max={till} onChange={(event) => setFrom(event.target.value)} /></label><label><span>עד תאריך</span><input type="date" value={till} min={from} max={today} onChange={(event) => setTill(event.target.value)} /></label><label><span>מיון</span><select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}><option value="pageViews">כניסות</option><option value="impressions">חשיפות</option><option value="actions">פעולות</option><option value="bizOrders">הזמנות Biz</option><option value="bizRevenue">הכנסות Biz</option><option value="entryRate">יחס כניסה</option><option value="actionRate">יחס פעולה</option></select></label><div className={styles.bizBatchControls}><span>כיסוי כולל: <bdi dir="ltr">{loadedBiz.length} מתוך {reportConversionRows.length}</bdi> עסקים עם נתונים שמורים</span><div><button type="button" onClick={() => startBizBatch(false)} disabled={!conversionRows.length || bizBatchProgress.running}>{loadedBiz.length ? "השלמת נתונים חסרים" : "טעינת תמונת מצב מלאה"}</button>{loadedBiz.length && !bizBatchProgress.running ? <button type="button" className={styles.secondaryAction} onClick={() => startBizBatch(true)}>רענון כפוי מ־Biz</button> : null}{bizBatchProgress.running ? <button type="button" className={styles.secondaryAction} onClick={stopBizBatch}>עצירה בטוחה</button> : null}</div>{bizBatchProgress.total ? <small role="status">בריצה הנוכחית: <bdi dir="ltr">{bizBatchProgress.loaded} מתוך {bizBatchProgress.total}</bdi>{bizBatchProgress.running ? " נטענו עד עכשיו" : bizBatchProgress.stopped ? " · הריצה נעצרה והתוצאות שכבר נטענו נשמרו" : " · הריצה הושלמה ונשמרה"}</small> : <small>נתונים שכבר נמשכו נשמרים בשרת. טעינה חוזרת משתמשת בהם ומושכת רק נתון חסר או נתון שדורש רענון.</small>}{bizBatchError ? <small role="alert" className={styles.batchError}>{bizBatchError} התוצאות שכבר נטענו נשמרו ואפשר להמשיך.</small> : null}{bizBatchProgress.total ? <div className={styles.batchVisualization} aria-label={`התקדמות ${bizBatchProgress.loaded} מתוך ${bizBatchProgress.total}`}><span><i style={{ width: `${Math.round(bizBatchProgress.loaded / bizBatchProgress.total * 100)}%` }} /></span><strong>{Math.round(bizBatchProgress.loaded / bizBatchProgress.total * 100)}%</strong></div> : null}</div></section>
    <section className={styles.runHistory} aria-labelledby="run-history-title"><header><div><h2 id="run-history-title">היסטוריית משיכות Biz</h2><p>מי הפעיל, איזה טווח נבדק, ומה הושלם בפועל. "לא נתמך" אינו תקלה: זה עסק שמקור Biz אינו מספק עבורו דוח. "תקלות אמיתיות" הן תשובה לא תקינה או מקור שלא היה זמין.</p></div><button type="button" className={styles.iconButton} onClick={() => void loadRunHistory()} aria-label="רענון היסטוריה"><RefreshCw size={16} /></button></header>{runHistory.length ? <div><table><thead><tr><th>זמן</th><th>משתמש</th><th>טווח</th><th>תחום</th><th>מצב</th><th>התקדמות</th><th>הצליחו</th><th>לא נתמכים</th><th>תקלות אמיתיות</th></tr></thead><tbody>{runHistory.map((run) => <tr key={run.jobId}><td><time dateTime={run.startedAt}>{new Date(run.startedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</time></td><td dir="ltr">{run.actorEmail}</td><td>{run.from} עד {run.till}</td><td>{scopeLabels[run.scope as keyof typeof scopeLabels] || run.scope}{run.forceRefresh ? " · רענון כפוי" : ""}</td><td><span className={styles.runState}>{reportRunStatus(run)}</span></td><td>{run.processed} / {run.total}</td><td>{run.succeeded}</td><td>{run.unsupported || 0}</td><td>{run.failed}</td></tr>)}</tbody></table></div> : <div className={styles.runHistoryEmpty}>עדיין אין משיכות מתועדות. ההפעלה הבאה תופיע כאן מיד.</div>}</section>
    {forbidden ? <section className={styles.state}><h2>נדרשת הרשאת מנהל</h2><p>הדוח אינו חושף מידע למשתמשים שאינם מורשים.</p><a href="/api/auth/google?returnTo=%2Fadmin%2Fbusiness-performance">כניסה עם Google</a></section> : null}
    {error ? <section className={styles.state} role="alert"><h2>לא הצלחנו לטעון את הדוח</h2><p>{error}</p><button type="button" onClick={() => void load()}>ניסיון חוזר</button></section> : null}
    {loading && !rows.length ? <section className={styles.state} role="status"><RefreshCw className={styles.spin} /><p>טוענים את משפך הביצועים...</p></section> : null}
    {!loading && !forbidden && !error ? <>
      <section className={styles.conversions} aria-labelledby="conversions-title" aria-busy={conversionLoading}><header><div><span>בדיקה עד למספר הטלפון</span><h2 id="conversions-title">פניות והזמנות לפי עסק</h2><p>לכל פנייה מוצגים המקור, הזמן, הטלפון והאם Biz מצא אחריה הזמנה פעילה באותו עסק. לחיצות טלפון ו־WhatsApp נשארות מדד עניין ואינן מופיעות כאן כשיחה.</p></div><div className={styles.conversionFilters}><label><span>עסק</span><select value={selectedPlaceId} onChange={(event) => setSelectedPlaceId(event.target.value)} disabled={!conversionRows.length}>{conversionRows.length ? conversionRows.map((row) => <option key={`${row.world}:${row.placeId}`} value={row.placeId}>{row.placeName} · {worldLabels[row.world] || row.world}</option>) : <option value="">אין עסקים נתמכים בתחום הזה</option>}</select></label><label><span>מקור</span><select value={contactSource} onChange={(event) => setContactSource(event.target.value as "all" | ConversionSource)}><option value="all">כל הפניות</option><option value="maskyoo">שיחות מסקיו</option><option value="whatsapp">WhatsApp</option><option value="form">טפסים</option></select></label><label><span>תוצאה</span><select value={contactConverted} onChange={(event) => setContactConverted(event.target.value as "all" | "yes" | "no")}><option value="all">הכול</option><option value="yes">נמצאה הזמנה</option><option value="no">לא נמצאה הזמנה</option></select></label></div></header>
        {conversionLoading ? <div className={styles.conversionState} role="status"><RefreshCw className={styles.spin} /><p>טוענים פניות והזמנות ממקור הספק...</p></div> : null}
        {conversionError ? <div className={styles.conversionState} role="alert"><p>{conversionError}</p><button type="button" onClick={() => void loadConversions()}>ניסיון חוזר</button></div> : null}
        {!conversionRows.length ? <div className={styles.conversionState}><p>{conversionFamilySupported ? "אין עסקים עם נתוני V במשפחה ובתקופה שנבחרו, ולכן אין כרגע עסק לבחירת המרות Biz." : "נתוני V של המשפחה מוצגים בדוח למטה. מקור ההמרות של Biz תומך כרגע בנופש, אירועים וחדרים לפי שעה בלבד."}</p></div> : null}
        {!conversionLoading && !conversionError && conversions ? <><div className={styles.conversionTotals}><article><span>פניות</span><strong>{num(conversions.summary.all.contacts)}</strong><small>{num(conversions.summary.all.identified)} ניתנות לזיהוי</small></article><article><span>הומרו להזמנה</span><strong>{num(conversions.summary.all.converted)}</strong><small>{conversions.summary.all.rate === null ? "אין בסיס לחישוב" : `${conversions.summary.all.rate.toLocaleString("he-IL")}% מהפניות`}</small></article><article><span>הזמנות מ־Biz</span><strong>{num(conversions.summary.all.orders)}</strong><small>{num(conversions.summary.all.customers)} לקוחות</small></article><article><span>הכנסה להזמנות</span><strong>{money(conversions.summary.all.revenue)}</strong><small>ללא ספירה כפולה</small></article><article><span><Clock3 size={15} /> זמן המרה חציוני</span><strong>{delay(conversions.summary.all.medianDelay)}</strong><small>{conversions.from} עד {conversions.till}</small></article></div><div className={styles.sourceTable}><table><thead><tr><th>מקור</th><th>פניות</th><th>הומרו</th><th>שיעור</th><th>הזמנות</th><th>הכנסה</th><th>זמן חציוני</th></tr></thead><tbody>{(["whatsapp", "maskyoo", "form"] as const).map((source) => { const item = conversions.summary[source]; return <tr key={source}><td data-label="מקור"><strong>{sourceLabels[source]}</strong></td><td data-label="פניות">{num(item.contacts)}</td><td data-label="הומרו">{num(item.converted)}</td><td data-label="שיעור">{item.rate === null ? "—" : `${item.rate.toLocaleString("he-IL")}%`}</td><td data-label="הזמנות">{num(item.orders)}</td><td data-label="הכנסה">{money(item.revenue)}</td><td data-label="זמן חציוני">{delay(item.medianDelay)}</td></tr>; })}</tbody></table></div><div className={styles.contactLedger}><header><div><h3>כל הפניות שנמצאו</h3><p>{num(conversions.count)} רשומות, מהחדשה לישנה</p></div><small>ההתאמה להזמנה נעשית אצל Biz לפי אותו עסק וטלפון מנורמל, ורק להזמנה פעילה שנוצרה אחרי הפנייה.</small></header>{conversions.contacts?.length ? <div className={styles.contactTable}><table><thead><tr><th>מקור וזמן</th><th>טלפון</th><th>פרטי הפנייה</th><th>תוצאה</th><th>הזמנה ראשונה</th><th>סכום</th><th>המשך</th></tr></thead><tbody>{conversions.contacts.map((contact) => <tr key={`${contact.source}:${contact.id}`}><td data-label="מקור וזמן"><strong>{sourceLabels[contact.source]}</strong><time>{contact.time}</time></td><td data-label="טלפון"><code dir="ltr">{contact.phone || "לא נמסר"}</code></td><td data-label="פרטי הפנייה"><span>{contactStatus(contact)}</span>{contact.source === "maskyoo" ? <small>משך {duration(contact.details.duration)}</small> : contact.source === "whatsapp" ? <small>{contact.details.date ? `תאריך מבוקש ${contact.details.date}` : "ללא תאריך"}{contact.details.guests ? ` · ${contact.details.guests} אורחים` : ""}</small> : <small>טופס באתר</small>}</td><td data-label="תוצאה">{contact.order ? <span className={styles.converted}><CheckCircle2 size={15} /> נמצאה הזמנה</span> : <span className={styles.notConverted}><XCircle size={15} /> לא נמצאה הזמנה</span>}</td><td data-label="הזמנה ראשונה">{contact.order ? <><strong dir="ltr">{contact.order.orderIDBySite || contact.order.orderID}</strong><small>{contact.order.created}</small></> : "—"}</td><td data-label="סכום">{contact.order ? <strong>{money(contact.order.price)}</strong> : "—"}</td><td data-label="המשך">{contact.order ? <><small>אחרי {delay(contact.delay)}</small>{contact.moreOrders.length ? <small>הזמנות נוספות: <b dir="ltr">{contact.moreOrders.join(", ")}</b></small> : <small>אין הזמנות נוספות</small>}</> : <small>אין התאמה להזמנה פעילה</small>}</td></tr>)}</tbody></table></div> : <div className={styles.contactEmpty}><PhoneCall size={24} /><strong>אין פניות במסנן הזה</strong><span>אפשר לשנות מקור, תוצאה או תקופה.</span></div>}</div><footer>עודכן אצל הספק: <time dateTime={conversions.created}>{new Date(conversions.created).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}</time>. פרטי דואר והודעות חופשיות אינם מועברים לדפדפן. נתוני Spa אינם נתמכים כרגע במקור ההמרות של Biz.</footer></> : null}
      </section>
      <section className={styles.tableCard}><header><div><h2>עסקים לפי ביצועים</h2><p>{filtered.length} עסקים בתקופה ובמסננים שנבחרו. לחיצה על כותרת ממיינת מהגבוה לנמוך ולהפך.</p></div><small>{basis === "arrival" ? "חיתוך לפי תאריך הגעה: רק להזמנות V שבהן נשמר תאריך הגעה" : "חיתוך לפי זמן יצירת הפעולה או הפנייה"} · אזור זמן ישראל</small></header>{filtered.length ? <div className={styles.tableWrap}><table><thead><tr>{([
        ["עסק", "placeName"], ["תחום", null], ["חשיפות", "impressions"], ["כניסות", "pageViews"], ["ייחודיים", "uniqueBrowsers"], ["לחיצת טלפון", "phoneClicks"], ["מעבר WhatsApp", "whatsappHandoffs"], ["שיחות מסקיו", "maskyoo"], ["פניות WhatsApp", "bizWhatsapp"], ["בקשות", "bookingRequests"], ["הזמנות מ־V", "viiBookings"], ["הזמנות מ־Biz", "bizOrders"], ["הכנסות Biz", "bizRevenue"], ["חוות דעת", "reviews"], ["פעולה / כניסה", "actionRate"],
      ] as const).map(([label, key]) => <th key={label} aria-sort={key && sort === key ? sortDirection === "desc" ? "descending" : "ascending" : undefined}>{key ? <button type="button" className={styles.sortHeader} onClick={() => chooseSort(key)} aria-pressed={sort === key}>{label}{sort === key ? sortDirection === "desc" ? <ArrowDown size={13} /> : <ArrowUp size={13} /> : null}</button> : label}</th>)}</tr></thead><tbody>{filtered.map((row) => { const biz = bizByPlace[row.placeId]; return <tr key={`${row.world}:${row.placeId}`}><td data-label="עסק"><strong>{row.placeName}</strong><code dir="ltr">{row.placeId}</code></td><td data-label="תחום"><span className={styles.world}>{worldLabels[row.world] || row.world}</span></td><td data-label="חשיפות">{num(row.impressions)}</td><td data-label="כניסות"><b>{num(row.pageViews)}</b></td><td data-label="ייחודיים">{num(row.uniqueBrowsers)}</td><td data-label="לחיצת טלפון">{num(row.phoneClicks)}</td><td data-label="מעבר WhatsApp">{num(row.whatsappHandoffs)}</td><td data-label="שיחות מסקיו">{conversionSupported(row) ? biz?.error ? "לא זמין" : biz ? num(biz.summary.maskyoo.contacts) : bizBatchProgress.running ? "טוען" : "לא נטען" : "לא נתמך"}</td><td data-label="פניות WhatsApp">{conversionSupported(row) ? biz?.error ? "לא זמין" : biz ? num(biz.summary.whatsapp.contacts) : bizBatchProgress.running ? "טוען" : "לא נטען" : "לא נתמך"}</td><td data-label="בקשות">{num(row.bookingRequests)}</td><td data-label="הזמנות מ־V">{num(row.viiBookings)}</td><td data-label="הזמנות מ־Biz">{conversionSupported(row) ? biz?.error ? "לא זמין" : biz ? num(biz.summary.all.orders) : bizBatchProgress.running ? "טוען" : "לא נטען" : "לא נתמך במקור"}</td><td data-label="הכנסות Biz">{conversionSupported(row) ? biz?.error ? "לא זמין" : biz ? money(biz.summary.all.revenue) : "לא נטען" : "לא נתמך"}</td><td data-label="חוות דעת">{num(row.reviews)}</td><td data-label="פעולה / כניסה"><div className={styles.rate}><span><i style={{ width: `${Math.min(100, percent(actions(row), row.pageViews))}%` }} /></span><b>{row.pageViews ? `${percent(actions(row), row.pageViews)}%` : "—"}</b></div></td></tr>; })}</tbody></table></div> : <div className={styles.empty}><BarChart3 size={30} /><h2>אין נתונים במסנן הזה</h2><p>לא נמצאו נתונים בטווח ובבסיס התאריך שנבחרו.</p><button type="button" onClick={() => { setQuery(""); setWorld("all"); setBasis("created"); setFrom(today); setTill(today); }}>איפוס מסננים</button></div>}</section>
    </> : null}
  </main>;
}
