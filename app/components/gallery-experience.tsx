"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Property } from "../data/site-data";

type GallerySubject = Pick<Property, "name" | "images"> & Partial<Pick<Property, "roomOptions" | "sleepingArrangements" | "videos" | "guestPhotos">>;

type GalleryItem = {
  src: string;
  label: string;
  category: "place" | "units" | "bedrooms" | "guests";
  topic: string;
};

export type GalleryTab = "all" | GalleryItem["category"] | "videos";

export type GuestPhoto = {
  src: string;
  alt: string;
  author: string;
};

const tabLabels: Record<GalleryTab, string> = {
  all: "כל הסיפור",
  place: "המקום והמתקנים",
  units: "יחידות האירוח",
  bedrooms: "חדרי השינה",
  guests: "תמונות אורחים",
  videos: "סרטונים",
};

function uniqueItems(items: GalleryItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}

export function GalleryExperience({ property, open, initialIndex = 0, initialTab = "all", initialTopic, guestPhotos = property.guestPhotos || [], onAddGuestContent, onSelectionChange, onClose }: { property: GallerySubject; open: boolean; initialIndex?: number; initialTab?: GalleryTab; initialTopic?: string | null; guestPhotos?: GuestPhoto[]; onAddGuestContent?: () => void; onSelectionChange?: (tab: GalleryTab, index: number) => void; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const touchStart = useRef(0);
  const allItems = useMemo(() => {
    const unitItems = (property.roomOptions || []).flatMap((room) => (room.images?.length ? room.images : [room.image]).map((src, index) => ({ src, label: `${room.name} ב${property.name}, תמונה ${index + 1}`, category: "units" as const, topic: room.name })));
    const unitSources = new Set(unitItems.map((item) => item.src));
    const placeItems = property.images.filter((src) => !unitSources.has(src)).map((src, index) => ({ src, label: `${property.name}, תמונת המקום ${index + 1}`, category: "place" as const, topic: "המקום והמתקנים" }));
    return uniqueItems([
      ...placeItems,
      ...unitItems,
      ...(property.sleepingArrangements || []).map((room) => ({ src: room.galleryImage, label: `${room.name} ב${property.name}`, category: "bedrooms" as const, topic: "חדרי השינה" })),
      ...guestPhotos.map((photo) => ({ src: photo.src, label: `${photo.alt}, ${photo.author}`, category: "guests" as const, topic: "תמונות אורחים" })),
    ]);
  }, [guestPhotos, property]);
  const [tab, setTab] = useState<GalleryTab>(initialTab);
  const [topic, setTopic] = useState<string | null>(initialTopic || null);
  const [selected, setSelected] = useState(initialTopic ? 0 : initialIndex);
  const [mobileViewer, setMobileViewer] = useState(initialIndex > 0 || initialTab !== "all");

  const visibleItems = useMemo(() => {
    const items = tab === "all" ? allItems : tab === "videos" ? [] : allItems.filter((item) => item.category === tab);
    return topic ? items.filter((item) => item.topic === topic) : items;
  }, [allItems, tab, topic]);
  const current = visibleItems[Math.min(selected, Math.max(visibleItems.length - 1, 0))];
  const mobileGroups = useMemo(() => {
    const groups = new Map<string, Array<{ item: GalleryItem; index: number }>>();
    visibleItems.forEach((item, index) => groups.set(item.topic, [...(groups.get(item.topic) || []), { item, index }]));
    return [...groups.entries()];
  }, [visibleItems]);
  const tabs = (["all", "place", "units", "bedrooms", "guests", "videos"] as GalleryTab[]).filter((item) => item === "all" || item === "guests"
    || item === "videos" && Boolean(property.videos?.length)
    || item !== "videos" && allItems.some((media) => media.category === item));
  const move = useCallback((direction: -1 | 1) => {
    if (!visibleItems.length) return;
    setSelected((value) => (value + direction + visibleItems.length) % visibleItems.length);
  }, [visibleItems.length]);

  useEffect(() => {
    if (open) onSelectionChange?.(tab, selected);
  }, [onSelectionChange, open, selected, tab]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButton.current?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(1);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
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
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
    };
  }, [move, onClose, open]);

  if (!open) return null;

  function selectTab(next: GalleryTab) {
    setTab(next);
    setTopic(null);
    setSelected(0);
    setMobileViewer(false);
  }

  return <div ref={dialog} className="story-gallery" role="dialog" aria-modal="true" aria-labelledby="story-gallery-title">
    <header className="story-gallery__header">
      <div><span>{topic || "הגלריה של"}</span><h2 id="story-gallery-title">{property.name}</h2></div>
      <div className="story-gallery__count" aria-live="polite">{tab === "videos" ? `${property.videos?.length || 0} סרטונים` : tab === "guests" && !guestPhotos.length ? "עדיין אין תמונות אורחים" : mobileViewer ? `${selected + 1} מתוך ${visibleItems.length}` : `${visibleItems.length} תמונות`}</div>
      <button ref={closeButton} className="story-gallery__close" type="button" onClick={onClose} aria-label="סגירת הגלריה">סגירה</button>
    </header>

    <nav className="story-gallery__tabs" aria-label="נושאים בגלריה">
      {tabs.map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => selectTab(item)}>{tabLabels[item]}<small>{item === "videos" ? property.videos?.length : item === "all" ? allItems.length : allItems.filter((media) => media.category === item).length}</small></button>)}
    </nav>

    {tab === "guests" && !guestPhotos.length ? <div className="story-gallery__guest-empty">
      <span aria-hidden="true">+</span>
      <strong>הגלריה מחכה לתמונה הראשונה שלכם</strong>
      <p>תמונות אורחים יופיעו כאן עם שם המעלה רק לאחר הוכחת ביקור ואישור. כך ברור מה צולם על ידי העסק ומה שותף על ידי אורחים.</p>
      {onAddGuestContent ? <button type="button" onClick={onAddGuestContent}>הוספת תמונות וחוות דעת</button> : null}
    </div> : tab === "videos" ? <div className="story-gallery__videos">
      {property.videos?.map((video) => <article key={video.src}>
        <video controls playsInline preload="metadata" poster={video.poster} aria-label={video.title}><source src={video.src} type="video/mp4" /></video>
        <div><h3>{video.title}</h3><p>{video.note}</p></div>
      </article>)}
    </div> : <div className="story-gallery__workspace">
      <div className={`story-gallery__mobile-tour${mobileViewer ? " is-hidden" : ""}`} aria-label="סיור תמונות לפי נושאים">
        {mobileGroups.map(([topic, items]) => <section key={topic}><h3>{topic}</h3><div>{items.map(({ item, index }) => <button key={item.src} type="button" onClick={() => { setSelected(index); setMobileViewer(true); }} aria-label={`פתיחת ${item.label}`}><img src={item.src} alt={item.label} title={item.label} loading="lazy" /></button>)}</div></section>)}
      </div>
      <div className={`story-gallery__mobile-stage${mobileViewer ? " is-viewer" : ""}`} onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => {
        const distance = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
      }}>
        <button className="story-gallery__mobile-back" type="button" onClick={() => setMobileViewer(false)}>חזרה לכל התמונות</button>
        <div className="story-gallery__progress" aria-hidden="true">{visibleItems.map((item, index) => <i key={`mobile-${item.src}`} className={index <= selected ? "active" : ""} />)}</div>
        {current ? <img className="story-gallery__mobile-image" src={current.src} alt={current.label} title={current.label} /> : null}
        {visibleItems.length > 1 ? <><button className="story-gallery__tap story-gallery__tap--previous" type="button" onClick={() => move(-1)} aria-label="התמונה הקודמת" />
        <button className="story-gallery__tap story-gallery__tap--next" type="button" onClick={() => move(1)} aria-label="התמונה הבאה" /></> : null}
        <div className="story-gallery__caption"><span>{tabLabels[current?.category || "place"]}</span><strong>{current?.label}</strong></div>
      </div>
      <div className="story-gallery__story" onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => {
        const distance = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
      }}>
        <div className="story-gallery__progress" aria-hidden="true">{visibleItems.map((item, index) => <i key={item.src} className={index <= selected ? "active" : ""} />)}</div>
        {current ? <img className="story-gallery__image" src={current.src} alt={current.label} title={current.label} /> : null}
        {visibleItems.length > 1 ? <><button className="story-gallery__tap story-gallery__tap--previous" type="button" onClick={() => move(-1)} aria-label="התמונה הקודמת" />
        <button className="story-gallery__tap story-gallery__tap--next" type="button" onClick={() => move(1)} aria-label="התמונה הבאה" /></> : null}
        <div className="story-gallery__caption"><span>{tabLabels[current?.category || "place"]}</span><strong>{current?.label}</strong></div>
      </div>

      <div className="story-gallery__grid" aria-label="כל התמונות בנושא">
        {visibleItems.map((item, index) => <button key={item.src} className={index === selected ? "selected" : ""} type="button" onClick={() => setSelected(index)} aria-label={`הצגת ${item.label}`}><img src={item.src} alt="" title={item.label} /><span>{item.label}</span></button>)}
      </div>
    </div>}
  </div>;
}
