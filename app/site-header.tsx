"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useState } from "react";

const nav = [
  { href: "/", label: "נופש" },
  { href: "/events/", label: "אירועים" },
  { href: "/destinations/", label: "יעדים" },
  { href: "/guides/", label: "מגזין" },
];

export function SiteHeader({ variant = "vacation" }: { variant?: "vacation" | "events" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [comfortReading, setComfortReading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("comfort-reading", comfortReading);
    return () => document.documentElement.classList.remove("comfort-reading");
  }, [comfortReading]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="site-header__inner shell">
        <Link className="brand" href="/" aria-label="וי פור ויקיישן, דף הבית">
          <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
        </Link>

        <nav className="desktop-nav" aria-label="ניווט ראשי">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className={(variant === "events" && item.href === "/events/") || (variant === "vacation" && item.href === "/") ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="icon-button" href="/favorites/" aria-label="מקומות שאהבתי"><HeartIcon /></Link>
          <button className="icon-button" type="button" aria-label="מצב קריאה נוח" aria-pressed={comfortReading} onClick={() => setComfortReading((value) => !value)}><AccessibilityIcon /></button>
          <button className="menu-button" type="button" aria-expanded={menuOpen} aria-label="פתיחת תפריט" onClick={() => setMenuOpen(true)}><MenuIcon /><span>תפריט</span></button>
        </div>
      </div>

      {menuOpen && (
        <div className="menu-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
          <nav className="menu-panel" aria-label="תפריט האתר">
            <div className="menu-panel__head">
              <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="סגירת תפריט"><CloseIcon /></button>
            </div>
            <p>לאן תרצו להגיע?</p>
            {nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}<ArrowIcon /></Link>)}
            <div className="menu-panel__secondary">
              <Link href="/favorites/">מקומות שאהבתי</Link>
              <Link href="/contact/">יצירת קשר</Link>
              <Link href="/handoff/">מרכז מידע לצוות</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
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
