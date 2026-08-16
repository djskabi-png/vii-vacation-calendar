"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";
import type { StayOption } from "../data/site-data";

export function UnitDetailsDialog({ propertyName, room, open, onClose, onOpenGallery }: { propertyName: string; room: StayOption | null; open: boolean; onClose: () => void; onOpenGallery: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButton.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])") || []);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
      window.setTimeout(() => opener?.focus(), 0);
    };
  }, [onClose, open]);

  if (!open || !room) return null;
  const groups = room.featureGroups?.length ? room.featureGroups : [{ title: "כל מה שיש ביחידה", items: room.features }];
  return <div className="unit-details-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="unit-details-dialog" role="dialog" aria-modal="true" aria-labelledby="unit-details-title">
      <header><div><span>{propertyName}</span><h2 id="unit-details-title">{room.name}</h2></div><button ref={closeButton} type="button" onClick={onClose} aria-label="סגירת פרטי היחידה">×</button></header>
      <button className="unit-details-dialog__image" type="button" onClick={onOpenGallery} aria-label={`פתיחת גלריית ${room.name}`}>
        <img src={room.image} alt={`${room.name} ב${propertyName}`} title={`${room.name} ב${propertyName}`} />
        <span>לכל תמונות היחידה</span>
      </button>
      <div className="unit-details-dialog__intro"><p>{room.description || `${room.name} היא יחידת אירוח נפרדת ב${propertyName}.`}</p><div><span>{room.bedrooms === 1 ? "חדר שינה אחד" : `${room.bedrooms} חדרי שינה`}</span><span>עד {room.guests} אורחים</span>{room.area ? <span>{room.area} מ״ר</span> : null}</div></div>
      <div className="unit-details-dialog__groups">{groups.map((group) => <section key={group.title}><h3>{group.title}</h3><div>{group.items.map((item) => <span key={item}>✓ {item}</span>)}</div></section>)}</div>
    </section>
  </div>;
}
