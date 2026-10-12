"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

type World = "vacations" | "events" | "rooms" | "spa";
type State = { world: World; activeCount: number; acceptedAt: string | null; lockRunId: string | null; lockUntil: string | null };
type Run = { id: string; world: World; source: string; status: string; startedAt: string;
  finishedAt: string | null; beforeCount: number | null; candidateCount: number | null;
  addedCount: number | null; changedCount: number | null; errorCode: string | null };
type Dashboard = { states: State[]; runs: Run[] };

const worlds: { id: World; name: string }[] = [
  { id: "vacations", name: "נופש" }, { id: "events", name: "אירועים" },
  { id: "rooms", name: "חדרים לפי שעה" }, { id: "spa", name: "ספא" },
];

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "טרם עודכן";
}

export default function CatalogSyncPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState<World | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/catalog-sync", { cache: "no-store" });
      if (response.status === 403) setForbidden(true);
      if (!response.ok) throw new Error(response.status === 403 ? "אין הרשאת מנהל" : "לא ניתן לטעון את מצב הקטלוגים");
      setDashboard(await response.json() as Dashboard);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "שגיאת טעינה"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function pull(world: World) {
    if (busy) return;
    setBusy(world);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/catalog-sync", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ world }),
      });
      const result = await response.json() as { status?: string; errorCode?: string; error?: string };
      setNotice(result.status === "accepted" ? "הנתונים נבדקו ופורסמו" :
        result.status === "rejected" ? "העדכון נדחה בבדיקה. הנתונים הקודמים נשמרו." :
          result.status === "skipped" ? "משיכה אחרת כבר פועלת בתחום הזה" :
            "המשיכה נכשלה. הנתונים הקודמים נשמרו.");
      if (!result.status) setError(result.error || "המשיכה לא בוצעה");
      await refresh();
    } catch { setError("הקשר נותק. בדקו את יומן המשיכות לפני ניסיון נוסף."); }
    finally { setBusy(null); }
  }

  return <main dir="rtl" style={{ maxWidth: 1120, minHeight: "80vh", margin: "0 auto", padding: "32px 20px" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div><h1 style={{ margin: 0, fontSize: "1.8rem" }}>סנכרון קטלוגים</h1><p>מקומות, חדרים וחבילות לפי הנתונים שהתקבלו מהספקים.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading || !!busy} title="רענון מצב" aria-label="רענון מצב"><RefreshCw size={18} aria-hidden="true" /></button>
    </header>
    {error ? <p role="alert">{error} {forbidden ? <a href="/api/auth/google?returnTo=%2Fadmin%2Fcatalog-sync">כניסה עם Google</a> : null}</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {loading && !dashboard ? <p role="status">טוענים נתונים...</p> : null}
    {dashboard ? <>
      <section aria-label="מצב התחומים" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 16, marginBlock: 24 }}>
        {worlds.map(({ id, name }) => {
          const state = dashboard.states.find((item) => item.world === id);
          const run = dashboard.runs.find((item) => item.world === id);
          const running = busy === id || (!!state?.lockRunId && !!state.lockUntil && Date.parse(state.lockUntil) > Date.now());
          return <article key={id} style={{ border: "1px solid #dce4e2", borderRadius: 8, padding: 18 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>{name}</h2>
            <p>מקומות: {state?.activeCount ?? "טרם נמשך"}</p>
            <p>עדכון אחרון: {date(state?.acceptedAt)}</p>
            <p>משיכה אחרונה: {run?.status || "אין עדיין"}</p>
            {run?.errorCode ? <p>סיבת כשל: <code dir="ltr">{run.errorCode}</code></p> : null}
            <button type="button" disabled={!!busy || running} onClick={() => void pull(id)}>
              <RefreshCw size={17} aria-hidden="true" /> {running ? "מושכים נתונים..." : "משוך עכשיו"}
            </button>
          </article>;
        })}
      </section>
      <section aria-label="יומן משיכות">
        <h2 style={{ fontSize: "1.25rem" }}>יומן משיכות</h2>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
          <thead><tr>{["זמן", "תחום", "מקור", "מצב", "לפני", "אחרי", "נוספו", "השתנו", "סיבה"].map((label) =>
            <th key={label} scope="col" style={{ padding: 10, borderBottom: "1px solid #dce4e2" }}>{label}</th>)}</tr></thead>
          <tbody>{dashboard.runs.map((run) => <tr key={run.id}>
            {[date(run.startedAt), worlds.find((item) => item.id === run.world)?.name || run.world,
              run.source, run.status, run.beforeCount, run.candidateCount, run.addedCount,
              run.changedCount, run.errorCode].map((value, index) =>
              <td key={index} style={{ padding: 10, borderBottom: "1px solid #edf0ef" }}>{value ?? ""}</td>)}
          </tr>)}</tbody>
        </table></div>
      </section>
    </> : null}
  </main>;
}
