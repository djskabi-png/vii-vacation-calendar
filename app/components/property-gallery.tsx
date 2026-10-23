"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { boundedSliderIndex } from "./slider-rail-controls";
import { useSiteLanguage } from "../i18n/locale-provider";

type PropertyGalleryProps = {
  images: string[];
  name: string;
  onOpen: (index: number) => void;
  className?: string;
};

export function PropertyGallery({ images, name, onOpen, className = "" }: PropertyGalleryProps) {
  const { language } = useSiteLanguage();
  const copy = language === "en"
    ? { gallery: "Photo gallery of", open: "Open gallery", image: "property photo", full: "View full gallery", previous: "Previous image", next: "Next image", position: "Image" }
    : language === "ru"
      ? { gallery: "Фотогалерея", open: "Открыть галерею", image: "фото объекта", full: "Открыть всю галерею", previous: "Предыдущее фото", next: "Следующее фото", position: "Фото" }
      : language === "fr"
        ? { gallery: "Galerie photo de", open: "Ouvrir la galerie", image: "photo de l’établissement", full: "Voir toute la galerie", previous: "Photo précédente", next: "Photo suivante", position: "Photo" }
        : { gallery: "גלריית תמונות של", open: "פתיחת גלריית", image: "תמונת המקום", full: "לגלריה המלאה", previous: "התמונה הקודמת", next: "התמונה הבאה", position: "תמונה" };
  const galleryImages = images.filter(Boolean);
  const [selected, setSelected] = useState(0);
  const touchStart = useRef<number | null>(null);

  if (!galleryImages.length) return null;

  const dotCount = Math.min(galleryImages.length, 5);
  const activeDot = galleryImages.length <= dotCount
    ? selected
    : Math.round((selected / (galleryImages.length - 1)) * (dotCount - 1));
  const imageIndex = (index: number) => index === 0 && selected >= 5 ? selected : index;

  const move = (direction: -1 | 1) => {
    setSelected((current) => boundedSliderIndex(current, direction, galleryImages.length));
  };

  return <section
    className={`property-gallery${galleryImages.length === 1 ? " single" : ""}${className ? ` ${className}` : ""}`}
    aria-label={`${copy.gallery} ${name}`}
    onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }}
    onTouchEnd={(event) => {
      if (touchStart.current === null || galleryImages.length < 2) return;
      const distance = event.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(distance) < 42) return;
      move(distance > 0 ? -1 : 1);
    }}
  >
    {galleryImages.slice(0, 5).map((image, index) => <button
      key={`${image}-${index}`}
      type="button"
      className={`property-gallery__image${selected === index || index === 0 && selected >= 5 ? " is-active" : ""}`}
      data-gallery-trigger
      aria-label={`${copy.open} ${name}, ${copy.position} ${imageIndex(index) + 1}`}
      onClick={() => onOpen(imageIndex(index))}
    >
      <img alt={`${name}, ${copy.image} ${imageIndex(index) + 1}`} src={galleryImages[imageIndex(index)]} title={`${name}, ${copy.image} ${imageIndex(index) + 1}`} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" />
      {index === 4 && <span>{copy.full}</span>}
    </button>)}

    {galleryImages.length > 1 ? <>
      <button className="property-gallery__mobile-arrow property-gallery__mobile-arrow--previous" type="button" disabled={selected === 0} data-slider-boundary onClick={() => move(-1)} aria-label={copy.previous}><span aria-hidden="true">›</span></button>
      <button className="property-gallery__mobile-arrow property-gallery__mobile-arrow--next" type="button" disabled={selected >= galleryImages.length - 1} data-slider-boundary onClick={() => move(1)} aria-label={copy.next}><span aria-hidden="true">‹</span></button>
      <div className="property-gallery__mobile-position" aria-label={`${copy.position} ${selected + 1}/${galleryImages.length}`}>
        <div className="property-gallery__mobile-dots" aria-hidden="true">
          {Array.from({ length: dotCount }, (_, index) => <i key={index} className={activeDot === index ? "is-active" : ""} />)}
        </div>
        <small aria-live="polite">{selected + 1} / {galleryImages.length}</small>
      </div>
    </> : null}
  </section>;
}
