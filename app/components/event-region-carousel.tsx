"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import carouselTranslations from "../data/event-region-carousel-translations.json";

export type EventRegionCarouselItem = {
  label: string;
  href: string;
  image: string;
  venueCount: number;
};

type CarouselTranslationKey = keyof typeof carouselTranslations;

function carouselText(key: CarouselTranslationKey, language: SiteLanguage) {
  return carouselTranslations[key][language];
}

function venueCountLabel(count: number, language: SiteLanguage) {
  const lastTwo = count % 100;
  const last = count % 10;
  const form: CarouselTranslationKey = count === 1
    ? "venueOne"
    : language === "ru" && !(lastTwo >= 11 && lastTwo <= 14) && last >= 2 && last <= 4
      ? "venueFew"
      : "venueMany";
  return `${count} ${carouselText(form, language)} ${carouselText("areaSuffix", language)}`;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
  </svg>;
}

function RegionPinIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>;
}

export function EventRegionCarousel({ items }: { items: EventRegionCarouselItem[] }) {
  const { language, translate } = useSiteLanguage();
  const railRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const copy = {
    previous: carouselText("previous", language),
    next: carouselText("next", language),
    category: carouselText("category", language),
  };
  const isRtl = language === "he";

  const updateActiveIndex = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const railRect = rail.getBoundingClientRect();
    const anchor = isRtl ? railRect.right : railRect.left;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    itemRefs.current.forEach((item, index) => {
      if (!item) return;
      const rect = item.getBoundingClientRect();
      const distance = Math.abs((isRtl ? rect.right : rect.left) - anchor);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    setActiveIndex(closestIndex);
  }, [isRtl]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener("scroll", updateActiveIndex, { passive: true });
    window.addEventListener("resize", updateActiveIndex);
    updateActiveIndex();
    return () => {
      rail.removeEventListener("scroll", updateActiveIndex);
      window.removeEventListener("resize", updateActiveIndex);
    };
  }, [updateActiveIndex]);

  const goTo = (index: number) => {
    const nextIndex = Math.max(0, Math.min(items.length - 1, index));
    itemRefs.current[nextIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActiveIndex(nextIndex);
  };

  return <div className="event-region-carousel" dir={isRtl ? "rtl" : "ltr"}>
    <div className="event-region-carousel__toolbar">
      <span className="event-region-carousel__progress" aria-hidden="true">
        <b>{String(activeIndex + 1).padStart(2, "0")}</b>
        <i />
        <span>{String(items.length).padStart(2, "0")}</span>
      </span>
      <div className="event-region-carousel__controls">
        <button type="button" onClick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0} aria-label={copy.previous}>
          <ChevronIcon direction={isRtl ? "right" : "left"} />
        </button>
        <button type="button" onClick={() => goTo(activeIndex + 1)} disabled={activeIndex === items.length - 1} aria-label={copy.next}>
          <ChevronIcon direction={isRtl ? "left" : "right"} />
        </button>
      </div>
    </div>

    <nav ref={railRef} className="event-region-carousel__rail" data-horizontal-rail aria-label={translate("מקומות לאירועים לפי אזור")}>
      {items.map((item, index) => {
        const label = translate(item.label);
        const countLabel = venueCountLabel(item.venueCount, language);
        return <Link
          ref={(node) => { itemRefs.current[index] = node; }}
          key={item.label}
          className="event-region-carousel__card"
          href={item.href}
          aria-label={`${label}, ${countLabel}`}
        >
          <img src={item.image} alt="" loading="lazy" decoding="async" />
          <span className="event-region-carousel__shade" />
          <span className="event-region-carousel__pin"><RegionPinIcon /></span>
          <span className="event-region-carousel__content">
            <small>{copy.category}</small>
            <strong>{label}</strong>
            <span>{countLabel}</span>
          </span>
          <span className="event-region-carousel__action" aria-hidden="true">
            <ChevronIcon direction={isRtl ? "left" : "right"} />
          </span>
        </Link>;
      })}
    </nav>
  </div>;
}
