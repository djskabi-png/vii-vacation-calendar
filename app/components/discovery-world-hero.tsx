import { WorldTopicImage } from "./world-topic-image";
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
        <h1>{presentation.title}</h1>
        <p>{presentation.description}</p>
        <div className="discovery-world-hero__proof" aria-label="מידע מרכזי">
          {typeof count === "number" ? <span><b>{count}</b> {countLabel}</span> : null}
          {presentation.proof.map((item) => <span key={item}>{item}</span>)}
        </div>
        {!children ? <Link className="button primary discovery-world-hero__action" href={`#${targetId}`}>מתחילים לבחור</Link> : null}
      </div>
      <div className="discovery-world-hero__visual">
        <WorldTopicImage image={presentation.heroImages[0]} />
      </div>
      {children ? <div className="discovery-world-hero__search">{children}</div> : null}
    </div>
  </section>;
}
