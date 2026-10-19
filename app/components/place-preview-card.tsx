import Link from "next/link";
import type { ReactNode } from "react";
import { PreviewCardGallery } from "./preview-card-gallery";
import { CardContactActions, type CardContactActionsProps } from "./card-contact-actions";

// Compact/editorial place previews share the same gallery as result cards.
// The body link and image controls are siblings, never nested interactive links.
export function PlacePreviewCard({ name, image, images = [], href, className, children, newTab = false, contact }: {
  name: string;
  image: string;
  images?: string[];
  href: string;
  className: string;
  children: ReactNode;
  newTab?: boolean;
  contact?: Omit<CardContactActionsProps, "world" | "placeName">;
}) {
  return <article className={`${className}${contact ? " place-preview-card--contact" : ""}`}>
    <PreviewCardGallery key={href} className="place-preview-card__media" name={name} images={[image, ...images]} href={href} />
    <Link className="place-preview-card__body" href={href} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined}>{children}</Link>
    {contact ? <div className="place-preview-card__contact"><CardContactActions key={contact.placeId} {...contact} world="events" placeName={name} /></div> : null}
  </article>;
}
