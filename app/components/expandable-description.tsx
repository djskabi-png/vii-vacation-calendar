"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSiteLanguage } from "../i18n/locale-provider";

export function ExpandableDescription({ text }: { text: string }) {
  const { language } = useSiteLanguage();
  const id = useId();
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const element = paragraph.current;
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);
  const copy = { he: ["קרא עוד", "סגירה"], en: ["Read more", "Show less"], ru: ["Читать далее", "Свернуть"], fr: ["Lire la suite", "Réduire"] }[language];
  return <div className="expandable-description">
    <p ref={paragraph} id={id} className={expanded ? "" : "expandable-description__collapsed"}>{text}</p>
    {(overflows || expanded) && <button className="expandable-description__toggle" type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{copy[expanded ? 1 : 0]}</button>}
  </div>;
}
