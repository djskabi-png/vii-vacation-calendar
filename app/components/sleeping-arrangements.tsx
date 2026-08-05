"use client";

/* eslint-disable @next/next/no-img-element */

import { useRef } from "react";
import type { SleepingArrangement } from "../data/site-data";

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
  const totalBeds = arrangements.reduce((total, arrangement) => total + arrangement.beds.reduce((sum, bed) => sum + bed.count, 0), 0);

  function move(direction: "next" | "previous") {
    if (!track.current) return;
    const amount = track.current.clientWidth * 0.82;
    track.current.scrollBy({ left: direction === "next" ? -amount : amount, behavior: "smooth" });
  }

  return (
    <section id="sleeping" className="sleeping-section" aria-labelledby="sleeping-title">
      <div className="sleeping-section__heading">
        <div>
          <span className="eyebrow">פירוט מאומת מעמוד המקום</span>
          <h2 id="sleeping-title">איפה ישנים?</h2>
          <p>{arrangements.length} חדרי שינה, {totalBeds} מיטות לפי הפירוט הקיים באתר.</p>
        </div>
        <div className="sleeping-section__controls" aria-label="דפדוף בין חדרי השינה">
          <button type="button" onClick={() => move("previous")} aria-label="החדרים הקודמים">‹</button>
          <button type="button" onClick={() => move("next")} aria-label="החדרים הבאים">›</button>
        </div>
      </div>

      <div className="sleeping-track" ref={track} tabIndex={0} aria-label={`חדרי השינה של ${placeName}`}>
        {arrangements.map((arrangement) => (
          <article className="sleeping-card" key={arrangement.name}>
            <img src={arrangement.galleryImage} alt={`תמונה מתוך גלריית הפנים של ${placeName}`} loading="lazy" />
            <div className="sleeping-card__body">
              <span>{arrangement.floor || "הקומה לא צוינה בפרטי המקום"}</span>
              <h3>{arrangement.name}</h3>
              <strong>{bedDescription(arrangement)}</strong>
              <div className="sleeping-card__amenities" aria-label={`אבזור ${arrangement.name}`}>
                {arrangement.amenities.map((amenity) => <small key={amenity}>{amenity}</small>)}
              </div>
            </div>
          </article>
        ))}
      </div>

      <p className="sleeping-section__disclosure">התמונות מוצגות מתוך גלריית הפנים ואינן משויכות לחדר ממוספר מסוים, לכן הן משמשות כתמונות אווירה בלבד.</p>
    </section>
  );
}
