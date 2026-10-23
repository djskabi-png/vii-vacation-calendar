"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type Booking = { id: string; world: string; placeId: string; placeName: string; destination: string;
  status: string; supplierId: string | null; createdAt: string; updatedAt: string };
type Review = { id: string; subjectType: string; subjectId: string; placeName: string; author: string;
  rating: number; status: string; createdAt: string; updatedAt: string };
type ManualCheck = { id: string; date: string; reporter: string; bookingDelivered: boolean;
  reviewDelivered: boolean; linkedToReferences: boolean };
type Report = { bookings: Booking[]; reviews: Review[]; manualChecks: ManualCheck[];
  bookingTotal: number; reviewTotal: number; offset: number; warnings?: string[] };

const cell = { padding: "10px 8px", borderBottom: "1px solid #e0e6e4", whiteSpace: "nowrap" as const };
const statusText: Record<string, string> = {
  supplier_accepted: "הספק החזיר אישור", lead_service_accepted: "מערכת הלידים קיבלה; מסירה לספק לא אומתה",
  status_unknown: "תוצאת שליחה לא ידועה; לבדוק לפי אסמכתה, בלי לשלוח שוב",
  pending: "ממתינה לטיפול ב-VII", approved: "אושרה ב-VII", rejected: "נדחתה ב-VII",
};
function date(value: string) { return new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }); }

export default function OperationsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [query, setQuery] = useState("");
  const refresh = useCallback(async (offset = 0, search = "") => {
    setLoading(true);
    setError("");
    setForbidden(false);
    try {
      const params = new URLSearchParams({ offset: String(offset) });
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/admin/operations/?${params}`, { cache: "no-store" });
      if (response.status === 403) setForbidden(true);
      if (!response.ok) throw new Error(response.status === 403 ? "יש להתחבר לחשבון מנהל מורשה." : "לא ניתן לטעון את הדוח כרגע.");
      const next = await response.json() as Report;
      setReport((current) => offset && current ? { ...next,
        bookings: [...current.bookings, ...next.bookings], reviews: [...current.reviews, ...next.reviews] } : next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "לא ניתן לטעון את הדוח כרגע."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(0, ""), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return <main dir="rtl" style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 20px", minHeight: "80vh" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div><h1 style={{ margin: 0, fontSize: "1.7rem" }}>הזמנות וחוות דעת</h1>
        <p>יומן בדיקה של פעולות VII. אישור של מערכת לידים אינו הוכחה שהספק קיבל את הבקשה.</p>
        <a href="/admin/catalog-sync">סנכרון קטלוגים</a></div>
      <button type="button" onClick={() => void refresh(0, query)} disabled={loading} aria-label="רענון הדוח" title="רענון הדוח"><RefreshCw size={18} aria-hidden="true" /></button>
    </header>
    <form onSubmit={(event) => { event.preventDefault(); void refresh(0, query); }} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBlock: 16 }}>
      <label htmlFor="operation-query">חיפוש לפי אסמכתה או מקום</label>
      <input id="operation-query" value={query} onChange={(event) => setQuery(event.target.value)} style={{ minWidth: 240 }} />
      <button type="submit" disabled={loading}>חיפוש</button>
    </form>
    {report?.warnings?.length ? <p role="alert">חלק ממקורות הדוח אינם זמינים כרגע. הנתונים הזמינים מוצגים בלי להסתיר את התקלה.</p> : null}
    {report && !loading && !forbidden && !error ? report.manualChecks.map((check) =>
      <aside key={check.id} aria-label="בדיקה ידנית קודמת" style={{ borderInlineStart: "3px solid #167b78", paddingInlineStart: 14, marginBlock: 20 }}>
        <strong>בדיקה ידנית, {new Date(check.date + "T12:00:00Z").toLocaleDateString("he-IL")}</strong>
        <p>{check.reporter} דיווח שהזמנת הבדיקה וחוות הדעת הגיעו לספק. {check.linkedToReferences ? "" : "לא נמסרו מזהי רשומות, ולכן הבדיקה אינה משויכת להזמנה או לחוות דעת מסוימות."}</p>
      </aside>) : null}
    {loading ? <p role="status">טוענים נתונים...</p> : error ? <div><p role="alert">{error}</p>{forbidden ? <a href="/api/auth/google?returnTo=%2Fadmin%2Foperations">כניסה עם Google</a> : null}</div> : report ? <>
      <section aria-labelledby="bookings-title"><h2 id="bookings-title">בקשות הזמנה</h2>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}><thead><tr>
          {['נוצרה', 'אסמכתה', 'תחום', 'מקום', 'יעד', 'מצב', 'מזהה ספק'].map((label) => <th key={label} scope="col" style={cell}>{label}</th>)}
        </tr></thead><tbody>{report.bookings.map((item) => <tr key={item.id}>
          <td style={cell}>{date(item.createdAt)}</td><td style={cell}><code dir="ltr">{item.id}</code></td>
          <td style={cell}>{item.world}</td><td style={cell}>{item.placeName}</td>
          <td style={cell}>{item.destination === "sergey" ? "סרגיי" : "מערכת לידים"}</td>
          <td style={cell}>{statusText[item.status] || item.status}</td><td style={cell}>{item.supplierId || "—"}</td>
        </tr>)}</tbody></table></div>
        {!report.bookings.length ? <p>לא נמצאו בקשות הזמנה.</p> : null}
      </section>
      <section aria-labelledby="reviews-title" style={{ marginTop: 32 }}><h2 id="reviews-title">חוות דעת שנשלחו ל-VII</h2>
        <p>מצב הביקורת כאן הוא מצב השמירה והטיפול ב-VII. אין ביומן הזה אישור מסירה לספק.</p>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}><thead><tr>
          {['נוצרה', 'מזהה', 'מקום', 'כותב', 'דירוג', 'מצב ב-VII'].map((label) => <th key={label} scope="col" style={cell}>{label}</th>)}
        </tr></thead><tbody>{report.reviews.map((item) => <tr key={item.id}>
          <td style={cell}>{date(item.createdAt)}</td><td style={cell}><code dir="ltr">{item.id}</code></td>
          <td style={cell}>{item.placeName}</td><td style={cell}>{item.author}</td><td style={cell}>{item.rating}/5</td>
          <td style={cell}>{statusText[item.status] || item.status}</td>
        </tr>)}</tbody></table></div>
        {!report.reviews.length ? <p>לא נמצאו חוות דעת.</p> : null}
      </section>
      {(report.bookings.length < report.bookingTotal || report.reviews.length < report.reviewTotal) ?
        <button type="button" onClick={() => void refresh(report.offset + 100, query)} disabled={loading} style={{ marginTop: 24 }}>עוד רשומות</button> : null}
    </> : null}
  </main>;
}
