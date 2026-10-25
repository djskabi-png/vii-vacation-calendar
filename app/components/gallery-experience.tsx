"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Property } from "../data/site-data";
import { boundedSliderIndex } from "./slider-rail-controls";
import { visibleGalleryItems, type GallerySelectionTab } from "./gallery-selection";

type GallerySubject = Pick<Property, "name" | "images"> & Partial<Pick<Property, "galleryGroups" | "roomOptions" | "sleepingArrangements" | "videos" | "guestPhotos">>;

type GalleryItem = {
  src: string;
  label: string;
  category: "place" | "units" | "bedrooms" | "guests";
  topic: string;
};

export type GalleryTab = GallerySelectionTab;

export type GuestPhoto = {
  src: string;
  alt: string;
  author: string;
};

const tabLabels: Record<GalleryTab, string> = {
  all: "כל התמונות",
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

function resolvedInitialTopic(items: GalleryItem[], property: GallerySubject, requested?: string | null) {
  if (!requested) return null;
  if (items.some((item) => item.topic === requested)) return requested;
  const room = property.roomOptions?.find((option) => option.name === requested);
  const roomSources = new Set(room ? (room.images?.length ? room.images : room.image ? [room.image] : []) : []);
  return items.find((item) => roomSources.has(item.src))?.topic ?? null;
}

export function GalleryExperience({ property, open, initialIndex = 0, initialTab = "all", initialTopic, guestPhotos = property.guestPhotos || [], onAddGuestContent, onSelectionChange, onClose }: { property: GallerySubject; open: boolean; initialIndex?: number; initialTab?: GalleryTab; initialTopic?: string | null; guestPhotos?: GuestPhoto[]; onAddGuestContent?: () => void; onSelectionChange?: (tab: GalleryTab, index: number, topic: string | null) => void; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const gestureStart = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const allItems = useMemo(() => {
    const unitItems = (property.roomOptions || []).flatMap((room) => (room.images?.length ? room.images : room.image ? [room.image] : []).map((src, index) => ({ src, label: `${room.name} ב${property.name}, תמונה ${index + 1}`, category: "units" as const, topic: room.name })));
    const groupedPlaceItems = property.galleryGroups?.length
      ? property.galleryGroups.flatMap((group) => group.images.map((src, index) => ({ src, label: `${group.title} ב${property.name}, תמונה ${index + 1}`, category: "place" as const, topic: group.title })))
      : property.images.map((src, index) => ({ src, label: `${property.name}, תמונת המקום ${index + 1}`, category: "place" as const, topic: "המקום והמתקנים" }));
    const groupedSources = new Set(groupedPlaceItems.map((item) => item.src));
    return uniqueItems([
      // Supplier galleries are the editorial source of truth. Keep their
      // exact title and membership instead of replacing them with the broad
      // generic "place" or "units" buckets. A room-only image is appended
      // only when the supplier did not put it in a named gallery.
      ...groupedPlaceItems,
      ...unitItems.filter((item) => !groupedSources.has(item.src)),
      ...(property.sleepingArrangements || []).map((room) => ({ src: room.galleryImage, label: `${room.name} ב${property.name}`, category: "bedrooms" as const, topic: "חדרי השינה" })),
      ...guestPhotos.map((photo) => ({ src: photo.src, label: `${photo.alt}, ${photo.author}`, category: "guests" as const, topic: "תמונות אורחים" })),
    ]);
  }, [guestPhotos, property]);
  const [tab, setTab] = useState<GalleryTab>(initialTab);
  const [topic, setTopic] = useState<string | null>(() => resolvedInitialTopic(allItems, property, initialTopic));
  const [selected, setSelected] = useState(initialTopic ? 0 : initialIndex);
  // Mobile always starts with the complete visual overview. The requested
  // index and topic still select the right media for desktop and for the
  // focused viewer after the visitor chooses an image.
  const [mobileViewer, setMobileViewer] = useState(false);
  const [mobileTourAll, setMobileTourAll] = useState(true);

  const visibleItems = useMemo(() => {
    return visibleGalleryItems(allItems, tab, topic);
  }, [allItems, tab, topic]);
  const current = visibleItems[Math.min(selected, Math.max(visibleItems.length - 1, 0))];
  const mobileGroups = useMemo(() => {
    const groups = new Map<string, Array<{ item: GalleryItem; index: number }>>();
    const tourItems = mobileTourAll ? allItems : visibleItems;
    tourItems.forEach((item) => {
      const current = groups.get(item.topic) || [];
      groups.set(item.topic, [...current, { item, index: current.length }]);
    });
    return [...groups.entries()];
  }, [allItems, mobileTourAll, visibleItems]);
  const topicTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allItems) {
      if (item.category === "guests") continue;
      counts.set(item.topic, (counts.get(item.topic) || 0) + 1);
    }
    return [...counts].map(([title, count]) => ({ title, count }));
  }, [allItems]);
  const move = useCallback((direction: -1 | 1) => {
    if (!visibleItems.length) return;
    setSelected((value) => boundedSliderIndex(value, direction, visibleItems.length));
  }, [visibleItems.length]);

  const startGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" || (event.target as HTMLElement).closest("button")) return;
    gestureStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    if (event.isPrimary) event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const finishGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const distanceX = event.clientX - start.x;
    const distanceY = event.clientY - start.y;
    if (Math.abs(distanceX) < 48 || Math.abs(distanceX) <= Math.abs(distanceY) * 1.2) return;
    move(distanceX > 0 ? -1 : 1);
  }, [move]);

  useEffect(() => {
    if (open) onSelectionChange?.(tab, selected, topic);
  }, [onSelectionChange, open, selected, tab, topic]);

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
    setMobileTourAll(next === "all");
  }

  function selectTopic(next: string) {
    setTab("all");
    setTopic(next);
    setSelected(0);
    setMobileViewer(false);
    setMobileTourAll(false);
  }

  return <div ref={dialog} className="story-gallery" role="dialog" aria-modal="true" aria-labelledby="story-gallery-title">
    <header className="story-gallery__header">
      <div><span>{topic ? `גלריית ${topic}` : "גלריית תמונות"}</span><h2 id="story-gallery-title">{topic ? `${topic} · ${property.name}` : property.name}</h2></div>
      <div className="story-gallery__count" aria-live="polite">{tab === "videos" ? `${property.videos?.length || 0} סרטונים` : tab === "guests" && !guestPhotos.length ? "עדיין אין תמונות אורחים" : mobileViewer ? `${selected + 1} מתוך ${visibleItems.length}` : `${visibleItems.length} תמונות`}</div>
      <button ref={closeButton} className="story-gallery__close" type="button" onClick={onClose} aria-label="סגירת הגלריה">סגירה</button>
    </header>

    <nav className="story-gallery__tabs" aria-label="נושאים בגלריה">
      <button type="button" aria-pressed={tab === "all" && !topic} onClick={() => selectTab("all")}>{tabLabels.all}<small>{allItems.length}</small></button>
      {topicTabs.map((item) => <button key={item.title} type="button" aria-pressed={topic === item.title} onClick={() => selectTopic(item.title)}>{item.title}<small>{item.count}</small></button>)}
      <button type="button" aria-pressed={tab === "guests"} onClick={() => selectTab("guests")}>{tabLabels.guests}<small>{guestPhotos.length}</small></button>
      {property.videos?.length ? <button type="button" aria-pressed={tab === "videos"} onClick={() => selectTab("videos")}>{tabLabels.videos}<small>{property.videos.length}</small></button> : null}
    </nav>

    {tab === "guests" && !guestPhotos.length ? <div className="story-gallery__guest-empty">
      {onAddGuestContent ? <button className="story-gallery__guest-add" type="button" onClick={onAddGuestContent} aria-label="הוספת תמונות וחוות דעת">+</button> : <span aria-hidden="true">+</span>}
      <strong>הגלריה מחכה לתמונה הראשונה שלכם</strong>
      <p>תמונות אורחים יופיעו כאן עם שם המעלה רק לאחר הוכחת ביקור ואישור. כך ברור מה צולם על ידי העסק ומה שותף על ידי אורחים.</p>
      {onAddGuestContent ? <button type="button" onClick={onAddGuestContent}>הוספת תמונות וחוות דעת</button> : null}
    </div> : tab === "videos" ? <div className="story-gallery__videos">
      {property.videos?.map((video) => <article key={video.src}>
        <video controls playsInline preload="metadata" poster={video.poster} aria-label={video.title}><source src={video.src} type="video/mp4" /></video>
        <div><h3>{video.title}</h3><p>{video.note}</p></div>
      </article>)}
    </div> : <div className={`story-gallery__workspace${mobileViewer ? " is-viewer" : ""}`}>
      <div className={`story-gallery__mobile-tour${mobileViewer ? " is-hidden" : ""}`} aria-label="סיור תמונות לפי נושאים">
        {mobileGroups.map(([topic, items]) => <section key={topic}><h3>{topic}</h3><div>{items.map(({ item, index }) => <button key={item.src} type="button" onClick={() => { setTab("all"); setTopic(item.topic); setSelected(index); setMobileTourAll(false); setMobileViewer(true); }} aria-label={`פתיחת ${item.label}`}><img src={item.src} alt={item.label} title={item.label} loading="lazy" /></button>)}</div></section>)}
      </div>
      <div className={`story-gallery__mobile-stage${mobileViewer ? " is-viewer" : ""}`} onPointerDown={startGesture} onPointerUp={finishGesture} onPointerCancel={() => { gestureStart.current = null; }}>
        <div className="story-gallery__mobile-media">
          <button className="story-gallery__mobile-back" type="button" onClick={() => setMobileViewer(false)}>חזרה לכל התמונות</button>
          <div className="story-gallery__progress" aria-hidden="true">{visibleItems.map((item, index) => <i key={`mobile-${item.src}`} className={index <= selected ? "active" : ""} />)}</div>
          {current ? <img className="story-gallery__mobile-image" src={current.src} alt={current.label} title={current.label} /> : null}
          {visibleItems.length > 1 ? <><button className="story-gallery__tap story-gallery__tap--previous" type="button" disabled={selected === 0} data-slider-boundary onClick={() => move(-1)} aria-label="התמונה הקודמת"><span className="story-gallery__tap-icon" aria-hidden="true">›</span></button>
          <button className="story-gallery__tap story-gallery__tap--next" type="button" disabled={selected >= visibleItems.length - 1} data-slider-boundary onClick={() => move(1)} aria-label="התמונה הבאה"><span className="story-gallery__tap-icon" aria-hidden="true">‹</span></button></> : null}
          <span className="story-gallery__mobile-position" aria-live="polite">{selected + 1}/{visibleItems.length}</span>
          <div className="story-gallery__caption"><span>{current?.topic || tabLabels[current?.category || "place"]}</span><strong>{current?.label}</strong></div>
        </div>
      </div>
      <div className="story-gallery__story" onPointerDown={startGesture} onPointerUp={finishGesture} onPointerCancel={() => { gestureStart.current = null; }}>
        <div className="story-gallery__progress" aria-hidden="true">{visibleItems.map((item, index) => <i key={item.src} className={index <= selected ? "active" : ""} />)}</div>
        {current ? <img className="story-gallery__image" src={current.src} alt={current.label} title={current.label} /> : null}
        {visibleItems.length > 1 ? <><button className="story-gallery__tap story-gallery__tap--previous" type="button" disabled={selected === 0} data-slider-boundary onClick={() => move(-1)} aria-label="התמונה הקודמת"><span className="story-gallery__tap-icon" aria-hidden="true">›</span></button>
        <button className="story-gallery__tap story-gallery__tap--next" type="button" disabled={selected >= visibleItems.length - 1} data-slider-boundary onClick={() => move(1)} aria-label="התמונה הבאה"><span className="story-gallery__tap-icon" aria-hidden="true">‹</span></button></> : null}
        <div className="story-gallery__caption"><span>{current?.topic || tabLabels[current?.category || "place"]}</span><strong>{current?.label}</strong></div>
      </div>

      <div className="story-gallery__grid" aria-label="כל התמונות בנושא">
        {visibleItems.map((item, index) => <button key={item.src} className={index === selected ? "selected" : ""} type="button" onClick={() => setSelected(index)} aria-label={`הצגת ${item.label}`}><img src={item.src} alt="" title={item.label} data-image-role="decorative" loading="lazy" /><span>{item.label}</span></button>)}
      </div>
    </div>}
  </div>;
}
