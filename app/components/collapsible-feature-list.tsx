"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useSiteLanguage } from "../i18n/locale-provider";

export function CollapsibleFeatureList({ children, className, initialCount = 8, mobileInitialCount, expandLabel = "הצגת הכל", collapseLabel = "סגירה" }: { children: ReactNode[]; className: string; initialCount?: number; mobileInitialCount?: number; expandLabel?: string; collapseLabel?: string }) {
  const { translate } = useSiteLanguage();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (!mobileInitialCount) return;
    const media = window.matchMedia("(max-width: 760px)"), update = () => setMobile(media.matches);
    update(); media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [mobileInitialCount]);
  const limit = Math.max(1, Math.floor(mobile && mobileInitialCount ? mobileInitialCount : initialCount));
  const canExpand = children.length > limit;
  return <>
    <div id={id} className={className}>{expanded ? children : children.slice(0, limit)}</div>
    {canExpand ? <button type="button" className="button subtle" aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{translate(expanded ? collapseLabel : expandLabel)}</button> : null}
  </>;
}
