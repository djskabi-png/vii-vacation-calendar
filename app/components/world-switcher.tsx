"use client";

import Link from "next/link";
import { type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { publicWorldNavigation, worlds, type WorldId } from "../data/world-data";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedPath } from "../i18n/locale-routing";
import { cleanVacationPath } from "../data/vacation-landings";
import { spaSearchHref, spaSearchStateFromValues } from "../data/spa-search-landings";
import { eventSearchHref, hourlySearchHref } from "../data/world-search-landings";

function searchWorldHref(world: "vacation" | "spa" | "events" | "hourly", location?: string) {
  if (!location || location === "כל הארץ") return worlds.find((item) => item.id === world)!.href;
  if (world === "vacation") return cleanVacationPath(location);
  if (world === "spa") return spaSearchHref(spaSearchStateFromValues(location));
  if (world === "events") return eventSearchHref(location);
  return hourlySearchHref(location);
}

export function WorldSwitcher({ active = "vacation" }: { active?: WorldId }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const ignoreClickUntilRef = useRef(0);
  const { language, translate } = useSiteLanguage();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("click", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const rememberPointerStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStartRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const finishPointerActivation = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || start.id !== event.pointerId || !event.isPrimary || event.button !== 0) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    ignoreClickUntilRef.current = performance.now() + 650;
    setOpen((value) => !value);
  };
  const cancelPointerActivation = () => { pointerStartRef.current = null; };
  const finishClickActivation = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.detail > 0 && performance.now() < ignoreClickUntilRef.current) return;
    setOpen((value) => !value);
  };
  const navigateFromSwitcher = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const href = event.currentTarget.getAttribute("href");
    if (!href) return;
    window.location.assign(href);
  };

  const globalSearchHref = localizedPath("/search", language);

  return (
    <div ref={rootRef} className={`world-dock ${open ? "open" : ""}`}>
      {open && <nav className="world-dock__panel" aria-label={translate("חיפוש ומעבר בין עולמות")}>
        <header><span>{translate("כל מה שכיף לעשות")}</span><strong>{translate("מה תרצו לחפש?")}</strong></header>
        <Link className="world-dock__global-search" href={globalSearchHref} onClick={navigateFromSwitcher}><WorldSearchIcon /><span><b>{translate("חיפוש כללי")}</b><small>{translate("חפשו מקום, עסק או יעד בכל האתר")}</small></span></Link>
        {publicWorldNavigation.map((world) => { const href = localizedPath(world.href, language); return <Link key={world.id} className={world.id === active ? "active" : ""} href={href} onClick={navigateFromSwitcher}><span className={`world-mark world-mark--${world.id}`} aria-hidden="true" /><span><b>{translate(world.label)}</b><small>{translate(world.description)}</small></span></Link>; })}
      </nav>}
      <button ref={triggerRef} type="button" aria-label={translate(open ? "סגירת חיפוש ובחירת עולם" : "חיפוש ובחירת עולם")} aria-expanded={open} aria-haspopup="true" onPointerDown={rememberPointerStart} onPointerUp={finishPointerActivation} onPointerCancel={cancelPointerActivation} onClick={finishClickActivation}><WorldSearchIcon /><span><strong>{translate(open ? "סגירה" : "חיפוש")}</strong></span></button>
    </div>
  );
}

function WorldSearchIcon() {
  return <svg className="world-search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

export function SearchWorldTabs({ active, location, onNavigate }: { active: WorldId; location?: string; onNavigate?: () => void }) {
  const router = useRouter();
  const { language, translate } = useSiteLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const moreSummaryRef = useRef<HTMLElement>(null);
  const primaryWorlds = ["vacation", "spa", "events", "hourly"] as const;
  const moreWorlds = publicWorldNavigation.filter((world) => !primaryWorlds.includes(world.id as typeof primaryWorlds[number]));

  useEffect(() => {
    if (!moreOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMoreOpen(false);
      moreSummaryRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [moreOpen]);

  const navigateWithinSearch = (href: string, afterNavigate?: (event: ReactMouseEvent<HTMLAnchorElement>) => void) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    afterNavigate?.(event);
    router.push(href, { scroll: false });
    window.setTimeout(() => {
      onNavigate?.();
    }, 0);
  };
  const closeMoreMenu = () => setMoreOpen(false);
  const closeMoreAndRestoreFocus = () => {
    setMoreOpen(false);
    moreSummaryRef.current?.focus();
  };

  return <nav className="search-world-tabs" aria-label={translate("בחירת עולם לחיפוש")}>
    <span className="search-world-tabs__prompt">{translate("מה מחפשים?")}</span>
    <div className="search-world-tabs__options">
      {primaryWorlds.map((worldId) => {
        const world = worlds.find((item) => item.id === worldId)!;
        const href = localizedPath(searchWorldHref(worldId, location || undefined), language);
        return <Link key={world.id} href={href} scroll={false} className={world.id === active ? "active" : ""} aria-current={world.id === active ? "page" : undefined} onClick={navigateWithinSearch(href)}>
          <span className={`search-world-tabs__icon search-world-tabs__icon--${worldId}`} aria-hidden="true"><SearchWorldIcon world={worldId} /></span>
          <span>{translate(world.shortLabel)}</span>
        </Link>;
      })}
      <details ref={moreRef} className="search-world-tabs__more" open={moreOpen}>
        <summary ref={moreSummaryRef} aria-label={translate("עולמות נוספים")} aria-expanded={moreOpen} onClick={(event) => { event.preventDefault(); setMoreOpen((value) => !value); }}>
          <span className="search-world-tabs__icon search-world-tabs__icon--more" aria-hidden="true"><i /><i /><i /></span>
          <span>{translate("עוד")}</span>
        </summary>
        <div className="search-world-tabs__menu">
          <header className="search-world-tabs__menu-head"><strong>{translate("עולמות נוספים")}</strong><button type="button" aria-label={translate("סגירת בחירת העולמות")} onClick={closeMoreAndRestoreFocus}>×</button></header>
          {moreWorlds.map((world) => { const href = localizedPath(world.href, language); return <Link key={world.id} href={href} onClick={navigateWithinSearch(href, closeMoreMenu)}>
            <span className={`world-mark world-mark--${world.id}`} aria-hidden="true" />
            <span><strong>{translate(world.shortLabel)}</strong><small>{translate(world.description)}</small></span>
          </Link>; })}
        </div>
      </details>
    </div>
  </nav>;
}

function SearchWorldIcon({ world }: { world: "vacation" | "spa" | "events" | "hourly" }) {
  if (world === "vacation") return <svg viewBox="0 0 24 24" fill="none"><path d="m3.5 11 8.5-7 8.5 7v8.4A1.6 1.6 0 0 1 18.9 21H5.1a1.6 1.6 0 0 1-1.6-1.6V11Z" /><circle cx="8.6" cy="12.1" r=".7" /><circle cx="15.4" cy="12.1" r=".7" /><path d="M8.6 14.8c.9 1.1 2 1.6 3.4 1.6s2.5-.5 3.4-1.6M10.3 21v-2.2h3.4V21" /></svg>;
  if (world === "spa") return <svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5c4.3-2.3 6.8-5.3 6.8-8.6A3.6 3.6 0 0 0 12 10.3a3.6 3.6 0 0 0-6.8 1.6c0 3.3 2.5 6.3 6.8 8.6Z" /><path d="M12 6.5c-.1-1.7.6-3 2.1-4M8.4 8C7 6.8 6.5 5.4 6.8 3.7M15.6 8c1.4-1.2 1.9-2.6 1.6-4.3" /></svg>;
  if (world === "events") return <svg viewBox="0 0 24 24" fill="none"><path d="M12 5.2c.7 3.6 2.8 5.7 6.4 6.4-3.6.7-5.7 2.8-6.4 6.4-.7-3.6-2.8-5.7-6.4-6.4 3.6-.7 5.7-2.8 6.4-6.4Z" /><path d="M5.2 4.2v2.4M4 5.4h2.4M19 17.7v2.1M18 18.7h2" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.3v5l3.3 2M8.2 3.8l-1.6 2.1M15.8 3.8l1.6 2.1" /></svg>;
}
