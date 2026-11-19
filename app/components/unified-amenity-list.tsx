"use client";

import { useId, useMemo, useState } from "react";
import { FeatureIcon } from "./feature-icon";
import { useSiteLanguage } from "../i18n/locale-provider";

type UnifiedAmenityListProps = {
  items?: readonly string[];
  groups?: readonly { title: string; items: readonly string[] }[];
  className?: string;
};

const COLLAPSED_AMENITY_COUNT = 5;

function normalizedKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("he-IL");
}

export function UnifiedAmenityList({ items = [], groups = [], className = "" }: UnifiedAmenityListProps) {
  const { translate } = useSiteLanguage();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const normalizedGroups = useMemo(() => {
    const seen = new Set<string>();
    const accepted = groups.flatMap((group) => {
      const title = group.title.trim();
      const acceptedItems = group.items.flatMap((item) => {
        const value = item.trim().replace(/\s+/g, " ");
        const key = normalizedKey(value);
        if (!key || seen.has(key)) return [];
        seen.add(key);
        return [value];
      });
      return title && acceptedItems.length ? [{ title, items: acceptedItems }] : [];
    });
    const ungrouped = items.flatMap((item) => {
      const value = item.trim().replace(/\s+/g, " ");
      const key = normalizedKey(value);
      if (!key || seen.has(key)) return [];
      seen.add(key);
      return [value];
    });
    return ungrouped.length ? [...accepted, { title: "מאפיינים נוספים", items: ungrouped }] : accepted;
  }, [groups, items]);
  const uniqueItems = useMemo(() => normalizedGroups.flatMap((group) => group.items), [normalizedGroups]);
  const visibleItems = expanded ? uniqueItems : uniqueItems.slice(0, COLLAPSED_AMENITY_COUNT);
  const canExpand = uniqueItems.length > COLLAPSED_AMENITY_COUNT;
  const showGrouped = normalizedGroups.length > 0 && (expanded || !canExpand);

  return <div className={`unified-amenities${className ? ` ${className}` : ""}`}>
    <div id={listId}>
      {showGrouped ? <div className="unified-amenities__groups">
        {normalizedGroups.map((group) => <section className="unified-amenities__group" key={group.title}>
          <h3>{translate(group.title)}</h3>
          <ul className="unified-amenities__list">
            {group.items.map((item) => <li key={item}><FeatureIcon label={item} className="unified-amenities__icon" /><span>{translate(item)}</span></li>)}
          </ul>
        </section>)}
      </div> : <ul className="unified-amenities__list">
        {visibleItems.map((item) => <li key={item}>
          <FeatureIcon label={item} className="unified-amenities__icon" />
          <span>{translate(item)}</span>
        </li>)}
      </ul>}
    </div>
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
