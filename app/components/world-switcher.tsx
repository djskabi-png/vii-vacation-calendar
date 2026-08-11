"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { publicWorldNavigation, worlds, type WorldId } from "../data/world-data";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";

export function WorldSwitcher({ active = "vacation" }: { active?: WorldId }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className={`world-dock ${open ? "open" : ""}`}>
      {open && <button className="world-dock__backdrop" type="button" aria-label="סגירת בחירת העולמות" onClick={() => setOpen(false)} />}
      {open && <nav className="world-dock__panel" aria-label="מעבר בין עולמות">
        <header><span>כל מה שכיף לעשות</span><strong>לאיזה עולם עוברים?</strong></header>
        {publicWorldNavigation.map((world) => <Link key={world.id} className={world.id === active ? "active" : ""} href={world.href} onClick={() => setOpen(false)}><span className={`world-mark world-mark--${world.id}`} aria-hidden="true" /><span><b>{world.label}</b><small>{world.description}</small></span></Link>)}
      </nav>}
      <button type="button" aria-label={open ? "סגירת בחירת עולם" : "בחירת עולם"} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}><WorldsIcon /><span><strong>{open ? "סגירה" : "בחירת עולם"}</strong></span></button>
    </div>
  );
}

function WorldsIcon() {
  return <svg className="worlds-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="2" /><rect x="14" y="3.5" width="6.5" height="6.5" rx="2" /><rect x="3.5" y="14" width="6.5" height="6.5" rx="2" /><rect x="14" y="14" width="6.5" height="6.5" rx="2" /><path d="M10 6.75h4M6.75 10v4m10.5-4v4M10 17.25h4" /></svg>;
}

export function SearchWorldTabs({ active }: { active: WorldId }) {
  const { language, translate } = useSiteLanguage();
  const moreRef = useRef<HTMLDetailsElement>(null);
  const primaryWorlds = ["vacation", "spa", "events", "hourly"] as const;
  const iconByWorld = { vacation: "🏡", spa: "🧖", events: "🎈", hourly: "🕒" } as const;
  const moreWorlds = publicWorldNavigation.filter((world) => !primaryWorlds.includes(world.id as typeof primaryWorlds[number]));

  return <nav className="search-world-tabs" aria-label={translate("בחירת עולם לחיפוש")}>
    <span className="search-world-tabs__prompt">{translate("מה מחפשים?")}</span>
    <div className="search-world-tabs__options">
      {primaryWorlds.map((worldId) => {
        const world = worlds.find((item) => item.id === worldId)!;
        return <Link key={world.id} href={localizedPath(world.href, language)} className={world.id === active ? "active" : ""} aria-current={world.id === active ? "page" : undefined}>
          <span className="search-world-tabs__icon" aria-hidden="true">{iconByWorld[worldId]}</span>
          <span>{translate(world.shortLabel)}</span>
        </Link>;
      })}
      <details className="search-world-tabs__more" ref={moreRef}>
        <summary aria-label={translate("עולמות נוספים")}>
          <span className="search-world-tabs__icon search-world-tabs__icon--more" aria-hidden="true"><i /><i /><i /></span>
          <span>{translate("עוד")}</span>
        </summary>
        <div className="search-world-tabs__menu">
          {moreWorlds.map((world) => <Link key={world.id} href={localizedPath(world.href, language)} onClick={() => moreRef.current?.removeAttribute("open")}>
            <span className={`world-mark world-mark--${world.id}`} aria-hidden="true" />
            <span><strong>{translate(world.shortLabel)}</strong><small>{translate(world.description)}</small></span>
          </Link>)}
        </div>
      </details>
    </div>
  </nav>;
}
