"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { usePreviewGallery } from "./use-preview-gallery";
import { ViewportResilientImage } from "./viewport-resilient-image";
import { defaultCardImageSizes, isOptimizableCardMedia, responsiveCardMedia } from "../lib/responsive-media";
import { useSiteLanguage } from "../i18n/locale-provider";

export function unitPreviewSources(images: string[]) {
  const seen = new Set<string>();
  return images.map((src, originalIndex) => ({ src, originalIndex })).filter(({ src }) => Boolean(src) && !seen.has(src) && seen.add(src));
}

export function nextUnitPreviewIndex(images: string[], failed: ReadonlySet<string>, current: number, direction: -1 | 1 = 1) {
  for (let index = current + direction; index >= 0 && index < images.length; index += direction) if (!failed.has(images[index])) return index;
  return images.findIndex((image) => image !== images[current] && !failed.has(image));
}

/**
 * Unit-scoped preview gallery. Unlike listing cards this deliberately does
 * not cap the supplier's unit gallery: the full gallery remains available to
 * the detail dialog, while this preview can advance through every valid unit
 * image and never falls back to another unit's media.
 */
export function UnitPreviewGallery({ images, roomName, propertyName, onOpen }: {
  images: string[];
  roomName: string;
  propertyName: string;
  onOpen: (index: number) => void;
}) {
  const { language } = useSiteLanguage();
  const photoLabel = { he: "תמונה", en: "Photo", ru: "Фото", fr: "Photo" }[language];
  const failedLabel = { he: "התמונה לא נטענה", en: "The photo could not load", ru: "Не удалось загрузить фотографию", fr: "La photo n’a pas pu être chargée" }[language];
  const copy = language === "en" ? { previous: "Previous image", next: "Next image", open: "Open gallery", unavailable: "No unit image available" } : language === "ru" ? { previous: "Предыдущее фото", next: "Следующее фото", open: "Открыть галерею", unavailable: "Фото юнита недоступно" } : language === "fr" ? { previous: "Image précédente", next: "Image suivante", open: "Ouvrir la galerie", unavailable: "Aucune image disponible" } : { previous: "התמונה הקודמת", next: "התמונה הבאה", open: "פתיחת גלריה", unavailable: "אין תמונה זמינה עבור היחידה" };
  const sources = useMemo(() => unitPreviewSources(images), [images]);
  const galleryImages = useMemo(() => sources.map(({ src }) => src), [sources]);
  const { imageIndex, navigationIndex, setImageIndex, warmImages, pending } = usePreviewGallery(galleryImages);
  const galleryKey = galleryImages.join("\n");
  const [brokenState, setBrokenState] = useState<{ key: string; values: Set<string> }>({ key: galleryKey, values: new Set() });
  const [failedDerivative, setFailedDerivative] = useState<string | null>(null);
  const broken = brokenState.key === galleryKey ? brokenState.values : new Set<string>();
  const touchStart = useRef<number | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => setBrokenState({ key: galleryKey, values: new Set() }), [galleryKey]);
  const usable = galleryImages.filter((image) => !broken.has(image));
  const currentImage = galleryImages[imageIndex] || usable[0] || "";
  const media = responsiveCardMedia(currentImage);
  const useOriginal = failedDerivative === currentImage;
  if (!usable.length) return <div className="room-card__image room-card__image--missing room-card__image--unavailable" role="img" aria-label={copy.unavailable}><span>{copy.unavailable}</span></div>;
  const move = (event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => Math.max(0, Math.min(galleryImages.length - 1, current + direction)));
  };
  const keyMove = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? 1 : -1;
      setImageIndex((current) => Math.max(0, Math.min(galleryImages.length - 1, current + direction)));
    }
  };
  const failedCurrent = broken.has(currentImage);
  const originalIndex = sources[imageIndex]?.originalIndex ?? imageIndex;
  return <div className="room-card__image room-card__image--gallery" aria-busy={pending || undefined} onTouchStart={(event) => { touchStart.current = event.changedTouches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const delta = event.changedTouches[0]?.clientX - touchStart.current; touchStart.current = null; if (Math.abs(delta) > 45) { suppressClick.current = true; setImageIndex((current) => Math.max(0, Math.min(galleryImages.length - 1, current + (delta < 0 ? 1 : -1)))); window.setTimeout(() => { suppressClick.current = false; }, 500); } }}>
    <button className="room-card__image-button" style={{ position: "absolute", inset: 0, display: "block", width: "100%", height: "100%", padding: 0, border: 0, background: "transparent" }} type="button" data-gallery-trigger onKeyDown={keyMove} onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onOpen(originalIndex); }} aria-label={`${copy.open}: ${roomName}`}>
      <ViewportResilientImage src={useOriginal ? currentImage : media.src} srcSet={useOriginal ? undefined : media.srcSet} sizes={defaultCardImageSizes} alt={`${roomName}, ${propertyName}, ${photoLabel} ${imageIndex + 1}/${galleryImages.length}`} title={`${roomName}, ${propertyName}`} width="960" height="640" loading="lazy" decoding="async" onLoad={warmImages} onFailure={() => {
        if (isOptimizableCardMedia(currentImage) && !useOriginal) { setFailedDerivative(currentImage); return; }
        const failedNow = new Set(broken).add(currentImage);
        setBrokenState({ key: galleryKey, values: failedNow });
        const fallback = nextUnitPreviewIndex(galleryImages, failedNow, imageIndex, 1);
        if (fallback >= 0) setImageIndex(fallback);
      }} />
    </button>
    {galleryImages.length > 1 ? <>
      <button className="preview-card-gallery__arrow preview-card-gallery__arrow--previous" type="button" aria-label={`${copy.previous}: ${roomName}`} disabled={navigationIndex === 0} onClick={(event) => move(event, -1)}>‹</button>
      <button className="preview-card-gallery__arrow preview-card-gallery__arrow--next" type="button" aria-label={`${copy.next}: ${roomName}`} disabled={navigationIndex >= galleryImages.length - 1} onClick={(event) => move(event, 1)}>›</button>
      <span className="preview-card-gallery__count" aria-live="polite">{imageIndex + 1}/{galleryImages.length}</span>
    </> : null}
    {failedCurrent ? <span className="sr-only">{failedLabel}</span> : null}
  </div>;
}
