"use client";

/* eslint-disable @next/next/no-img-element */

import { useId, useRef } from "react";
import type { SleepingArrangement } from "../data/site-data";
import { FeatureIcon } from "./feature-icon";
import { SliderRailControls } from "./slider-rail-controls";

type Props = {
  placeName: string;
  arrangements: SleepingArrangement[];
};

function bedDescription(arrangement: SleepingArrangement) {
  return arrangement.beds
    .map((bed) => bed.count === 1 ? `1 ${bed.type}` : `${bed.count} ${bed.type === "מיטת יחיד" ? "מיטות יחיד" : bed.type}`)
    .join(" · ");
}

export function SleepingArrangements({ placeName, arrangements }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const trackId = useId();
  const totalBeds = arrangements.reduce((total, arrangement) => total + arrangement.beds.reduce((sum, bed) => sum + bed.count, 0), 0);

  return (
    <section id="sleeping" className="sleeping-section" aria-labelledby="sleeping-title">
      <div className="sleeping-section__heading">
        <div>
          <span className="eyebrow">חדרי השינה, בנפרד מיחידות האירוח</span>
          <h2 id="sleeping-title">איפה ישנים?</h2>
          <p>{arrangements.length} חדרי שינה ובהם {totalBeds} מיטות. כל כרטיס מייצג חדר שינה ולא יחידת אירוח.</p>
        </div>
        <SliderRailControls railId={trackId} railRef={track} label="דפדוף בין חדרי השינה" className="sleeping-section__controls" />
      </div>

      <div id={trackId} className="sleeping-track" ref={track} data-horizontal-rail tabIndex={0} aria-label={`חדרי השינה של ${placeName}`}>
        {arrangements.map((arrangement) => (
          <article className="sleeping-card" key={arrangement.name}>
            {arrangement.galleryImage ? <img src={arrangement.galleryImage} alt={`${arrangement.name} ב${placeName}`} title={`${arrangement.name} ב${placeName}`} loading="lazy" /> : null}
            <div className="sleeping-card__body">
              <span>{arrangement.floor || "הקומה לא צוינה בפרטי המקום"}</span>
              <h3>{arrangement.name}</h3>
              <strong>{bedDescription(arrangement)}</strong>
              <div className="sleeping-card__amenities" aria-label={`אבזור ${arrangement.name}`}>
                {arrangement.amenities.map((amenity) => <small key={amenity}><FeatureIcon label={amenity} className="sleeping-amenity-icon" />{amenity}</small>)}
              </div>
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}
