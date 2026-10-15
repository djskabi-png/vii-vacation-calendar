"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

const galleryCopy: Record<SiteLanguage, { previous: string; next: string; image: string }> = {
  he: { previous: "התמונה הקודמת", next: "התמונה הבאה", image: "תמונה" },
  en: { previous: "Previous image", next: "Next image", image: "Image" },
  ru: { previous: "Предыдущее фото", next: "Следующее фото", image: "Фото" },
  fr: { previous: "Image précédente", next: "Image suivante", image: "Image" },
};

function ChevronLeft() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>;
}

function ChevronRight() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>;
}

export function PreviewCardGallery({
  images,
  href,
  name,
  className,
  imageFit = "cover",
  imagePosition,
  imageLabel,
  linkLabel,
  countLabel,
  children,
}: {
  images: string[];
  href: string;
  name: string;
  className: string;
  imageFit?: "cover" | "contain";
  imagePosition?: string;
  imageLabel?: string;
  linkLabel?: string;
  countLabel?: (count: number) => string;
  children?: ReactNode;
}) {
  const { language } = useSiteLanguage();
  const copy = galleryCopy[language];
  const galleryImages = [...new Set(images.filter(Boolean))].slice(0, 10);
  const [imageIndex, setImageIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const swipeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentImage = galleryImages[imageIndex] || galleryImages[0] || "";
  const previousDisabled = imageIndex === 0;
  const nextDisabled = imageIndex >= galleryImages.length - 1;
  const imageStyle: CSSProperties | undefined = imagePosition || imageFit === "contain"
    ? { objectPosition: imagePosition, objectFit: imageFit }
    : undefined;

  function moveImage(event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => Math.max(0, Math.min(galleryImages.length - 1, current + direction)));
  }

  return <div
    className={`preview-card-gallery ${className}`}
    onTouchStart={(event) => {
      if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current);
      didSwipe.current = false;
      touchStart.current = event.changedTouches[0].clientX;
    }}
    onTouchEnd={(event) => {
      if (touchStart.current === null || galleryImages.length < 2) return;
      const distance = event.changedTouches[0].clientX - touchStart.current;
      if (Math.abs(distance) > 45) {
        didSwipe.current = true;
        swipeResetTimer.current = setTimeout(() => { didSwipe.current = false; swipeResetTimer.current = null; }, 500);
        setImageIndex((current) => Math.max(0, Math.min(galleryImages.length - 1, current + (distance > 0 ? -1 : 1))));
      }
      touchStart.current = null;
    }}
  >
    <Link
      className="preview-card-gallery__link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={linkLabel || `${name}, ${copy.image} ${imageIndex + 1}/${galleryImages.length}`}
      onClick={(event) => {
        if (!didSwipe.current) return;
        event.preventDefault();
        event.stopPropagation();
        didSwipe.current = false;
        if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current);
        swipeResetTimer.current = null;
      }}
    >
      {currentImage ? <img key={currentImage} src={currentImage} alt={`${name}, ${copy.image} ${imageIndex + 1}/${galleryImages.length}`} title={imageLabel || `${name}, ${copy.image} ${imageIndex + 1}/${galleryImages.length}`} loading="lazy" decoding="async" style={imageStyle} /> : null}
    </Link>
    {galleryImages.length > 1 ? <>
      <button className="preview-card-gallery__arrow preview-card-gallery__arrow--previous" type="button" aria-label={`${copy.previous}: ${name}`} title={copy.previous} disabled={previousDisabled} data-slider-boundary onClick={(event) => moveImage(event, -1)}>{language === "he" ? <ChevronRight /> : <ChevronLeft />}</button>
      <button className="preview-card-gallery__arrow preview-card-gallery__arrow--next" type="button" aria-label={`${copy.next}: ${name}`} title={copy.next} disabled={nextDisabled} data-slider-boundary onClick={(event) => moveImage(event, 1)}>{language === "he" ? <ChevronLeft /> : <ChevronRight />}</button>
      <span className="preview-card-gallery__count" aria-live="polite">{countLabel ? countLabel(galleryImages.length) : `${imageIndex + 1}/${galleryImages.length}`}</span>
    </> : null}
    {children}
  </div>;
}
