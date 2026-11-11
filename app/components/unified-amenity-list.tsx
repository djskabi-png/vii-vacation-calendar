"use client";

import { useId, useMemo, useState } from "react";
import { FeatureIcon } from "./feature-icon";
import { useSiteLanguage } from "../i18n/locale-provider";

type UnifiedAmenityListProps = {
  items: readonly string[];
  className?: string;
};

const COLLAPSED_AMENITY_COUNT = 5;

export function UnifiedAmenityList({ items, className = "" }: UnifiedAmenityListProps) {
  const { translate } = useSiteLanguage();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const uniqueItems = useMemo(() => [...new Set(items.map((item) => item.trim()).filter(Boolean))], [items]);
  const visibleItems = expanded ? uniqueItems : uniqueItems.slice(0, COLLAPSED_AMENITY_COUNT);
  const canExpand = uniqueItems.length > COLLAPSED_AMENITY_COUNT;

  return <div className={`unified-amenities${className ? ` ${className}` : ""}`}>
    <ul id={listId} className="unified-amenities__list">
      {visibleItems.map((item) => <li key={item}>
        <FeatureIcon label={item} className="unified-amenities__icon" />
        <span>{translate(item)}</span>
      </li>)}
    </ul>
    {canExpand ? <button
      type="button"
      className="unified-amenities__toggle"
      aria-controls={listId}
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
    >{expanded ? translate("סגירה") : <>{translate("הצגת כל")} {uniqueItems.length} {translate("המאפיינים")}</>}</button> : null}
  </div>;
}

export { COLLAPSED_AMENITY_COUNT };
