"use client";

import { useEffect, useState } from "react";
import { controllableWorlds, type ControllableWorld, type WorldAvailability } from "../../lib/world-availability";

const labels: Record<ControllableWorld, string> = { vacation: "נופש", events: "אירועים", corporate: "אירועי חברה", spa: "ספא", hourly: "חדרים לפי שעה", providers: "ספקים", trails: "מסלולים", attractions: "אטרקציות", "gift-card": "גיפט קארד" };

export default function WorldsControlPage() {
  const [worlds, setWorlds] = useState<WorldAvailability | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  useEffect(() => { void fetch("/api/admin/worlds", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error("לא ניתן לטעון את מצב העולמות");
    setWorlds((await response.json() as { worlds: WorldAvailability }).worlds);
  }).catch((cause) => setError(cause instanceof Error ? cause.message : "שגיאת טעינה")); }, []);
  async function toggle(world: ControllableWorld) {
    if (!worlds) return;
    setSaving(world); setError("");
    try {
      const response = await fetch("/api/admin/worlds", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ world, enabled: !worlds[world] }) });
      if (!response.ok) throw new Error("השינוי לא נשמר");
      setWorlds((await response.json() as { worlds: WorldAvailability }).worlds);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "השינוי לא נשמר"); }
    finally { setSaving(""); }
  }
  return <main dir="rtl" style={{ maxWidth: 1050, margin: "0 auto", padding: "34px 22px" }}><header><span>בקרת השקה</span><h1>הפעלת עולמות באתר</h1><p>כיבוי עולם מסיר אותו מהניווט, מהפוטר ומבורר העולמות, וחוסם כניסה לעמודי העולם. הפעלה מחזירה אותו לאותם מוקדים.</p></header>
    {error ? <p role="alert">{error}</p> : null}
    {!worlds ? <p role="status">טוענים...</p> : <section style={{ display: "grid", gap: 12, marginTop: 24 }}>{controllableWorlds.map((world) => <article key={world} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 18, border: "1px solid #d4e4e6", borderRadius: 16, background: "#fff" }}><div><strong>{labels[world]}</strong><p style={{ margin: "4px 0 0" }}>{worlds[world] ? "פעיל ומוצג באתר" : "כבוי ומוסתר מהאתר"}</p></div><button type="button" onClick={() => void toggle(world)} disabled={saving === world} aria-pressed={worlds[world]}>{saving === world ? "שומר..." : worlds[world] ? "כיבוי העולם" : "הפעלת העולם"}</button></article>)}</section>}
  </main>;
}
