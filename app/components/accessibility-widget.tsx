"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type AccessibilitySettings = {
  fontScale: number;
  highContrast: boolean;
  monochrome: boolean;
  underlineLinks: boolean;
  pauseMotion: boolean;
  textSpacing: boolean;
  visibleFocus: boolean;
  largeCursor: boolean;
};

const defaults: AccessibilitySettings = { fontScale: 100, highContrast: false, monochrome: false, underlineLinks: false, pauseMotion: false, textSpacing: false, visibleFocus: false, largeCursor: false };
const storageKey = "vii-accessibility-settings";

export function AccessibilityWidget({ placement = "icon" }: { placement?: "icon" | "menu" | "footer" }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(defaults);
  const [hydrated, setHydrated] = useState(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setSettings({ ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }); } catch { setSettings(defaults); }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.style.setProperty("--accessibility-font-scale", `${settings.fontScale}%`);
    const classes: Array<[keyof AccessibilitySettings, string]> = [
      ["highContrast", "a11y-high-contrast"], ["monochrome", "a11y-monochrome"], ["underlineLinks", "a11y-underline-links"], ["pauseMotion", "a11y-pause-motion"], ["textSpacing", "a11y-text-spacing"], ["visibleFocus", "a11y-visible-focus"], ["largeCursor", "a11y-large-cursor"],
    ];
    classes.forEach(([key, className]) => root.classList.toggle(className, Boolean(settings[key])));
    localStorage.setItem(storageKey, JSON.stringify(settings));
  }, [hydrated, settings]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); window.setTimeout(() => openButton.current?.focus(), 0); return; }
      if (event.key !== "Tab") return;
      const panel = document.querySelector<HTMLElement>(".accessibility-panel");
      const focusable = panel?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  function toggle(key: keyof Omit<AccessibilitySettings, "fontScale">) { setSettings((current) => ({ ...current, [key]: !current[key] })); }
  function close() { setOpen(false); window.setTimeout(() => openButton.current?.focus(), 0); }
  function changeFont() { setSettings((current) => ({ ...current, fontScale: current.fontScale >= 145 ? 100 : current.fontScale + 15 })); }

  const panel = open && typeof document !== "undefined" ? createPortal(<div className="accessibility-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="accessibility-panel" role="dialog" aria-modal="true" aria-labelledby="accessibility-panel-title">
    <header><div><span>כלי עזר לתצוגה</span><h2 id="accessibility-panel-title">התאמות נגישות</h2></div><button ref={closeButton} type="button" onClick={close} aria-label="סגירת כלי הנגישות">סגירה</button></header>
    <p className="accessibility-panel__intro">ההתאמות נשמרות במכשיר הזה. הן אינן מחליפות מבנה תקין, שימוש במקלדת או תמיכה בטכנולוגיות מסייעות.</p>
    <div className="accessibility-panel__options">
      <button type="button" onClick={changeFont} aria-label={`שינוי גודל הטקסט, כעת ${settings.fontScale} אחוז`}><span>גודל טקסט</span><strong>{settings.fontScale}%</strong></button>
      <button type="button" aria-pressed={settings.highContrast} onClick={() => toggle("highContrast")}><span>ניגודיות גבוהה</span><strong>{settings.highContrast ? "פעיל" : "כבוי"}</strong></button>
      <button type="button" aria-pressed={settings.monochrome} onClick={() => toggle("monochrome")}><span>צבעי אפור</span><strong>{settings.monochrome ? "פעיל" : "כבוי"}</strong></button>
      <button type="button" aria-pressed={settings.underlineLinks} onClick={() => toggle("underlineLinks")}><span>הדגשת קישורים</span><strong>{settings.underlineLinks ? "פעיל" : "כבוי"}</strong></button>
      <button type="button" aria-pressed={settings.pauseMotion} onClick={() => toggle("pauseMotion")}><span>עצירת תנועה</span><strong>{settings.pauseMotion ? "פעיל" : "כבוי"}</strong></button>
      <button type="button" aria-pressed={settings.textSpacing} onClick={() => toggle("textSpacing")}><span>ריווח טקסט</span><strong>{settings.textSpacing ? "פעיל" : "כבוי"}</strong></button>
      <button type="button" aria-pressed={settings.visibleFocus} onClick={() => toggle("visibleFocus")}><span>מיקוד בולט</span><strong>{settings.visibleFocus ? "פעיל" : "כבוי"}</strong></button>
      <button type="button" aria-pressed={settings.largeCursor} onClick={() => toggle("largeCursor")}><span>סמן גדול</span><strong>{settings.largeCursor ? "פעיל" : "כבוי"}</strong></button>
    </div>
    <footer><button type="button" className="button subtle" onClick={() => setSettings(defaults)}>איפוס כל ההתאמות</button><Link href="/accessibility" onClick={close}>להצהרת הנגישות המלאה</Link></footer>
  </section></div>, document.body) : null;

  const triggerClass = placement === "menu"
    ? "accessibility-menu-trigger"
    : placement === "footer"
      ? "footer-privacy-button accessibility-footer-trigger"
      : "icon-button accessibility-trigger";

  return <><button ref={openButton} className={triggerClass} type="button" aria-label="פתיחת כלי הנגישות" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}><span aria-hidden="true">♿</span>{placement !== "icon" ? <span>כלי נגישות</span> : null}</button>{panel}</>;
}
