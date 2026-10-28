"use client";

import { useState } from "react";
import { useSiteLanguage } from "../i18n/locale-provider";

type SleepingGroup = { title: string; items: string[] };

export function RoomSleepingPreview({ roomName, groups }: { roomName: string; groups: SleepingGroup[] }) {
  const [expanded, setExpanded] = useState(false);
  const { translate } = useSiteLanguage();
  const visibleGroups = expanded ? groups : groups.slice(0, 2);
  const remaining = Math.max(0, groups.length - visibleGroups.length);

  return <section className="room-card__sleeping" aria-label={`איפה תשנו ב${roomName}`}>
    <div className="room-card__sleeping-heading">
      <strong>{translate("איפה תשנו ביחידה?")}</strong>
      <span>{groups.length === 1 ? translate("חדר שינה אחד") : `${groups.length} ${translate("חדרי שינה")}`}</span>
    </div>
    <div className="room-card__sleeping-list">
      {visibleGroups.map((group) => <div key={group.title}><b>{group.title}</b><span>{group.items.join(" · ")}</span></div>)}
    </div>
    {groups.length > 2 ? <button
      className="room-card__sleeping-toggle"
      type="button"
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
    >{expanded ? translate("הצגת פחות") : `${remaining} ${translate("חדרי שינה נוספים")}`}</button> : null}
  </section>;
}
