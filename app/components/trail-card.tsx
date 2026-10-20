"use client";

import Link from "next/link";
import Image from "next/image";
import type { Trail } from "../data/trail-data";
import { FavoriteButton } from "./favorite-button";
import { useSiteLanguage } from "../i18n/locale-provider";
import { localizedBusinessText } from "../i18n/localized-business-content";

export function TrailVisual({ trail, compact = false, language = "he", localizedName }: { trail: Trail; compact?: boolean; language?: "he" | "en" | "ru" | "fr"; localizedName?: string }) {
  const copy = language === "en" ? { name: "Nature trail", image: "Nature along", join: " and " }
    : language === "ru" ? { name: "Природный маршрут", image: "Природа на маршруте", join: " и " }
      : language === "fr" ? { name: "Sentier nature", image: "Nature le long de", join: " et " }
        : { name: "מסלול טבע", image: "נוף לאורך מסלול", join: " ו" };
  const displayName = localizedName || (language === "he" ? trail.name : copy.name);
  const highlights = language === "he" ? trail.highlights.slice(0, 2) : [];
  const imageTitle = `${copy.image} ${displayName}`;
  const imageAlt = highlights.length ? `${imageTitle}: ${highlights.join(copy.join)}.` : imageTitle;

  return <div className={`trail-visual trail-visual--${trail.tone}${compact ? " trail-visual--compact" : ""}`}>
    <Image src={`/images/trails/${trail.slug}.jpg`} width={1200} height={800} alt={imageAlt} title={imageTitle} />
  </div>;
}

export function TrailCard({ trail, compact = false, mapActive = false, onActiveChange }: { trail: Trail; compact?: boolean; mapActive?: boolean; onActiveChange?: (active: boolean) => void }) {
  const { language, translate } = useSiteLanguage();
  const localizedName = localizedBusinessText(trail.name, language, translate, language === "he" ? "מסלול טבע" : language === "en" ? "Nature trail" : language === "ru" ? "Природный маршрут" : "Sentier nature");
  const routeLabel = language === "he" ? "למסלול" : language === "en" ? "Open trail" : language === "ru" ? "Открыть маршрут" : "Ouvrir l’itinéraire";
  return <article className={`trail-card${compact ? " trail-card--compact" : ""}${mapActive ? " is-map-active" : ""}`} data-map-place-id={trail.slug} onMouseEnter={() => onActiveChange?.(true)} onMouseLeave={() => onActiveChange?.(false)} onFocusCapture={() => onActiveChange?.(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onActiveChange?.(false); }}>
    <Link className="trail-card__visual" href={`/trails/${trail.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`${routeLabel} ${localizedName}`}><TrailVisual trail={trail} compact={compact} language={language} localizedName={localizedName} /></Link>
    <FavoriteButton id={trail.slug} world="trails" name={localizedName} location={`${trail.mainArea}, ${trail.region}`} href={`/trails/${trail.slug}`} meta={`${trail.duration} · ${trail.difficulty}`} />
    <div className="trail-card__body">
      <div className="trail-card__labels"><span>{trail.difficulty}</span><span>{trail.routeType}</span></div>
      <h3><Link href={`/trails/${trail.slug}`} target="_blank" rel="noopener noreferrer">{localizedName}<span className="sr-only"></span></Link></h3>
      <p>{trail.summary}</p>
      <dl><div><dt>משך</dt><dd>{trail.duration}</dd></div><div><dt>מרחק</dt><dd>{trail.distance}</dd></div></dl>
      <div className="trail-card__footer"><span>{trail.nature.join(" · ")}</span><Link href={`/trails/${trail.slug}`} target="_blank" rel="noopener noreferrer">למדריך המלא<span className="sr-only"></span></Link></div>
    </div>
  </article>;
}
