"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";
import { BarChart3, Check, ChevronDown, ChevronUp, Eye, GripVertical, MessageCircle, MousePointerClick, Phone, Search, Settings2, Sparkles, Star, TrendingUp, Users, X } from "lucide-react";
import { DEFAULT_ACTIVE_HIGHLIGHTS, type AdminHighlightId } from "../lib/admin-highlight-preferences.ts";
import styles from "./admin.module.css";

type HighlightData = {
  periodDays: number;
  business: { impressions: number; pageViews: number; phoneReveals: number; whatsappLeads: number; bookingRequests: number; uniqueBrowsers: number } | null;
  search: { searches: number; uniqueSessions: number; pending: number; published: number; zeroResults: number } | null;
  totals: { bookings: number | null; reviews: number | null; whatsappLeads: number | null };
  catalog: Array<{ world: string; activeCount: number }> | null;
  biz?: { calls: number; whatsapp: number; orders: number; revenue: number; savedAt: string | null; coverage: number } | null;
};

type Card = { id: AdminHighlightId; title: string; value: string; note: string; icon: typeof Eye; tone?: "success" | "warning" };
const number = (value: number | null | undefined) => value == null ? "לא זמין" : value.toLocaleString("he-IL");
const rate = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : "—";
const per = (actions: number, outcomes: number) => actions > 0 && outcomes > 0 && actions >= outcomes ? `1 לכל ${Math.max(1, Math.round(actions / outcomes))}` : "—";

function catalog(data: HighlightData, world: string) { return data.catalog?.find((row) => row.world === world)?.activeCount ?? null; }

function cardCatalog(data: HighlightData): Card[] {
  const business = data.business || { impressions: 0, pageViews: 0, phoneReveals: 0, whatsappLeads: 0, bookingRequests: 0, uniqueBrowsers: 0 };
  const search = data.search || { searches: 0, uniqueSessions: 0, pending: 0, published: 0, zeroResults: 0 };
  const actions = business.phoneReveals + business.whatsappLeads + business.bookingRequests;
  return [
    { id: "impressions", title: "חשיפות לעסקים", value: number(business.impressions), note: `${data.periodDays} הימים האחרונים`, icon: Eye },
    { id: "entry_rate", title: "כניסות מתוך חשיפה", value: rate(business.pageViews, business.impressions), note: `${number(business.pageViews)} כניסות`, icon: MousePointerClick },
    { id: "action_rate", title: "פעולה מתוך כניסה", value: rate(actions, business.pageViews), note: "טלפון, וואטסאפ או בקשת הזמנה", icon: TrendingUp, tone: "success" },
    { id: "unique_browsers", title: "דפדפנים ייחודיים", value: number(business.uniqueBrowsers), note: "לא אומדן של אנשים", icon: Users, tone: "warning" },
    { id: "phone_to_booking", title: "הזמנה מכל כמה שיחות", value: data.biz ? per(data.biz.calls, data.biz.orders) : "לא נשמר", note: data.biz ? `מבוסס Biz · ${data.biz.coverage} עסקים` : "דורש דוח Biz שמור לטווח", icon: Phone },
    { id: "whatsapp_to_booking", title: "הזמנה מכל כמה פניות WhatsApp", value: data.biz ? per(data.biz.whatsapp, data.biz.orders) : "לא נשמר", note: data.biz ? "יחס אנשי קשר להזמנות Biz" : "דורש דוח Biz שמור לטווח", icon: MessageCircle },
    { id: "actions", title: "פעולות עם כוונת הזמנה", value: number(actions), note: "טלפון, ליד שמור ובקשת הזמנה", icon: Sparkles },
    { id: "booking_requests", title: "בקשות הזמנה מ־V", value: number(business.bookingRequests), note: `${data.periodDays} הימים האחרונים`, icon: Star },
    { id: "page_views", title: "כניסות לעמודי עסקים", value: number(business.pageViews), note: `${data.periodDays} הימים האחרונים`, icon: BarChart3 },
    { id: "phone_reveals", title: "גילויי מספר טלפון", value: number(business.phoneReveals), note: "פעולות שנמדדו ב־V", icon: Phone },
    { id: "whatsapp_leads", title: "לידי WhatsApp שמורים", value: number(business.whatsappLeads), note: "פרטים שנשמרו לפני המעבר", icon: MessageCircle },
    { id: "searches", title: "חיפושים באתר", value: number(search.searches), note: `${data.periodDays} הימים האחרונים`, icon: Search },
    { id: "zero_result_rate", title: "חיפושים ללא תוצאה", value: rate(search.zeroResults, search.searches), note: `${number(search.zeroResults)} חיפושים`, icon: Search, tone: search.zeroResults ? "warning" : undefined },
    { id: "unique_search_sessions", title: "סשנים שחיפשו", value: number(search.uniqueSessions), note: "סשנים ייחודיים, לא אנשים", icon: Users },
    { id: "total_bookings", title: "הזמנות V שנשמרו", value: number(data.totals.bookings), note: "מצטבר במערכת התפעול", icon: Star },
    { id: "total_reviews", title: "חוות דעת במערכת", value: number(data.totals.reviews), note: "מצטבר, כולל ממתינות", icon: Star },
    { id: "zero_results", title: "מספר חיפושים ללא תוצאה", value: number(search.zeroResults), note: `${data.periodDays} הימים האחרונים`, icon: Search },
    { id: "pending_pages", title: "עמודים שממתינים לטיפול", value: number(search.pending), note: "בתור התוכן", icon: BarChart3 },
    { id: "published_pages", title: "עמודי חיפוש שפורסמו", value: number(search.published), note: "בעמודי החיפוש המנוהלים", icon: BarChart3 },
    { id: "total_whatsapp_leads", title: "כל לידי WhatsApp", value: number(data.totals.whatsappLeads), note: "מצטבר במערכת", icon: MessageCircle },
    { id: "catalog_vacations", title: "מקומות נופש פעילים", value: number(catalog(data, "vacations")), note: "בדור הקטלוג המאושר", icon: Star },
    { id: "catalog_events", title: "מקומות אירועים פעילים", value: number(catalog(data, "events")), note: "בדור הקטלוג המאושר", icon: Star },
    { id: "catalog_rooms", title: "חדרים לפי שעה פעילים", value: number(catalog(data, "rooms")), note: "בדור הקטלוג המאושר", icon: Star },
    { id: "catalog_spa", title: "מתחמי ספא פעילים", value: number(catalog(data, "spa")), note: "בדור הקטלוג המאושר", icon: Star },
  ];
}

export function AdminHighlightBoard({ data }: { data: HighlightData }) {
  const [order, setOrder] = useState<AdminHighlightId[]>([...DEFAULT_ACTIVE_HIGHLIGHTS]);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<AdminHighlightId | null>(null);
  const orderRef = useRef(order);
  const cards = useMemo(() => cardCatalog(data), [data]);
  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  useEffect(() => { void fetch("/api/admin/highlight-preferences", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) return; const saved = await response.json() as { order?: AdminHighlightId[]; expanded?: boolean };
    if (Array.isArray(saved.order) && saved.order.length) { setOrder(saved.order); orderRef.current = saved.order; } setExpanded(saved.expanded === true);
  }).catch(() => undefined); }, []);
  async function persist(nextOrder = order, nextExpanded = expanded) {
    setSaving(true);
    try { await fetch("/api/admin/highlight-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: nextOrder, expanded: nextExpanded }) }); }
    finally { setSaving(false); }
  }
  function toggle(id: AdminHighlightId) {
    const next = order.includes(id) ? order.filter((item) => item !== id) : order.length < 16 ? [...order, id] : order;
    orderRef.current = next; setOrder(next); void persist(next, expanded);
  }
  function reorder(source: AdminHighlightId, target: AdminHighlightId) {
    const current = orderRef.current; const from = current.indexOf(source); const to = current.indexOf(target);
    if (from < 0 || to < 0 || from === to) return current;
    const next = [...current]; const [item] = next.splice(from, 1); next.splice(to, 0, item);
    orderRef.current = next; setOrder(next); return next;
  }
  function pointerMove(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-highlight-sort-id]")?.dataset.highlightSortId as AdminHighlightId | undefined;
    if (target) reorder(dragging, target);
  }
  function pointerEnd(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null); void persist(orderRef.current, expanded);
  }
  function dragStart(event: DragEvent<HTMLElement>, id: AdminHighlightId) {
    setDragging(id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id);
  }
  function drop(event: DragEvent<HTMLElement>, target: AdminHighlightId) {
    event.preventDefault(); const source = (dragging || event.dataTransfer.getData("text/plain")) as AdminHighlightId;
    if (source) reorder(source, target); setDragging(null);
  }
  const visible = order.slice(0, expanded ? 16 : 8).flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
  const activeCards = order.flatMap((id) => byId.get(id) ? [byId.get(id)!] : []);
  const maxSignal = Math.max(1, data.business?.phoneReveals || 0, data.business?.whatsappLeads || 0, data.business?.bookingRequests || 0, data.biz?.orders || 0);
  const conversionSignals = [
    { label: "טלפון", value: data.business?.phoneReveals ?? 0, color: "#2387d8" },
    { label: "WhatsApp", value: data.business?.whatsappLeads ?? 0, color: "#20a66a" },
    { label: "בקשות V", value: data.business?.bookingRequests ?? 0, color: "#9967d8" },
    { label: "הזמנות Biz", value: data.biz?.orders ?? null, color: "#f09b35" },
  ];
  return <section className={styles.highlightBoard} aria-labelledby="personal-highlights-title">
    <header><div><h2 id="personal-highlights-title">התובנות שלי</h2><p>16 מדדים אישיים מתוך קטלוג של 24. שתי השורות הראשונות פתוחות, ושתי שורות נוספות לפי בחירה.</p></div><button type="button" onClick={() => setEditing(true)}><Settings2 size={16} /> סידור התובנות</button></header>
    <div className={styles.metrics} data-expanded={expanded}>{visible.map(({ id, title, value, note, icon: Icon, tone }) => <article key={id} data-tone={tone}><span className={styles.metricIcon}><Icon size={17} /></span><small>{title}</small><strong>{value}</strong><span>{note}</span></article>)}</div>
    <button className={styles.highlightExpand} type="button" aria-expanded={expanded} onClick={() => { const next = !expanded; setExpanded(next); void persist(order, next); }}>{expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}{expanded ? "סגירת שורות 3 ו־4" : "פתיחת שורות 3 ו־4"}</button>
    <section className={styles.conversionPulse} aria-labelledby="conversion-pulse-title"><header><div><span><Sparkles size={15} /> חי מהמערכת</span><h3 id="conversion-pulse-title">דופק ההמרות</h3></div><small>{data.biz?.savedAt ? `Biz נשמר ${new Date(data.biz.savedAt).toLocaleDateString("he-IL")}` : "נתוני Biz יוצגו לאחר שמירת דוח"}</small></header><div>{conversionSignals.map((signal) => <article key={signal.label}><span>{signal.label}</span><div aria-hidden="true"><i style={{ "--signal-height": `${signal.value == null ? 8 : Math.max(12, Math.round(signal.value / maxSignal * 100))}%`, "--signal-color": signal.color } as CSSProperties} /></div><strong>{signal.value == null ? "לא נשמר" : number(signal.value)}</strong></article>)}</div></section>
    {editing ? <div className={styles.highlightBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(false); }}><section className={styles.highlightDialog} role="dialog" aria-modal="true" aria-labelledby="highlight-editor-title"><header><div><h2 id="highlight-editor-title">המרכז האישי שלי</h2><p>גוררים את הכרטיסים למקום הרצוי. השינוי נשמר אוטומטית לחשבון שלך.</p></div><button type="button" onClick={() => setEditing(false)} aria-label="סגירה"><X size={18} /></button></header><div className={styles.highlightEditorBody}><section className={styles.highlightOrder} aria-labelledby="highlight-order-title"><div className={styles.highlightEditorTitle}><div><h3 id="highlight-order-title">16 התובנות הפעילות</h3><p>הסדר כאן הוא הסדר שיופיע בלוח שלך.</p></div><span><GripVertical size={15} /> גרירה לשינוי סדר</span></div><div>{activeCards.map((card, index) => <article key={card.id} draggable data-highlight-sort-id={card.id} data-dragging={dragging === card.id} onDragStart={(event) => dragStart(event, card.id)} onDragOver={(event) => { event.preventDefault(); if (dragging) reorder(dragging, card.id); }} onDrop={(event) => drop(event, card.id)} onDragEnd={() => { setDragging(null); void persist(orderRef.current, expanded); }} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}><button type="button" className={styles.highlightDragHandle} aria-label={`גרירת ${card.title}`} onPointerDown={(event) => { setDragging(card.id); event.currentTarget.setPointerCapture(event.pointerId); }}><GripVertical size={18} /></button><b>{index + 1}</b><span><strong>{card.title}</strong><small>{card.note}</small></span><button type="button" className={styles.highlightRemove} onClick={() => toggle(card.id)} aria-label={`הסרת ${card.title}`}><X size={15} /></button></article>)}</div></section><section aria-labelledby="highlight-catalog-title"><div className={styles.highlightEditorTitle}><div><h3 id="highlight-catalog-title">קטלוג התובנות</h3><p>24 אפשרויות. עד 16 יכולות להיות פעילות.</p></div><span>{order.length}/16 פעילות</span></div><div className={styles.highlightCatalog}>{cards.map((card) => { const active = order.includes(card.id); return <article key={card.id} data-active={active}><button type="button" className={styles.highlightToggle} onClick={() => toggle(card.id)} disabled={!active && order.length >= 16} aria-pressed={active}><span>{active ? <><Check size={12} /> פעיל</> : "הוספה"}</span><strong>{card.title}</strong><small>{card.note}</small></button></article>; })}</div></section></div><footer><span>{saving ? "שומר את המרכז האישי שלך..." : "כל שינוי נשמר אוטומטית לחשבון המחובר"}</span><button type="button" onClick={() => setEditing(false)}>סיום</button></footer></section></div> : null}
  </section>;
}
