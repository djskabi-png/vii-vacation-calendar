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
  createdAt: string;
};

type Report = { total: number; byWorld: { world: string; count: number }[]; leads: Lead[] };

export default function WhatsAppLeadsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/whatsapp-leads/", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "אין הרשאה לצפות בפניות. יש להתחבר לחשבון מנהל מורשה." : "לא ניתן לטעון את הפניות כרגע.");
      setReport(await response.json() as Report);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן לטעון את הפניות כרגע.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  return <main dir="rtl" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px", minHeight: "80vh" }}>
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div><h1 style={{ margin: 0, fontSize: "1.8rem" }}>פניות וואטסאפ</h1><p>פניות שנשמרו לפני המעבר לשיחה. אין אפשרות לדעת מכאן אם ההודעה נשלחה בוואטסאפ.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading}>רענון</button>
    </header>
    {loading ? <p role="status">טוענים פניות...</p> : error ? <p role="alert">{error}</p> : report ? <>
      <section aria-label="סיכום פניות" style={{ display: "flex", gap: 24, flexWrap: "wrap", borderBlock: "1px solid #dce4e2", padding: "18px 0" }}>
        <strong>סך פניות: {report.total}</strong>
        {report.byWorld.map((item) => <span key={item.world}>{item.world}: {item.count}</span>)}
      </section>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
        <thead><tr>{["נשמר", "אסמכתה", "עולם", "מקום", "שם", "טלפון", "תאריך", "אורחים"].map((label) => <th key={label} scope="col" style={{ padding: 10, borderBottom: "1px solid #dce4e2" }}>{label}</th>)}</tr></thead>
        <tbody>{report.leads.map((lead) => <tr key={lead.submissionId}>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{new Date(lead.createdAt).toLocaleString("he-IL")}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.reference}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.world}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.placeName}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.visitorName}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef", direction: "ltr" }}>{lead.visitorPhone}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.requestedDate}{lead.requestedTill ? ` עד ${lead.requestedTill}` : ""}</td>
          <td style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{lead.guests || ""}</td>
        </tr>)}</tbody>
      </table></div>
      {!report.leads.length ? <p>עדיין לא נשמרו פניות וואטסאפ.</p> : report.total > report.leads.length ? <p>מוצגות 100 הפניות האחרונות.</p> : null}
    </> : null}
  </main>;
}
