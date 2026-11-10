import { WorldTopicImage } from "./world-topic-image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BreadcrumbTrail } from "./breadcrumb-trail";
import type { BreadcrumbTrailItem } from "./breadcrumb-trail";
import type { ManagedWorldLandingType, WorldLandingPresentation } from "../lib/world-landing-presentation";
import { serverPublicCopy } from "../i18n/server-public-copy";

export async function DiscoveryWorldHero({ type, presentation, breadcrumbs, count, countLabel, targetId, className = "", showBreadcrumbs = true, children }: {
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
  const { translate } = await serverPublicCopy();
  return <section className={`discovery-world-hero ${className}`.trim()} data-world={type}>
    <div className="shell discovery-world-hero__layout">
      <div className="discovery-world-hero__content">
        {showBreadcrumbs ? <BreadcrumbTrail className="discovery-world-hero__breadcrumbs" items={breadcrumbs} /> : null}
        <span className="sr-only">{translate(presentation.eyebrow)}</span>
        <h1>{translate(presentation.title)}</h1>
        <p>{translate(presentation.description)}</p>
        <div className="discovery-world-hero__proof" aria-label="מידע מרכזי">
          {typeof count === "number" ? <span><b>{count}</b> {countLabel ? translate(countLabel) : null}</span> : null}
          {presentation.proof.map((item) => <span key={item}>{translate(item)}</span>)}
        </div>
        {!children ? <Link className="button primary discovery-world-hero__action" href={`#${targetId}`}>{translate("מתחילים לבחור")}</Link> : null}
      </div>
      <div className="discovery-world-hero__visual">
        <WorldTopicImage image={presentation.heroImages[0]} />
      </div>
      {children ? <div className="discovery-world-hero__search">{children}</div> : null}
    </div>
  </section>;
}
