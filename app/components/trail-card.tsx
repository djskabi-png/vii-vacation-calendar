import Link from "next/link";
import type { Trail } from "../data/trail-data";
import { FavoriteButton } from "./favorite-button";

export function TrailVisual({ trail, compact = false }: { trail: Trail; compact?: boolean }) {
  return <div className={`trail-visual trail-visual--${trail.tone}${compact ? " trail-visual--compact" : ""}`} aria-hidden="true">
    <span className="trail-visual__sun" />
    <span className="trail-visual__line trail-visual__line--one" />
    <span className="trail-visual__line trail-visual__line--two" />
    <span className="trail-visual__line trail-visual__line--three" />
    <span className="trail-visual__pin" />
    <strong>{trail.mainArea}</strong>
    <small>{trail.region} · {trail.nature.slice(0, 2).join(" · ")}</small>
  </div>;
}

export function TrailCard({ trail, compact = false }: { trail: Trail; compact?: boolean }) {
  return <article className={`trail-card${compact ? " trail-card--compact" : ""}`}>
    <Link className="trail-card__visual" href={`/trails/${trail.slug}`} aria-label={`למסלול ${trail.name}`}><TrailVisual trail={trail} compact={compact} /></Link>
    <FavoriteButton id={trail.slug} world="trails" name={trail.name} location={`${trail.mainArea}, ${trail.region}`} href={`/trails/${trail.slug}`} meta={`${trail.duration} · ${trail.difficulty}`} />
    <div className="trail-card__body">
      <div className="trail-card__labels"><span>{trail.difficulty}</span><span>{trail.routeType}</span></div>
      <h3><Link href={`/trails/${trail.slug}`}>{trail.name}</Link></h3>
      <p>{trail.summary}</p>
      <dl><div><dt>משך</dt><dd>{trail.duration}</dd></div><div><dt>מרחק</dt><dd>{trail.distance}</dd></div></dl>
      <div className="trail-card__footer"><span>{trail.nature.join(" · ")}</span><Link href={`/trails/${trail.slug}`}>למדריך המלא</Link></div>
    </div>
  </article>;
}
