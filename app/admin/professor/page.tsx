"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, BarChart3, BrainCircuit, Clock3, Database, Minus, Send, Sparkles, TriangleAlert } from "lucide-react";
import styles from "../admin.module.css";

type MetricKey = "impressions" | "pageViews" | "phone" | "whatsapp" | "viiBookings" | "bizCalls" | "bizWhatsapp" | "bizOrders" | "bizRevenue";
type Insight = { kind: "up" | "down" | "neutral" | "conversion" | "warning"; title: string; detail: string };
type Answer = { answer: string; range: { from: string; till: string; label: string }; compareRange: { from: string; till: string; label: string } | null; metrics: Record<MetricKey, number | null>; comparison: Partial<Record<MetricKey, number | null>> | null; ranking: Array<{ name: string; value: number }>; insights: Insight[]; plan: { scope: string; metrics: MetricKey[]; source: string }; freshness: { internal: string; biz: string | null; coverage: string }; reportHref: string; place: { name: string } | null };
type History = { id: string; question: string; answer: Answer; durationMs: number; createdAt: string };
const suggestions = ["תן לי נתונים של החודש להילת הנוף: טלפונים, וואטסאפ והזמנות Biz", "השווה את כל הנופש החודש לתקופה הקודמת", "מי מוביל בכניסות לעמודים ב־30 הימים האחרונים?"];
const metricLabel: Record<MetricKey, string> = { impressions: "חשיפות", pageViews: "כניסות", phone: "טלפון ב־V", whatsapp: "WhatsApp ב־V", viiBookings: "בקשות V", bizCalls: "שיחות Maskyoo", bizWhatsapp: "WhatsApp ב־Biz", bizOrders: "הזמנות Biz", bizRevenue: "הכנסות Biz" };
const metricValue = (key: MetricKey, value: number | null) => value == null ? "לא נשמר" : `${value.toLocaleString("he-IL")}${key === "bizRevenue" ? " ₪" : ""}`;
const insightIcon = { up: ArrowUpRight, down: ArrowDownRight, neutral: Minus, conversion: Sparkles, warning: TriangleAlert } as const;

function ProfessorVisualization({ answer }: { answer: Answer }) {
  const availableMetrics = answer.plan.metrics.filter((key) => answer.metrics[key] != null);
  const [activeMetric, setActiveMetric] = useState<MetricKey | null>(availableMetrics[0] || null);
  const modes = [answer.comparison ? "comparison" : null, answer.ranking.length ? "ranking" : null, "snapshot"].filter(Boolean) as Array<"comparison" | "ranking" | "snapshot">;
  const [mode, setMode] = useState<"comparison" | "ranking" | "snapshot">(modes[0]);
  const snapshotMax = Math.max(1, ...availableMetrics.map((key) => answer.metrics[key] || 0));
  const rankingMax = Math.max(1, ...answer.ranking.map((item) => item.value));
  const activeCurrent = activeMetric ? answer.metrics[activeMetric] : null;
  const activePrevious = activeMetric && answer.comparison ? answer.comparison[activeMetric] : null;
  const compareMax = Math.max(1, activeCurrent || 0, activePrevious || 0);
  return <section className={styles.professorVisual} aria-labelledby="professor-visual-title">
    <header><div><span><BarChart3 size={15} /> המחשה חיה</span><h3 id="professor-visual-title">הנתונים שמאחורי התשובה</h3></div><nav aria-label="בחירת גרף">{modes.map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{item === "comparison" ? "השוואה" : item === "ranking" ? "דירוג" : "תמונת מצב"}</button>)}</nav></header>
    {mode !== "ranking" ? <div className={styles.professorMetricPicker}>{availableMetrics.map((key) => <button key={key} type="button" aria-pressed={activeMetric === key} onClick={() => setActiveMetric(key)}><span>{metricLabel[key]}</span><strong>{metricValue(key, answer.metrics[key])}</strong></button>)}</div> : null}
    {mode === "comparison" && activeMetric ? <div className={styles.professorCompareChart} role="img" aria-label={`השוואת ${metricLabel[activeMetric]} בין התקופה הנוכחית לקודמת`}>
      <article><span>התקופה הנבחרת</span><div><i style={{ "--chart-width": `${Math.max(3, Math.round((activeCurrent || 0) / compareMax * 100))}%` } as CSSProperties} /></div><strong>{metricValue(activeMetric, activeCurrent)}</strong></article>
      <article><span>התקופה הקודמת</span><div><i style={{ "--chart-width": `${Math.max(3, Math.round((activePrevious || 0) / compareMax * 100))}%` } as CSSProperties} /></div><strong>{metricValue(activeMetric, activePrevious ?? null)}</strong></article>
    </div> : null}
    {mode === "snapshot" ? <div className={styles.professorSnapshotChart}>{availableMetrics.map((key) => <article key={key} onMouseEnter={() => setActiveMetric(key)}><span>{metricLabel[key]}</span><div><i style={{ "--chart-width": `${Math.max(3, Math.round((answer.metrics[key] || 0) / snapshotMax * 100))}%` } as CSSProperties} /></div><strong>{metricValue(key, answer.metrics[key])}</strong></article>)}</div> : null}
    {mode === "ranking" ? <div className={styles.professorRankingChart}>{answer.ranking.map((item, index) => <article key={`${item.name}-${index}`}><b>{index + 1}</b><span>{item.name}</span><div><i style={{ "--chart-width": `${Math.max(4, Math.round(item.value / rankingMax * 100))}%` } as CSSProperties} /></div><strong>{item.value.toLocaleString("he-IL")}</strong></article>)}</div> : null}
    <footer>התרשים משתמש רק במספרים שהוחזרו ממסד V וממטמון Biz. אין השלמת ערכים או תחזית.</footer>
  </section>;
}

export default function ProfessorPage() {
  const [question, setQuestion] = useState(""); const [answer, setAnswer] = useState<Answer | null>(null); const [history, setHistory] = useState<History[]>([]); const [quota, setQuota] = useState({ limit: 20, used: 0, remaining: 20 }); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const [canManage, setCanManage] = useState(false); const [quotaEmail, setQuotaEmail] = useState(""); const [quotaLimit, setQuotaLimit] = useState("20"); const [quotaMessage, setQuotaMessage] = useState("");
  async function load() { const response = await fetch("/api/admin/professor", { cache: "no-store" }); if (!response.ok) return; const data = await response.json() as { quota: typeof quota; history: History[]; canManage?: boolean }; setQuota(data.quota); setHistory(data.history || []); setCanManage(data.canManage === true); }
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/professor", { cache: "no-store" }).then(async (response) => {
      if (!response.ok || cancelled) return;
      const data = await response.json() as { quota: typeof quota; history: History[]; canManage?: boolean };
      if (cancelled) return;
      setQuota(data.quota);
      setHistory(data.history || []);
      setCanManage(data.canManage === true);
    });
    return () => { cancelled = true; };
  }, []);
  async function ask(value = question) { const next = value.trim(); if (!next || loading) return; setQuestion(next); setLoading(true); setError(""); try { const response = await fetch("/api/admin/professor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: next }) }); const data = await response.json() as { answer?: Answer; quota?: typeof quota; error?: string; message?: string }; if (!response.ok || !data.answer) { if (data.message) throw new Error(`question:${data.message}`); throw new Error(data.error || "professor_unavailable"); } setAnswer(data.answer); if (data.quota) setQuota(data.quota); await load(); } catch (failure) { const code = failure instanceof Error ? failure.message : ""; setError(code === "quota_exceeded" ? "המכסה היומית נוצלה. מנהל המערכת יכול לשנות אותה." : code.startsWith("question:") ? code.slice(9) : "לא הצלחתי להשיב על בסיס נתונים מאומתים כרגע. לא הוצג מספר משוער."); } finally { setLoading(false); } }
  async function saveQuota() { const email = quotaEmail.trim().toLowerCase(); const limit = Number(quotaLimit); if (!email.includes("@") || !Number.isSafeInteger(limit) || limit < 0 || limit > 500) { setQuotaMessage("יש להזין כתובת דוא״ל תקינה ומכסה בין 0 ל־500."); return; } setQuotaMessage("שומר..."); const response = await fetch("/api/admin/professor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "quota", email, limit }) }); setQuotaMessage(response.ok ? `המכסה של ${email} נשמרה: ${limit} שאלות ביום.` : "שמירת המכסה נכשלה. לא בוצע שינוי."); }
  return <main className={styles.professorPage} dir="rtl">
    <header className={`${styles.pageHeader} ${styles.professorHero}`}><div><span className={styles.eyebrow}>V Professor</span><h1>שאל את פרופסור</h1><p>שואלים בעברית ומקבלים תשובה, תובנות וגרפים מתוך נתוני V ונתוני Biz שכבר נשמרו. אין מספרים מומצאים.</p></div><div className={styles.professorBrain} aria-hidden="true"><i /><i /><i /><BrainCircuit size={28} /><span>LIVE DATA</span></div><div className={styles.professorQuota}><BrainCircuit size={22} /><strong>{quota.remaining}</strong><span>שאלות נותרו היום מתוך {quota.limit}</span></div></header>
    <section className={styles.professorComposer} aria-labelledby="professor-question"><label id="professor-question" htmlFor="professor-input">מה תרצה לדעת?</label><div><textarea id="professor-input" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={800} placeholder="לדוגמה: תן לי נתונים של החודש להילת הנוף, כמה טלפונים, וואטסאפ והזמנות Biz" /><button type="button" onClick={() => void ask()} disabled={loading || !question.trim()}>{loading ? <Sparkles className={styles.spin} size={19} /> : <Send size={19} />}{loading ? "מחשב נתונים..." : "שליחה"}</button></div><nav aria-label="שאלות מוצעות">{suggestions.map((item) => <button key={item} type="button" onClick={() => void ask(item)}>{item}</button>)}</nav>{error ? <p className={styles.professorError} role="alert">{error}</p> : null}</section>
    {answer ? <section className={styles.professorAnswer} aria-live="polite"><header><BrainCircuit size={24} /><div><h2>{answer.plan.scope}</h2><p>{answer.range.label} · {answer.range.from} עד {answer.range.till}</p></div></header><div className={styles.professorPlan}><span>מה הבנתי</span><strong>{answer.plan.scope}</strong><small>{answer.plan.metrics.map((key) => metricLabel[key]).join(" · ")} · {answer.plan.source}</small></div><p>{answer.answer}</p><div className={styles.professorMetrics}>{answer.plan.metrics.map((key) => <article key={key}><span>{metricLabel[key]}</span><strong>{metricValue(key, answer.metrics[key])}</strong></article>)}</div>{answer.insights?.length ? <section className={styles.professorInsights} aria-label="תובנות מחושבות">{answer.insights.map((insight, index) => { const Icon = insightIcon[insight.kind]; return <article key={`${insight.title}-${index}`} data-kind={insight.kind}><Icon size={18} /><span><strong>{insight.title}</strong><small>{insight.detail}</small></span></article>; })}</section> : null}<ProfessorVisualization key={`${answer.range.start}-${answer.range.end}-${answer.summary}`} answer={answer} /><footer><span><Database size={15} />{answer.freshness.coverage}{answer.freshness.biz ? ` · Biz נשמר ${new Date(answer.freshness.biz).toLocaleString("he-IL")}` : ""}</span><a href={answer.reportHref}>פתיחת הדוח המלא <ArrowLeft size={15} /></a></footer></section> : null}
    {canManage ? <section className={styles.professorQuotaManager} aria-labelledby="professor-quota-title"><div><h2 id="professor-quota-title">ניהול מכסות פרופסור</h2><p>מנהל יכול לקבוע לכל משתמש בין 0 ל־500 שאלות ביום. מכסה 0 משביתה את הגישה.</p></div><label>דוא״ל המשתמש<input type="email" value={quotaEmail} onChange={(event) => setQuotaEmail(event.target.value)} placeholder="name@example.com" dir="ltr" /></label><label>שאלות ביום<input type="number" min="0" max="500" step="1" value={quotaLimit} onChange={(event) => setQuotaLimit(event.target.value)} /></label><button type="button" onClick={() => void saveQuota()}>שמירת מכסה</button>{quotaMessage ? <p role="status">{quotaMessage}</p> : null}</section> : null}
    <section className={styles.professorHistory}><h2>השאלות האחרונות שלי</h2>{history.length ? history.map((item) => <article key={item.id}><div><Clock3 size={15} /><time>{new Date(item.createdAt).toLocaleString("he-IL")}</time><span>{item.durationMs.toLocaleString("he-IL")} אלפיות שנייה</span></div><strong>{item.question}</strong><p>{item.answer.answer}</p></article>) : <p>עוד לא נשאלו שאלות בחשבון הזה.</p>}</section>
  </main>;
}
