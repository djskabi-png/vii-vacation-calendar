"use client";

/* eslint-disable @next/next/no-img-element */

import { useId, useRef } from "react";
import { FeatureIcon } from "./feature-icon";
import { SliderRailControls } from "./slider-rail-controls";
import type { VerifiedSleepingRoom } from "../lib/verified-sleeping-rooms";

export function VerifiedSleepingDetails({ placeName, rooms }: { placeName: string; rooms: VerifiedSleepingRoom[] }) {
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();
  const bedroomCount = rooms.reduce((total, room) => total + room.bedroomCount, 0);
  const everyCardIsOneBedroom = rooms.every((room) => room.bedroomCount === 1);

  if (!rooms.length) return null;

  return <section id="sleeping" className="sleeping-section" aria-labelledby="sleeping-title">
    <div className="sleeping-section__heading">
      <div>
        <span className="eyebrow">פרטי השינה בתוך מקום האירוח</span>
        <h2 id="sleeping-title">איפה תשנו?</h2>
        <p>{bedroomCount === 0 ? "סידור השינה המאומת שנמסר על ידי המקום, ללא השלמת מספר חדרים שלא נמסר." : bedroomCount === 1 ? "חדר שינה אחד עם הפרטים שנמסרו על ידי המקום." : everyCardIsOneBedroom ? `${bedroomCount} חדרי שינה. כל מלבן מציג חדר שינה נפרד ואת הפרטים שנמסרו עליו.` : `${bedroomCount} חדרי שינה. כל מלבן מציג את חלוקת השינה שנמסרה על יחידת האירוח.`}</p>
      </div>
      <SliderRailControls railId={trackId} railRef={track} label="דפדוף בין חדרי השינה" className="sleeping-section__controls" />
    </div>

    <div id={trackId} className="sleeping-track" ref={track} data-horizontal-rail tabIndex={0} aria-label={`חדרי השינה של ${placeName}`}>
      {rooms.map((room) => <article className="sleeping-card" key={room.key}>
        {room.galleryImage ? <img src={room.galleryImage} alt={`${room.name} ב${placeName}`} title={`${room.name} ב${placeName}`} loading="lazy" /> : null}
        <div className="sleeping-card__body">
          {room.unitName ? <span>{room.unitName}{room.totalUnits && room.totalUnits > 1 ? ` · ${room.totalUnits} יחידות זהות` : ""}</span> : null}
          <h3>{room.name}</h3>
          {room.availableUnits !== undefined && room.totalUnits && room.totalUnits > 1 ? <strong className="sleeping-card__availability">{room.availableUnits} מתוך {room.totalUnits} יחידות זהות פנויות בתאריכים שנבחרו</strong> : null}
          <div className="sleeping-card__amenities" aria-label={`פרטי ${room.name}`}>
            {room.details.map((detail) => <small key={detail}><FeatureIcon label={detail} className="sleeping-amenity-icon" />{detail}</small>)}
          </div>
        </div>
      </article>)}
    </div>
  </section>;
}
