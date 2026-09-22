"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";

type PropertyGalleryProps = {
  images: string[];
  name: string;
  onOpen: (index: number) => void;
  className?: string;
};

export function PropertyGallery({ images, name, onOpen, className = "" }: PropertyGalleryProps) {
  const galleryImages = images.filter(Boolean);
  const [selected, setSelected] = useState(0);
  const touchStart = useRef<number | null>(null);

  if (!galleryImages.length) return null;

  const dotCount = Math.min(galleryImages.length, 5);
  const activeDot = galleryImages.length <= dotCount
    ? selected
    : Math.round((selected / (galleryImages.length - 1)) * (dotCount - 1));

  const move = (direction: -1 | 1) => {
    setSelected((current) => (current + direction + galleryImages.length) % galleryImages.length);
  };

  return <section
    className={`property-gallery${galleryImages.length === 1 ? " single" : ""}${className ? ` ${className}` : ""}`}
    aria-label={`גלריית תמונות של ${name}`}
    onTouchStart={(event) => { touchStart.current = event.changedTouches[0].clientX; }}
    onTouchEnd={(event) => {
      if (touchStart.current === null || galleryImages.length < 2) return;
      const distance = event.changedTouches[0].clientX - touchStart.current;
      touchStart.current = null;
      if (Math.abs(distance) < 42) return;
      move(distance > 0 ? -1 : 1);
    }}
  >
    {galleryImages.map((image, index) => <button
      key={`${image}-${index}`}
      type="button"
      className={`property-gallery__image${index >= 5 ? " is-desktop-extra" : ""}${selected === index ? " is-active" : ""}`}
      data-gallery-trigger
      aria-label={`פתיחת גלריית ${name}, תמונה ${index + 1}`}
      onClick={() => onOpen(index)}
    >
      <img src={image} alt={`${name}, תמונת המקום ${index + 1}`} title={`${name}, תמונת המקום ${index + 1}`} />
      {index === 4 && <span>לגלריה המלאה</span>}
    </button>)}

    {galleryImages.length > 1 ? <>
      <button className="property-gallery__mobile-arrow property-gallery__mobile-arrow--previous" type="button" onClick={() => move(-1)} aria-label="התמונה הקודמת"><span aria-hidden="true">›</span></button>
      <button className="property-gallery__mobile-arrow property-gallery__mobile-arrow--next" type="button" onClick={() => move(1)} aria-label="התמונה הבאה"><span aria-hidden="true">‹</span></button>
      <div className="property-gallery__mobile-position" aria-label={`תמונה ${selected + 1} מתוך ${galleryImages.length}`}>
        <div className="property-gallery__mobile-dots" aria-hidden="true">
          {Array.from({ length: dotCount }, (_, index) => <i key={index} className={activeDot === index ? "is-active" : ""} />)}
        </div>
        <small aria-live="polite">{selected + 1} / {galleryImages.length}</small>
      </div>
    </> : null}
  </section>;
}
