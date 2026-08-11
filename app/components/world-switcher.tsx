"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export function SearchWorldTabs({ active, onNavigate }: { active: WorldId; onNavigate?: () => void }) {
  const router = useRouter();
  const { language, translate } = useSiteLanguage();
  const moreRef = useRef<HTMLDetailsElement>(null);
  const primaryWorlds = ["vacation", "spa", "events", "hourly"] as const;
  const moreWorlds = publicWorldNavigation.filter((world) => !primaryWorlds.includes(world.id as typeof primaryWorlds[number]));

  const navigateWithinSearch = (href: string, afterNavigate?: () => void) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.push(href);
    window.setTimeout(() => {
      afterNavigate?.();
      onNavigate?.();
    }, 0);
  };

  return <nav className="search-world-tabs" aria-label={translate("בחירת עולם לחיפוש")}>
    <span className="search-world-tabs__prompt">{translate("מה מחפשים?")}</span>
    <div className="search-world-tabs__options">
      {primaryWorlds.map((worldId) => {
        const world = worlds.find((item) => item.id === worldId)!;
        const href = localizedPath(world.href, language);
        return <Link key={world.id} href={href} className={world.id === active ? "active" : ""} aria-current={world.id === active ? "page" : undefined} onClick={navigateWithinSearch(href)}>
          <span className={`search-world-tabs__icon search-world-tabs__icon--${worldId}`} aria-hidden="true"><SearchWorldIcon world={worldId} /></span>
          <span>{translate(world.shortLabel)}</span>
        </Link>;
      })}
      <details className="search-world-tabs__more" ref={moreRef}>
        <summary aria-label={translate("עולמות נוספים")}>
          <span className="search-world-tabs__icon search-world-tabs__icon--more" aria-hidden="true"><i /><i /><i /></span>
          <span>{translate("עוד")}</span>
        </summary>
        <div className="search-world-tabs__menu">
          {moreWorlds.map((world) => { const href = localizedPath(world.href, language); return <Link key={world.id} href={href} onClick={navigateWithinSearch(href, () => moreRef.current?.removeAttribute("open"))}>
            <span className={`world-mark world-mark--${world.id}`} aria-hidden="true" />
            <span><strong>{translate(world.shortLabel)}</strong><small>{translate(world.description)}</small></span>
          </Link>; })}
        </div>
      </details>
    </div>
  </nav>;
}

function SearchWorldIcon({ world }: { world: "vacation" | "spa" | "events" | "hourly" }) {
  if (world === "vacation") return <svg viewBox="0 0 24 24" fill="none"><path d="m3.5 11.2 8.5-7 8.5 7v8.3a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-8.3Z" /><path d="M9 21v-5.5h6V21M8.2 10.8h.01M15.8 10.8h.01" /></svg>;
  if (world === "spa") return <svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5c4.3-2.3 6.8-5.3 6.8-8.6A3.6 3.6 0 0 0 12 10.3a3.6 3.6 0 0 0-6.8 1.6c0 3.3 2.5 6.3 6.8 8.6Z" /><path d="M12 6.5c-.1-1.7.6-3 2.1-4M8.4 8C7 6.8 6.5 5.4 6.8 3.7M15.6 8c1.4-1.2 1.9-2.6 1.6-4.3" /></svg>;
  if (world === "events") return <svg viewBox="0 0 24 24" fill="none"><path d="M4.2 12.3 12 4.5l7.8 7.8-7.8 7.2-7.8-7.2Z" /><path d="M8.5 10.4h7M8.5 14h4.7M6.4 12.3h.01M17.6 12.3h.01" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.3v5l3.3 2M8.2 3.8l-1.6 2.1M15.8 3.8l1.6 2.1" /></svg>;
}
