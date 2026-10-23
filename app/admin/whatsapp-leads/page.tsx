"use client";

import { useEffect, useState } from "react";

type Lead = {
  submissionId: string;
  reference: string;
  world: string;
  placeId: string;
  placeName: string;
  visitorName: string;
  visitorPhone: string;
  requestedDate: string;
  requestedTill: string | null;
  guests: string | null;
  serviceName: string | null;
  sourcePage: string | null;
  handoffStartedAt: string | null;
  createdAt: string;
};

type Report = { total: number; byWorld: { world: string; count: number }[]; leads: Lead[] };

export default function WhatsAppLeadsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const [from, setFrom] = useState("");
  const [till, setTill] = useState(today);
  const [world, setWorld] = useState("");
  const [query, setQuery] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    setNeedsAuth(false);
    try {
      const params = new URLSearchParams({ till, limit: "500" });
      if (from) params.set("from", from);
      if (world) params.set("world", world);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/whatsapp-leads?${params}`, { cache: "no-store" });
      if (!response.ok) {
        if (response.status === 403) setNeedsAuth(true);
        throw new Error(response.status === 403 ? "אין הרשאה לצפות בפניות. יש להתחבר לחשבון מנהל מורשה." : "לא ניתן לטעון את הפניות כרגע.");
      }
      setReport(await response.json() as Report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן לטעון את הפניות כרגע.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  // Initial load only; filters are submitted explicitly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <main dir="rtl" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px", minHeight: "80vh" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div><h1 style={{ margin: 0, fontSize: "1.8rem" }}>פניות וואטסאפ</h1><p>פניות שנשמרו ומעבר ל־WhatsApp שנרשם. המעבר אינו הוכחה שהלקוח שלח את ההודעה.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading}>רענון</button>
    </header>
    <form onSubmit={(event) => { event.preventDefault(); void refresh(); }} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", margin: "22px 0", padding: 16, border: "1px solid #dce8e9", borderRadius: 16, background: "#fff" }}>
      <label>מתאריך<input type="date" value={from} max={till} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>עד תאריך<input type="date" value={till} min={from || undefined} max={today} onChange={(event) => setTill(event.target.value)} /></label>
      <label>עולם<select value={world} onChange={(event) => setWorld(event.target.value)}><option value="">כל העולמות</option><option value="vacation">נופש</option><option value="events">אירועים</option><option value="hourly">חדרים לפי שעה</option><option value="spa">ספא</option><option value="providers">ספקים</option></select></label>
      <label>חיפוש<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="עסק, שם, טלפון או אסמכתה" /></label>
      <button type="submit" disabled={loading}>הצגת דוח</button>
    </form>
    {loading ? <p role="status">טוענים פניות...</p> : error ? <div><p role="alert">{error}</p>{needsAuth ? <a href="/api/auth/google?returnTo=%2Fadmin%2Fwhatsapp-leads">כניסה עם Google</a> : null}</div> : report ? <>
      <section aria-label="סיכום פניות" style={{ display: "flex", gap: 24, flexWrap: "wrap", borderBlock: "1px solid #dce4e2", padding: "18px 0" }}>
        <strong>סך פניות: {report.total}</strong>
        {report.byWorld.map((item) => <span key={item.world}>{item.world}: {item.count}</span>)}
      </section>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
        <thead><tr>{["נשמר", "מעבר ל־WhatsApp", "אסמכתה", "עולם", "מקום", "שם", "טלפון", "תאריך", "אורחים", "שירות", "מקור"].map((label) => <th key={label} scope="col" style={{ padding: 10, borderBottom: "1px solid #dce4e2" }}>{label}</th>)}</tr></thead>
        <tbody>{report.leads.map((lead) => <tr key={lead.submissionId}>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{new Date(lead.createdAt).toLocaleString("he-IL")}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.handoffStartedAt ? <strong style={{ color: "#08775f" }}>נפתח מעבר<br /><small>{new Date(lead.handoffStartedAt).toLocaleString("he-IL")}</small></strong> : <span style={{ color: "#a13f32" }}>לא תועד</span>}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.reference}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.world}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.placeName}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.visitorName}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef", direction: "ltr" }}>{lead.visitorPhone}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.requestedDate}{lead.requestedTill ? ` עד ${lead.requestedTill}` : ""}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.guests || ""}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.serviceName || "—"}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.sourcePage ? <a href={lead.sourcePage}>עמוד מקור</a> : "—"}</td>
        </tr>)}</tbody>
      </table></div>
      {!report.leads.length ? <p>לא נמצאו פניות במסננים שנבחרו.</p> : report.total > report.leads.length ? <p>מוצגות 500 הפניות האחרונות מתוך {report.total}.</p> : null}
    </> : null}
  </main>;
}
