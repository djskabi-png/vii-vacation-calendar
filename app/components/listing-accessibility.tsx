"use client";

import Link from "next/link";
import { useState } from "react";
import { accessibilityLabels, getPlaceAccessibility } from "../data/accessibility-data";

export function ListingAccessibility({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const information = getPlaceAccessibility(slug);
  const [isOpen, setIsOpen] = useState(false);
  const detailsId = `accessibility-details-${slug}`;
  if (compact) return <span className={`place-accessibility-badge place-accessibility-badge--${information.status}`}>{accessibilityLabels[information.status]}</span>;

  return <section className={`place-accessibility place-accessibility--${information.status}`} id="accessibility">
      <button className="place-accessibility__summary" type="button" aria-expanded={isOpen} aria-controls={detailsId} onClick={() => setIsOpen((open) => !open)}>
        <span className="place-accessibility__icon" aria-hidden="true">♿</span>
        <span className="place-accessibility__copy">
          <span className="eyebrow">נגישות במקום</span>
          <strong role="heading" aria-level={2}>{accessibilityLabels[information.status]}</strong>
          <span>{information.summary}</span>
        </span>
      </button>
      <div className="place-accessibility__content" id={detailsId} hidden={!isOpen}>
        {information.arrangements.length > 0 && <ul>{information.arrangements.map((arrangement) => <li key={arrangement}>{arrangement}</li>)}</ul>}
        <small>{information.sourceLabel}{information.verifiedAt ? `, עודכן ${information.verifiedAt}` : ""}</small>
        <p className="place-accessibility__warning">לפני הזמנה מומלץ לאמת מול המקום את ההתאמות החשובות לכם.</p>
        <Link href="/accessibility">נגישות האתר והסדרי השירות</Link>
      </div>
  </section>;
}
