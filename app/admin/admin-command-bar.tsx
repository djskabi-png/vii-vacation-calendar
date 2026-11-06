"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ListChecks, LoaderCircle, LogOut, Search, Sparkles, X } from "lucide-react";
import { adminCommands as commands } from "./admin-navigation.ts";
import styles from "./admin.module.css";
import { adminRouteAllowed, type AdminAccess } from "../lib/admin-permissions.ts";



function currentTitle(pathname: string) {
  return commands.find((item) => item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href))?.title || "מערכת הניהול";
}

export default function AdminCommandBar({ access }: { access: AdminAccess }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [logoutState, setLogoutState] = useState<"idle" | "loading" | "error">("idle");
  const input = useRef<HTMLInputElement>(null);
  const closeCommand = () => { setOpen(false); setQuery(""); };
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("he");
    const allowed = commands.filter((item) => adminRouteAllowed(access, item.href));
    return term ? allowed.filter((item) => `${item.title} ${item.hint}`.toLocaleLowerCase("he").includes(term)) : allowed;
  }, [query, access]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") { event.preventDefault(); setOpen(true); }
      if (event.key === "Escape") { setOpen(false); setQuery(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => input.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const verifyRestoredSession = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      void fetch("/api/auth/admin/session", { credentials: "same-origin", cache: "no-store" })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => { if (!payload?.account) window.location.replace("/admin/login?loggedOut=1"); })
        .catch(() => undefined);
    };
    window.addEventListener("pageshow", verifyRestoredSession);
    return () => window.removeEventListener("pageshow", verifyRestoredSession);
  }, []);

  async function logout() {
    if (logoutState === "loading") return;
    setLogoutState("loading");
    try {
      const response = await fetch("/api/auth/admin/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("logout_failed");
      window.location.replace("/admin/login?loggedOut=1");
    } catch {
      setLogoutState("error");
    }
  }

  return <>
    <header className={styles.commandBar} dir="rtl">
      <div className={styles.commandIdentity}><span>V Control</span><strong>{currentTitle(pathname)}</strong></div>
      <button type="button" className={styles.commandSearch} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="פתיחת חיפוש כלי ניהול">
        <Search size={17} aria-hidden="true" /><span>חיפוש כלי, דוח או פעולה</span><kbd>Ctrl K</kbd>
      </button>
      <div className={styles.commandActions}>
        {adminRouteAllowed(access, "/admin/content-queue") ? <Link href="/admin/content-queue" prefetch={false} className={styles.commandPrimary}><ListChecks size={17} aria-hidden="true" /> פתיחת תור העבודה</Link> : null}
        <button type="button" className={styles.logoutButton} onClick={() => void logout()} disabled={logoutState === "loading"} aria-busy={logoutState === "loading"}>
          {logoutState === "loading" ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <LogOut size={17} aria-hidden="true" />}
          <span>{logoutState === "loading" ? "מתנתקים..." : "התנתקות"}</span>
        </button>
      </div>
    </header>
    {logoutState === "error" ? <div className={styles.logoutError} role="alert"><span>לא הצלחנו להתנתק. בדקו את החיבור ונסו שוב.</span><button type="button" onClick={() => setLogoutState("idle")}>סגירה</button></div> : null}
    {open ? <div className={styles.commandBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCommand(); }}>
      <section className={styles.commandDialog} role="dialog" aria-modal="true" aria-labelledby="admin-command-title">
        <header><div><Sparkles size={18} aria-hidden="true" /><h2 id="admin-command-title">לאן ממשיכים?</h2></div><button type="button" onClick={closeCommand} aria-label="סגירת חיפוש"><X size={19} /></button></header>
        <label className={styles.commandInput}><Search size={18} aria-hidden="true" /><input aria-label="חיפוש בכלי הניהול" ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="לדוגמה: קידום, חיפושים, קטלוגים" /></label>
        <div className={styles.commandResults}>{filtered.length ? filtered.map(({ href, title, hint, icon: Icon }) => <Link key={href} href={href} prefetch={false} onClick={closeCommand}><span><Icon size={18} aria-hidden="true" /></span><div><strong>{title}</strong><small>{hint}</small></div><ArrowLeft size={17} aria-hidden="true" /></Link>) : <div className={styles.commandEmpty}>לא נמצא כלי בשם הזה. אפשר לחפש לפי פעולה או סוג נתון.</div>}</div>
      </section>
    </div> : null}
  </>;
}
