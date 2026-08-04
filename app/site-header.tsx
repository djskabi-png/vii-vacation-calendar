"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";

export function SiteHeader({
  compact = false,
  homeHref = "./",
  businessHref = "./business/",
}: {
  compact?: boolean;
  homeHref?: string;
  businessHref?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [comfortReading, setComfortReading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("comfort-reading", comfortReading);
    return () => document.documentElement.classList.remove("comfort-reading");
  }, [comfortReading]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className={`vii-header${compact ? " compact" : ""}`}>
      <div className="vii-header-inner">
        <a className="vii-logo-link" href={homeHref} aria-label="דף הבית בהמחשה">
          <img src="https://www.vii.co.il/assets/img/logo_new.png" alt="וי פור ויקיישן" width="160" height="122" />
        </a>

        <nav className="vii-main-nav" aria-label="ניווט ראשי">
          <a className="active" href={homeHref}>נופש <span aria-hidden="true">🏝️</span></a>
          <a href="https://www.vii.co.il/events/" target="_blank" rel="noreferrer">אירועים <span aria-hidden="true">🏡</span></a>
        </nav>

        <div className="vii-utility-nav" aria-label="פעולות משתמש">
          <button type="button" aria-label="פתיחת תפריט" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>☰</button>
          <a href="https://www.vii.co.il/" target="_blank" rel="noreferrer" aria-label="מעבר לאתר הפעיל">●</a>
          <a href="https://www.vii.co.il/" target="_blank" rel="noreferrer" aria-label="מועדפים באתר הפעיל">♡</a>
          <button
            type="button"
            aria-label="מצב קריאה נוח"
            aria-pressed={comfortReading}
            className={comfortReading ? "active-utility" : ""}
            onClick={() => setComfortReading((value) => !value)}
          >♿</button>
        </div>
      </div>

      {menuOpen && (
        <div className="vii-menu-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setMenuOpen(false)}>
          <nav className="vii-mobile-menu" aria-label="תפריט האתר">
            <div>
              <strong>לאן תרצו לעבור?</strong>
              <button type="button" aria-label="סגירת תפריט" onClick={() => setMenuOpen(false)}>×</button>
            </div>
            <a href={homeHref}>דף הבית והחיפוש הכללי</a>
            <a href={`${businessHref}?scenario=multi`}>מתחם עם כמה יחידות</a>
            <a href={`${businessHref}?scenario=single`}>מקום אירוח יחיד</a>
            <a href="https://www.vii.co.il/" target="_blank" rel="noreferrer">האתר הפעיל</a>
          </nav>
        </div>
      )}
    </header>
  );
}
