"use client";

/* eslint-disable @next/next/no-img-element */

import { useId, useRef } from "react";
import { FeatureIcon } from "./feature-icon";
import { SliderRailControls } from "./slider-rail-controls";

export type VerifiedSleepingRoom = {
  key: string;
  name: string;
  unitName?: string;
  details: string[];
  galleryImage?: string;
};

export function VerifiedSleepingDetails({ placeName, rooms }: { placeName: string; rooms: VerifiedSleepingRoom[] }) {
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();

  if (!rooms.length) return null;

  return <section id="sleeping" className="sleeping-section" aria-labelledby="sleeping-title">
    <div className="sleeping-section__heading">
      <div>
        <span className="eyebrow">חדרי השינה בתוך מקום האירוח</span>
        <h2 id="sleeping-title">איפה תשנו?</h2>
        <p>{rooms.length === 1 ? "חדר שינה אחד עם הפרטים שנמסרו על ידי המקום." : `${rooms.length} חדרי שינה. כל מלבן מציג חדר שינה נפרד ואת הפרטים שנמסרו עליו.`}</p>
      </div>
      <SliderRailControls railId={trackId} railRef={track} label="דפדוף בין חדרי השינה" className="sleeping-section__controls" />
    </div>

    <div id={trackId} className="sleeping-track" ref={track} data-horizontal-rail tabIndex={0} aria-label={`חדרי השינה של ${placeName}`}>
      {rooms.map((room) => <article className="sleeping-card" key={room.key}>
        {room.galleryImage ? <img src={room.galleryImage} alt={`${room.name} ב${placeName}`} title={`${room.name} ב${placeName}`} loading="lazy" /> : null}
        <div className="sleeping-card__body">
          {room.unitName ? <span>{room.unitName}</span> : null}
          <h3>{room.name}</h3>
          <div className="sleeping-card__amenities" aria-label={`פרטי ${room.name}`}>
            {room.details.map((detail) => <small key={detail}><FeatureIcon label={detail} className="sleeping-amenity-icon" />{detail}</small>)}
          </div>
        </div>
      </article>)}
    </div>
  </section>;
}
