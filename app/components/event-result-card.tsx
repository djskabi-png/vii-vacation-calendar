"use client";

import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { PinIcon } from "../site-header";
import { EventCardContactActions } from "./event-card-contact-actions";
import { FavoriteButton } from "./favorite-button";
import { PreviewCardGallery } from "./preview-card-gallery";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

const photoCountCopy: Record<SiteLanguage, string> = {
  he: "תמונות",
  en: "photos",
  ru: "фото",
  fr: "photos",
};

export function EventResultCard({ place, href, supplierStatus, mapActive = false, onActiveChange }: {
  place: EventPlace;
  href: string;
  supplierStatus: string | null;
  mapActive?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const { language } = useSiteLanguage();

  return <article
    className={mapActive ? "is-map-active" : undefined}
    data-map-place-id={place.slug}
    onPointerEnter={() => onActiveChange?.(true)}
    onPointerLeave={() => onActiveChange?.(false)}
    onFocusCapture={() => onActiveChange?.(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onActiveChange?.(false); }}
  >
    <PreviewCardGallery className="event-card-gallery" href={href} name={place.name} images={[place.image, ...place.images]} countLabel={(count) => `${count} ${photoCountCopy[language]}`}>
      <FavoriteButton id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={href} meta={`${place.type} · עד ${place.guests} אורחים ביחידה הגדולה`} />
    </PreviewCardGallery>
    <div><small>{place.type}</small><h2>{place.name}</h2><p><PinIcon />{place.location}, {place.area}</p><p>{place.description}</p><div className="feature-chips">{place.features.slice(0, 3).map((feature) => <span key={feature}>{feature}</span>)}</div><div className="event-capacity">עד {place.guests} אורחים ביחידה הגדולה</div>{supplierStatus ? <p className="event-live-status" role="status">{supplierStatus}</p> : null}<div className="stay-card__actions event-card__actions"><Link className="stay-card__details-link" href={href} target="_blank" rel="noopener noreferrer">לפרטים על המקום<span className="sr-only"></span></Link><EventCardContactActions placeId={place.slug} placeName={place.name} phone={place.contact?.phone} whatsapp={place.contact?.whatsapp} serviceName={place.type} /></div></div>
  </article>;
}
