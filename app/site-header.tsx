"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { worlds, type WorldId } from "./data/world-data";

const nav = worlds.map((world) => ({ id: world.id, href: world.href, label: world.shortLabel, description: world.description }));

export function SiteHeader({ variant = "vacation" }: { variant?: WorldId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [comfortReading, setComfortReading] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("comfort-reading", comfortReading);
    return () => document.documentElement.classList.remove("comfort-reading");
  }, [comfortReading]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;
      const panel = document.querySelector<HTMLElement>(".menu-panel");
      const focusable = panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  };

  const menu = menuOpen && typeof document !== "undefined" ? createPortal(
    <div className="menu-layer" role="dialog" aria-modal="true" aria-label="תפריט האתר" onMouseDown={(event) => event.target === event.currentTarget && closeMenu()}>
      <nav className="menu-panel" aria-label="ניווט מלא">
        <div className="menu-panel__head">
          <Link href="/" onClick={closeMenu} aria-label="וי פור ויקיישן, דף הבית">
            <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
          </Link>
          <button ref={closeButtonRef} type="button" onClick={closeMenu} aria-label="סגירת תפריט"><CloseIcon /></button>
        </div>

        <div className="menu-panel__intro">
          <span>מתחילים מכאן</span>
          <h2>לאן תרצו להגיע?</h2>
          <p>נופש, אירועים, ספא, ספקים וחוויות, במקום אחד.</p>
        </div>

        <div className="menu-panel__main">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenu}>
              <span><strong>{item.label}</strong><small>{item.description}</small></span>
              <ArrowIcon />
            </Link>
          ))}
        </div>

        <div className="menu-panel__secondary">
          <Link href="/favorites/" onClick={closeMenu}><HeartIcon /><span>מקומות שאהבתי</span></Link>
          <Link href="/contact/" onClick={closeMenu}><ContactIcon /><span>יצירת קשר</span></Link>
          <Link href="/destinations/" onClick={closeMenu}><PinIcon /><span>יעדים</span></Link>
          <Link href="/guides/" onClick={closeMenu}><InfoIcon /><span>מגזין ומדריכים</span></Link>
          <Link href="/handoff/" onClick={closeMenu}><InfoIcon /><span>מרכז מידע לצוות</span></Link>
        </div>

        <div className="menu-panel__footer">
          <span>VII</span>
          <p>כל מה שכיף לעשות, בדיוק בדרך שלכם.</p>
        </div>
      </nav>
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner shell">
          <Link className="brand" href="/" aria-label="וי פור ויקיישן, דף הבית">
            <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
          </Link>

          <nav className="desktop-nav" aria-label="ניווט ראשי">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className={variant === item.id ? "active" : ""}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <Link className="magazine-header-link" href="/guides/"><span>חדש</span>מגזין</Link>
            <Link className="icon-button" href="/favorites/" aria-label="מקומות שאהבתי"><HeartIcon /></Link>
            <button className="icon-button" type="button" aria-label="מצב קריאה נוח" aria-pressed={comfortReading} onClick={() => setComfortReading((value) => !value)}><AccessibilityIcon /></button>
            <button ref={menuButtonRef} className="menu-button" type="button" aria-expanded={menuOpen} aria-haspopup="dialog" aria-label="פתיחת תפריט" onClick={() => setMenuOpen(true)}><MenuIcon /><span>תפריט</span></button>
          </div>
        </div>
      </header>
      {menu}
    </>
  );
}

export function MenuIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>; }
export function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>; }
export function HeartIcon({ filled = false }: { filled?: boolean }) { return <svg viewBox="0 0 24 24" aria-hidden="true" className={filled ? "filled" : ""}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>; }
export function AccessibilityIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4" r="2" /><path d="M5 8h14M12 6v7m0 0-4 7m4-7 4 7" /></svg>; }
export function ArrowIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>; }
export function SearchIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>; }
export function PinIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>; }
export function CalendarIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4m8-4v4M3 10h18" /></svg>; }
export function PeopleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 2-7 6-7s6 3 6 7m0-9c3 0 5 2 5 5v4" /></svg>; }
function ContactIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v12H8l-4 3V5Z" /><path d="M8 9h8M8 13h5" /></svg>; }
function InfoIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>; }
