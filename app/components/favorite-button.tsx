"use client";

import { useEffect, useState } from "react";
import { HeartIcon } from "../site-header";
import { readSavedItems, savedItemKey, SAVED_ITEMS_EVENT, type SavedItem, type SavedWorld, writeSavedItems } from "../lib/saved-items";

type Props = {
  id: string;
  world: SavedWorld;
  name: string;
  location: string;
  image?: string;
  href: string;
  meta?: string;
  compact?: boolean;
  className?: string;
};

export function FavoriteButton({ id, world, name, location, image, href, meta, compact = true, className = "" }: Props) {
  const key = savedItemKey(world, id);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(readSavedItems().some((item) => item.key === key));
    const timer = window.setTimeout(sync, 0);
    window.addEventListener(SAVED_ITEMS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(SAVED_ITEMS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [key]);

  function toggle() {
    const current = readSavedItems();
    if (current.some((item) => item.key === key)) {
      writeSavedItems(current.filter((item) => item.key !== key));
      setSaved(false);
      return;
    }

    const item: SavedItem = { key, id, world, name, location, image, href, meta, savedAt: new Date().toISOString() };
    writeSavedItems([item, ...current]);
    setSaved(true);
  }

  return <button
    type="button"
    className={`universal-favorite${compact ? " universal-favorite--compact" : ""}${saved ? " is-saved" : ""}${className ? ` ${className}` : ""}`}
    aria-label={saved ? `הסרת ${name} מהמקומות שאהבתי` : `שמירת ${name} במקומות שאהבתי`}
    aria-pressed={saved}
    onClick={toggle}
  >
    <HeartIcon filled={saved} />
    {!compact ? <span>{saved ? "נשמר" : "שמירה"}</span> : null}
  </button>;
}
