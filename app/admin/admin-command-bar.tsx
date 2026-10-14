"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, BarChart3, CalendarSync, FileSearch, Gauge, ListChecks, MessageCircle, Route, Search, Sparkles, Star, TrendingUp, X } from "lucide-react";
import styles from "./admin.module.css";

const commands = [
  { href: "/admin", title: "תמונת מצב", hint: "מדדים, בריאות המערכת וסדר היום", icon: Gauge },
  { href: "/admin/growth", title: "מרכז קידום", hint: "SEO, מפות אתר, מדידה ותוכן", icon: Sparkles },
  { href: "/admin/search-pages", title: "עמודי חיפוש", hint: "עריכה, תזמון ופרסום", icon: FileSearch },
  { href: "/admin/content-queue", title: "תור אישורים", hint: "עמודים שנוצרו מביקוש אמיתי", icon: ListChecks },
  { href: "/admin/search-analytics", title: "מודיעין חיפושים", hint: "ביקוש, אזורים ואפס תוצאות", icon: Search },
  { href: "/admin/business-performance", title: "ביצועי עסקים", hint: "חשיפות, כניסות ופעולות", icon: BarChart3 },
  { href: "/admin/discovery-promotions", title: "קידום מקומות", hint: "טיוטות וקידום מבוקר", icon: TrendingUp },
  { href: "/admin/redirects", title: "כתובות והפניות", hint: "301, 410 ובקרת כתובות", icon: Route },
  { href: "/admin/catalog-sync", title: "קטלוגים וספקים", hint: "משיכות, אבחון ושמירת דור תקין", icon: CalendarSync },
  { href: "/admin/operations", title: "הזמנות וחוות דעת", hint: "פעולות, סטטוסים ואסמכתאות", icon: Star },
  { href: "/admin/whatsapp-leads", title: "פניות וואטסאפ", hint: "פניות שנשמרו במערכת", icon: MessageCircle },
];

function currentTitle(pathname: string) {
  return commands.find((item) => item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href))?.title || "מערכת הניהול";
}

export default function AdminCommandBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("he");
    return term ? commands.filter((item) => `${item.title} ${item.hint}`.toLocaleLowerCase("he").includes(term)) : commands;
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 30); else setQuery(""); }, [open]);

  return <>
    <header className={styles.commandBar} dir="rtl">
      <div className={styles.commandIdentity}><span>VII Control</span><strong>{currentTitle(pathname)}</strong></div>
      <button type="button" className={styles.commandSearch} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <Search size={17} aria-hidden="true" /><span>חיפוש כלי, דוח או פעולה</span><kbd>Ctrl K</kbd>
      </button>
      <a href="/admin/content-queue" className={styles.commandPrimary}><ListChecks size={17} aria-hidden="true" /> פתיחת תור העבודה</a>
    </header>
    {open ? <div className={styles.commandBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className={styles.commandDialog} role="dialog" aria-modal="true" aria-labelledby="admin-command-title">
        <header><div><Sparkles size={18} aria-hidden="true" /><h2 id="admin-command-title">לאן ממשיכים?</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="סגירת חיפוש"><X size={19} /></button></header>
        <label className={styles.commandInput}><Search size={18} aria-hidden="true" /><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="לדוגמה: קידום, חיפושים, קטלוגים" /></label>
        <div className={styles.commandResults}>{filtered.length ? filtered.map(({ href, title, hint, icon: Icon }) => <a key={href} href={href} onClick={() => setOpen(false)}><span><Icon size={18} aria-hidden="true" /></span><div><strong>{title}</strong><small>{hint}</small></div><ArrowLeft size={17} aria-hidden="true" /></a>) : <div className={styles.commandEmpty}>לא נמצא כלי בשם הזה. אפשר לחפש לפי פעולה או סוג נתון.</div>}</div>
      </section>
    </div> : null}
  </>;
}
