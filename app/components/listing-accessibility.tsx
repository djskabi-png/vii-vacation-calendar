"use client";

import { useState } from "react";
import { getPlaceAccessibility, VERIFIED_ACCESSIBILITY_FEATURE } from "../data/accessibility-data";
import { useSiteLanguage } from "../i18n/locale-provider";

export function ListingAccessibility({ slug, features, compact = false }: { slug: string; features?: readonly string[]; compact?: boolean }) {
  const information = getPlaceAccessibility(features);
  const [isOpen, setIsOpen] = useState(false);
  const { translate } = useSiteLanguage();
  const detailsId = `accessibility-details-${slug}`;
  if (!information) return null;
  if (compact) return <span className="place-accessibility-badge place-accessibility-badge--accessible" aria-label={translate(VERIFIED_ACCESSIBILITY_FEATURE)}>
    <span>{translate(VERIFIED_ACCESSIBILITY_FEATURE)}</span>
    <small>{translate("למידע נוסף")}</small>
  </span>;

  return <section className={`place-accessibility place-accessibility--${information.status}`} id="accessibility">
      <button className="place-accessibility__summary" type="button" aria-expanded={isOpen} aria-controls={detailsId} onClick={() => setIsOpen((open) => !open)}>
        <span className="place-accessibility__icon" aria-hidden="true">♿</span>
        <span className="place-accessibility__copy">
          <span className="eyebrow">נגישות במקום</span>
          <strong role="heading" aria-level={2}>{VERIFIED_ACCESSIBILITY_FEATURE}</strong>
          <span>{information.summary}</span>
        </span>
      </button>
      <div className="place-accessibility__content" id={detailsId} hidden={!isOpen}>
        {information.arrangements.length > 0 && <ul>{information.arrangements.map((arrangement) => <li key={arrangement}>{arrangement}</li>)}</ul>}
        <small>{information.sourceLabel}</small>
        <p className="place-accessibility__warning">לפני הזמנה מומלץ לאמת מול המקום את ההתאמות החשובות לכם.</p>
      </div>
  </section>;
}
