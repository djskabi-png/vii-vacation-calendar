"use client";

import { useId, useState, type ReactNode } from "react";
import { useSiteLanguage } from "../i18n/locale-provider";

export function CollapsibleFeatureList({ children, className, initialCount = 8 }: { children: ReactNode[]; className: string; initialCount?: number }) {
  const { translate } = useSiteLanguage();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const limit = Math.max(1, Math.floor(initialCount));
  const canExpand = children.length > limit;
  return <>
    <div id={id} className={className}>{expanded ? children : children.slice(0, limit)}</div>
    {canExpand ? <button type="button" className="button subtle" aria-controls={id} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{translate(expanded ? "הצגת פחות" : "הצגת הכל")}</button> : null}
  </>;
}
