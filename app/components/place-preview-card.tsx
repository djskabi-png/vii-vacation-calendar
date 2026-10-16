import Link from "next/link";
import type { ReactNode } from "react";
import { PreviewCardGallery } from "./preview-card-gallery";

// Compact/editorial place previews share the same gallery as result cards.
// The body link and image controls are siblings, never nested interactive links.
export function PlacePreviewCard({ name, image, images = [], href, className, children }: {
  name: string;
  image: string;
  images?: string[];
  href: string;
  className: string;
  children: ReactNode;
}) {
  return <article className={className}>
    <PreviewCardGallery key={href} className="place-preview-card__media" name={name} images={[image, ...images]} href={href} />
    <Link className="place-preview-card__body" href={href}>{children}</Link>
  </article>;
}
