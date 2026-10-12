import Link from "next/link";
import Image from "next/image";
import type { Trail } from "../data/trail-data";
import { FavoriteButton } from "./favorite-button";

export function TrailVisual({ trail, compact = false }: { trail: Trail; compact?: boolean }) {
  const imageTitle = `תמונת המחשה למסלול ${trail.name}`;
  const imageAlt = `${imageTitle}: ${trail.highlights.slice(0, 2).join(" ו")}.`;

  return <div className={`trail-visual trail-visual--${trail.tone}${compact ? " trail-visual--compact" : ""}`}>
    <Image src={`/images/trails/${trail.slug}.jpg`} width={1200} height={800} alt={imageAlt} title={imageTitle} />
    <span className="image-context-label">תמונת המחשה</span>
  </div>;
}

export function TrailCard({ trail, compact = false }: { trail: Trail; compact?: boolean }) {
  return <article className={`trail-card${compact ? " trail-card--compact" : ""}`}>
    <Link className="trail-card__visual" href={`/trails/${trail.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`למסלול ${trail.name}`}><TrailVisual trail={trail} compact={compact} /></Link>
    <FavoriteButton id={trail.slug} world="trails" name={trail.name} location={`${trail.mainArea}, ${trail.region}`} href={`/trails/${trail.slug}`} meta={`${trail.duration} · ${trail.difficulty}`} />
    <div className="trail-card__body">
      <div className="trail-card__labels"><span>{trail.difficulty}</span><span>{trail.routeType}</span></div>
      <h3><Link href={`/trails/${trail.slug}`} target="_blank" rel="noopener noreferrer">{trail.name}<span className="sr-only"></span></Link></h3>
      <p>{trail.summary}</p>
      <dl><div><dt>משך</dt><dd>{trail.duration}</dd></div><div><dt>מרחק</dt><dd>{trail.distance}</dd></div></dl>
      <div className="trail-card__footer"><span>{trail.nature.join(" · ")}</span><Link href={`/trails/${trail.slug}`} target="_blank" rel="noopener noreferrer">למדריך המלא<span className="sr-only"></span></Link></div>
    </div>
  </article>;
}
