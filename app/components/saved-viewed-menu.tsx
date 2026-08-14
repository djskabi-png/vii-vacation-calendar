"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSiteLanguage } from "../i18n/locale-provider";
import { readSavedItems, SAVED_ITEMS_EVENT } from "../lib/saved-items";
import { readViewedItems, VIEWED_ITEMS_EVENT } from "../lib/viewed-items";

const copy = {
  he: { label: "אהובים והיסטוריית צפייה", title: "המקומות שלי", saved: "מקומות שאהבתי", savedNote: "כל מה שסימנתי בלב", viewed: "מקומות שראיתי", viewedNote: "היסטוריית הצפייה במכשיר הזה" },
  en: { label: "Favorites and viewing history", title: "My places", saved: "My favorites", savedNote: "Everything I saved", viewed: "Recently viewed", viewedNote: "Viewing history on this device" },
  ru: { label: "Избранное и история просмотров", title: "Мои места", saved: "Избранное", savedNote: "Всё, что я сохранил", viewed: "Недавно просмотренные", viewedNote: "История на этом устройстве" },
  fr: { label: "Favoris et historique", title: "Mes lieux", saved: "Mes favoris", savedNote: "Tout ce que j’ai enregistré", viewed: "Lieux consultés", viewedNote: "Historique sur cet appareil" },
} as const;

function HeartMenuIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>;
}

function EyeMenuIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></svg>;
}

export function SavedViewedMenu() {
  const { language } = useSiteLanguage();
  const text = copy[language];
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({ saved: 0, viewed: 0 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const sync = () => setCounts({ saved: readSavedItems().length, viewed: readViewedItems().length });
    sync();
    window.addEventListener(SAVED_ITEMS_EVENT, sync);
    window.addEventListener(VIEWED_ITEMS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_ITEMS_EVENT, sync);
      window.removeEventListener(VIEWED_ITEMS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <div className="saved-viewed-menu" ref={rootRef}>
    <button ref={triggerRef} type="button" className="icon-button saved-viewed-menu__trigger" aria-label={text.label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><HeartMenuIcon /></button>
    {open ? <div className="saved-viewed-menu__popover" role="menu" aria-label={text.title}>
      <strong>{text.title}</strong>
      <Link href="/favorites?view=saved" role="menuitem" onClick={() => setOpen(false)}><span className="saved-viewed-menu__icon"><HeartMenuIcon /></span><span><b>{text.saved}</b><small>{text.savedNote}</small></span><em>{counts.saved}</em></Link>
      <Link href="/favorites?view=viewed" role="menuitem" onClick={() => setOpen(false)}><span className="saved-viewed-menu__icon"><EyeMenuIcon /></span><span><b>{text.viewed}</b><small>{text.viewedNote}</small></span><em>{counts.viewed}</em></Link>
    </div> : null}
  </div>;
}
