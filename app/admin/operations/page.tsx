"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import styles from "./operations.module.css";

type Booking = { id: string; world: string; placeId: string; placeName: string; destination: string;
  status: string; supplierId: string | null; createdAt: string; updatedAt: string; arrivalDate: string | null;
  departureDate: string | null; amount: number | null; currency: string | null };
type Review = { id: string; subjectType: string; subjectId: string; placeName: string; author: string;
  rating: number; status: string; createdAt: string; updatedAt: string };
type ManualCheck = { id: string; date: string; reporter: string; bookingDelivered: boolean;
  reviewDelivered: boolean; linkedToReferences: boolean };
type Report = { bookings: Booking[]; reviews: Review[]; manualChecks: ManualCheck[];
  bookingTotal: number; reviewTotal: number; offset: number; warnings?: string[]; integrationStatus?: { spa: { requestCapture: string; providerBookingConfirmation: string; conversionMeasurement: string; requiredFromGal: string[] } } };

const cell = { padding: "10px 8px", borderBottom: "1px solid #e0e6e4", whiteSpace: "nowrap" as const };
const statusText: Record<string, string> = {
  submission_started: "נרשמה לפני שליחה; ממתינה לתוצאת המקור",
  supplier_pending: "הספק קיבל וממתין לאישור", supplier_cancelled: "הספק דיווח על ביטול", supplier_rejected: "הספק דחה את ההזמנה",
  supplier_accepted: "הספק החזיר אישור", lead_service_accepted: "מערכת הלידים קיבלה; מסירה לספק לא אומתה",
  lead_service_rejected: "מערכת הלידים דחתה את הבקשה",
  status_unknown: "תוצאת שליחה לא ידועה; לבדוק לפי אסמכתה, בלי לשלוח שוב",
  pending: "ממתינה לטיפול ב-V", approved: "אושרה ב-V", rejected: "נדחתה ב-V",
};
function date(value: string) { return new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }); }

export default function OperationsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState("");
  const [world, setWorld] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [till, setTill] = useState("");
  const [moderating, setModerating] = useState("");
  const refresh = useCallback(async (offset = 0, search = "") => {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const params = new URLSearchParams({ offset: String(offset) });
      if (search.trim()) params.set("q", search.trim());
      if (world) params.set("world", world);
      if (status) params.set("status", status);
      if (from) params.set("from", from);
      if (till) params.set("till", till);
      const response = await fetch(`/api/admin/operations/?${params}`, { cache: "no-store" });
      if (response.status === 403) setForbidden(true);
      if (!response.ok) throw new Error(response.status === 403 ? "יש להתחבר לחשבון מנהל מורשה." : "לא ניתן לטעון את הדוח כרגע.");
      const next = await response.json() as Report;
      setReport((current) => offset && current ? { ...next,
        bookings: [...current.bookings, ...next.bookings], reviews: [...current.reviews, ...next.reviews] } : next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "לא ניתן לטעון את הדוח כרגע."); }
    finally { setLoading(false); }
  }, [world, status, from, till]);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(0, ""), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const moderateReview = useCallback(async (id: string, status: "approved" | "rejected") => {
    setModerating(id);
    setError("");
    try {
      const response = await fetch("/api/admin/operations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!response.ok) throw new Error(response.status === 403 ? "אין הרשאה לעדכון חוות הדעת." : "לא הצלחנו לעדכן את חוות הדעת.");
      setReport((current) => current ? { ...current, reviews: current.reviews.map((review) => review.id === id ? { ...review, status } : review) } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "לא הצלחנו לעדכן את חוות הדעת."); }
    finally { setModerating(""); }
  }, []);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return <main dir="rtl" className={styles.page}>
    <header className={styles.hero}>
      <div><h1 style={{ margin: 0, fontSize: "1.7rem" }}>הזמנות וחוות דעת</h1>
        <p>יומן בדיקה של פעולות V. אישור של מערכת לידים אינו הוכחה שהספק קיבל את הבקשה.</p>
        <a href="/admin/catalog-sync">סנכרון קטלוגים</a></div>
      <button className={styles.refresh} type="button" onClick={() => void refresh(0, query)} disabled={loading} aria-label="רענון הדוח" title="רענון הדוח"><RefreshCw size={18} aria-hidden="true" /></button>
    </header>
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); void refresh(0, query); }}>
      <label htmlFor="operation-query">חיפוש לפי אסמכתה או מקום</label>
      <input id="operation-query" value={query} onChange={(event) => setQuery(event.target.value)} style={{ minWidth: 240 }} />
      <select aria-label="תחום הזמנה" value={world} onChange={(event) => setWorld(event.target.value)}><option value="">כל התחומים</option><option value="vacation">נופש</option><option value="spa">ספא</option><option value="events">אירועים</option><option value="hourly">חדרים לפי שעה</option></select>
      <select aria-label="מצב הזמנה" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">כל המצבים</option>{Object.entries(statusText).filter(([key]) => !["pending", "approved", "rejected"].includes(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <label>מתאריך <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>עד תאריך <input type="date" value={till} onChange={(event) => setTill(event.target.value)} /></label>
      <button type="submit" disabled={loading}>חיפוש</button>
    </form>
    {report ? <section className={styles.summary} aria-label="סיכום תפעול"><button type="button" onClick={() => jump("bookings-title")}><strong>{report.bookingTotal.toLocaleString("he-IL")}</strong><span>בקשות הזמנה, מעבר ליומן</span></button><button type="button" onClick={() => jump("reviews-title")}><strong>{report.reviewTotal.toLocaleString("he-IL")}</strong><span>חוות דעת, מעבר לטיפול</span></button><article><strong>{report.bookings.filter((item) => item.status === "status_unknown" || item.status === "submission_started").length}</strong><span>דורשות אימות מקור בעמוד הנוכחי</span></article></section> : null}
    {report?.warnings?.length ? <p role="alert">חלק ממקורות הדוח אינם זמינים כרגע. הנתונים הזמינים מוצגים בלי להסתיר את התקלה.</p> : null}
    {report?.integrationStatus?.spa ? <aside className={styles.integrationTruth}><strong>מצב חיבור הזמנות ספא</strong><p>בקשת ספא נשמרת כעת ביומן לפני השליחה למערכת הלידים. קבלה במערכת הלידים אינה מוצגת כאישור הזמנה מהספק.</p><p>כדי להציג הזמנה מאושרת וביטול בזמן אמת, גל צריך לספק: {report.integrationStatus.spa.requiredFromGal.join("; ")}.</p><small>תג המדידה נשלח רק לאחר תשובת הצלחה מהשרת, עם אסמכתה וללא ספירה כפולה. הוא אינו הופך ליד להזמנה מאושרת.</small></aside> : null}
    {report && !loading && !forbidden && !error ? report.manualChecks.map((check) =>
      <aside key={check.id} aria-label="בדיקה ידנית קודמת" style={{ borderInlineStart: "3px solid #167b78", paddingInlineStart: 14, marginBlock: 20 }}>
        <strong>בדיקה ידנית, {new Date(check.date + "T12:00:00Z").toLocaleDateString("he-IL")}</strong>
        <p>{check.reporter} דיווח שהזמנת הבדיקה וחוות הדעת הגיעו לספק. {check.linkedToReferences ? "" : "לא נמסרו מזהי רשומות, ולכן הבדיקה אינה משויכת להזמנה או לחוות דעת מסוימות."}</p>
      </aside>) : null}
    {loading ? <p role="status">טוענים נתונים...</p> : error ? <div><p role="alert">{error}</p>{forbidden ? <a href="/api/auth/google?returnTo=%2Fadmin%2Foperations">כניסה עם Google</a> : null}</div> : report ? <>
      <section className={styles.panel} aria-labelledby="bookings-title"><h2 id="bookings-title">בקשות הזמנה</h2>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}><thead><tr>
          {['נוצרה', 'אסמכתה', 'תחום', 'מקום', 'מועד מבוקש', 'יעד', 'מצב', 'מזהה ספק', 'סכום'].map((label) => <th key={label} scope="col" style={cell}>{label}</th>)}
        </tr></thead><tbody>{report.bookings.map((item) => <tr key={item.id}>
          <td style={cell}>{date(item.createdAt)}</td><td style={cell}><code dir="ltr">{item.id}</code></td>
          <td style={cell}>{item.world}</td><td style={cell}>{item.placeName}</td>
          <td style={cell}>{item.arrivalDate ? `${item.arrivalDate}${item.departureDate ? ` עד ${item.departureDate}` : ""}` : "לא נמסר"}</td>
          <td style={cell}>{item.destination === "sergey" ? "סרגיי" : "מערכת לידים"}</td>
          <td style={cell}><span className={styles.operationStatus} data-status={item.status}>{statusText[item.status] || item.status}</span></td><td style={cell}>{item.supplierId || "—"}</td><td style={cell}>{item.amount != null ? `${item.amount.toLocaleString("he-IL")} ${item.currency || "ILS"}` : "לא נמסר"}</td>
        </tr>)}</tbody></table></div>
        {!report.bookings.length ? <p>לא נמצאו בקשות הזמנה.</p> : null}
      </section>
      <section className={styles.panel} aria-labelledby="reviews-title"><h2 id="reviews-title">חוות דעת שנשלחו ל-V</h2>
        <p>מצב הביקורת כאן הוא מצב השמירה והטיפול ב-V. אין ביומן הזה אישור מסירה לספק.</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}><thead><tr>
          {['נוצרה', 'מזהה', 'מקום', 'כותב', 'דירוג', 'מצב ב-V', 'טיפול'].map((label) => <th key={label} scope="col" style={cell}>{label}</th>)}
        </tr></thead><tbody>{report.reviews.map((item) => <tr key={item.id}>
          <td style={cell}>{date(item.createdAt)}</td><td style={cell}><code dir="ltr">{item.id}</code></td>
          <td style={cell}>{item.placeName}</td><td style={cell}>{item.author}</td><td style={cell}>{item.rating}/5</td>
          <td style={cell}>{statusText[item.status] || item.status}</td><td style={cell}>{item.status === "pending" ? <span style={{ display: "inline-flex", gap: 8 }}><button type="button" disabled={moderating === item.id} onClick={() => void moderateReview(item.id, "approved")}><Check size={16} aria-hidden="true" /> אישור</button><button type="button" disabled={moderating === item.id} onClick={() => void moderateReview(item.id, "rejected")}><X size={16} aria-hidden="true" /> דחייה</button></span> : "טופל"}</td>
        </tr>)}</tbody></table></div>
        {!report.reviews.length ? <p>לא נמצאו חוות דעת.</p> : null}
      </section>
      {(report.bookings.length < report.bookingTotal || report.reviews.length < report.reviewTotal) ?
        <button type="button" onClick={() => void refresh(report.offset + 100, query)} disabled={loading} style={{ marginTop: 24 }}>עוד רשומות</button> : null}
    </> : null}
  </main>;
}
