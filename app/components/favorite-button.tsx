"use client";

import { useEffect, useState } from "react";
import { HeartIcon } from "../site-header";
import { useSiteLanguage } from "../i18n/locale-provider";
import { readSavedItems, savedItemKey, SAVED_ITEMS_EVENT, type SavedItem, type SavedWorld, writeSavedItems } from "../lib/saved-items";
import { ACTION_FEEDBACK_EVENT } from "./global-action-feedback";

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
  const { language } = useSiteLanguage();
  const key = savedItemKey(world, id);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = {
    he: { save: "שמירה", saved: "נשמר", saving: "שומרים באהבתי...", removing: "מסירים מאהבתי...", added: "נשמר במקומות שאהבתי", removed: "הוסר מהמקומות שאהבתי", addLabel: "שמירה במקומות שאהבתי", removeLabel: "הסרה מהמקומות שאהבתי" },
    en: { save: "Save", saved: "Saved", saving: "Saving to favorites...", removing: "Removing from favorites...", added: "Saved to favorites", removed: "Removed from favorites", addLabel: "Save to favorites", removeLabel: "Remove from favorites" },
    ru: { save: "Сохранить", saved: "Сохранено", saving: "Сохраняем...", removing: "Удаляем...", added: "Сохранено в избранном", removed: "Удалено из избранного", addLabel: "Сохранить в избранное", removeLabel: "Удалить из избранного" },
    fr: { save: "Enregistrer", saved: "Enregistré", saving: "Enregistrement...", removing: "Suppression...", added: "Enregistré dans les favoris", removed: "Supprimé des favoris", addLabel: "Enregistrer dans les favoris", removeLabel: "Supprimer des favoris" },
  }[language];

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

  function announce(message: string, duration = 1500) {
    window.dispatchEvent(new CustomEvent(ACTION_FEEDBACK_EVENT, { detail: { message, duration } }));
  }

  function toggle() {
    if (busy) return;
    const current = readSavedItems();
    const isSaved = current.some((item) => item.key === key);
    setBusy(true);
    announce(isSaved ? copy.removing : copy.saving, 9000);
    window.setTimeout(() => {
      if (isSaved) {
        writeSavedItems(current.filter((item) => item.key !== key));
        setSaved(false);
        announce(copy.removed);
      } else {
        const item: SavedItem = { key, id, world, name, location, image, href, meta, savedAt: new Date().toISOString() };
        writeSavedItems([item, ...current]);
        setSaved(true);
        announce(copy.added);
      }
      setBusy(false);
    }, 320);
  }

  return <button
    type="button"
    className={`universal-favorite${compact ? " universal-favorite--compact" : ""}${saved ? " is-saved" : ""}${busy ? " is-loading" : ""}${className ? ` ${className}` : ""}`}
    aria-label={`${saved ? copy.removeLabel : copy.addLabel}: ${name}`}
    aria-pressed={saved}
    aria-busy={busy}
    disabled={busy}
    onClick={toggle}
  >
    <span className="universal-favorite__icon"><HeartIcon filled={saved} /></span>
    {!compact ? <span>{busy ? (saved ? copy.removing : copy.saving) : saved ? copy.saved : copy.save}</span> : null}
  </button>;
}
