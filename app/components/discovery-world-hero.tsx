import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BreadcrumbTrail } from "./breadcrumb-trail";
import type { BreadcrumbTrailItem } from "./breadcrumb-trail";
import type { ManagedWorldLandingType, WorldLandingPresentation } from "../lib/world-landing-presentation";

export function DiscoveryWorldHero({ type, presentation, breadcrumbs, count, countLabel, targetId, className = "", showBreadcrumbs = true, children }: {
  type: ManagedWorldLandingType;
  presentation: WorldLandingPresentation;
  breadcrumbs: BreadcrumbTrailItem[];
  count?: number;
  countLabel?: string;
  targetId: string;
  className?: string;
  showBreadcrumbs?: boolean;
  children?: ReactNode;
}) {
  return <section className={`discovery-world-hero ${className}`.trim()} data-world={type}>
    <div className="shell discovery-world-hero__layout">
      <div className="discovery-world-hero__content">
        {showBreadcrumbs ? <BreadcrumbTrail className="discovery-world-hero__breadcrumbs" items={breadcrumbs} /> : null}
        <span className="discovery-world-hero__eyebrow">{presentation.eyebrow}</span>
        <h1>{presentation.title}</h1>
        <p>{presentation.description}</p>
        <div className="discovery-world-hero__proof" aria-label="מידע מרכזי">
          {typeof count === "number" ? <span><b>{count}</b> {countLabel}</span> : null}
          {presentation.proof.map((item) => <span key={item}>{item}</span>)}
        </div>
        {!children ? <Link className="button primary discovery-world-hero__action" href={`#${targetId}`}>מתחילים לבחור</Link> : null}
      </div>
      <div className="discovery-world-hero__visual" aria-label="הצצה לעולם">
        {presentation.heroImages.map((image, index) => <figure key={image.src} className={`discovery-world-hero__image discovery-world-hero__image--${index + 1}`}>
          {image.src.startsWith("/")
            ? <img src={image.src} alt={image.alt} title={image.alt} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" />
            : <Image src={image.src} alt={image.alt} title={image.alt} fill priority={index === 0} sizes="(max-width: 720px) 70vw, 34vw" />}
        </figure>)}
      </div>
      {children ? <div className="discovery-world-hero__search">{children}</div> : null}
    </div>
  </section>;
}
