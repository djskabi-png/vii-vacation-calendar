"use client";

import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { PinIcon } from "../site-header";
import { EventCardContactActions } from "./event-card-contact-actions";
import { FavoriteButton } from "./favorite-button";
import { PreviewCardGallery } from "./preview-card-gallery";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { CatalogStartingPrice } from "./catalog-starting-price";

const photoCountCopy: Record<SiteLanguage, string> = {
  he: "תמונות",
  en: "photos",
  ru: "фото",
  fr: "photos",
};

export function EventResultCard({ place, href, supplierStatus, startingPrice, mapActive = false, onActiveChange }: {
  place: EventPlace;
  href: string;
  supplierStatus: string | null;
  startingPrice?: number | null;
  mapActive?: boolean;
  onActiveChange?: (active: boolean) => void;
}) {
  const { language } = useSiteLanguage();

  return <article
    className={`event-result-card${mapActive ? " is-map-active" : ""}`}
    data-map-place-id={place.slug}
    onPointerEnter={() => onActiveChange?.(true)}
    onPointerLeave={() => onActiveChange?.(false)}
    onFocusCapture={() => onActiveChange?.(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onActiveChange?.(false); }}
  >
    <PreviewCardGallery className="event-card-gallery" href={href} name={place.name} images={[place.image, ...place.images]} countLabel={(count) => `${count} ${photoCountCopy[language]}`}>
      <FavoriteButton id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={href} meta={`${place.type} · עד ${place.guests} אורחים ביחידה הגדולה`} />
    </PreviewCardGallery>
    <div className="event-result-card__body">
      <small className="event-result-card__type">{place.type}</small>
      <h3 className="event-result-card__title"><Link className="event-result-card__stretched-link" href={href} title={place.name}>{place.name}</Link></h3>
      <p className="event-result-card__location"><PinIcon /><span>{place.location}, {place.area}</span></p>
      <div className="event-capacity">עד {place.guests} אורחים ביחידה הגדולה</div>
      <div className="event-result-card__offer">{supplierStatus ? <p className="event-live-status" role="status">{supplierStatus}</p> : startingPrice ? <CatalogStartingPrice amount={startingPrice} /> : null}</div>
      <div className="stay-card__actions event-card__actions"><EventCardContactActions placeId={place.slug} placeName={place.name} phone={place.contact?.phone} whatsapp={place.contact?.whatsapp} serviceName={place.type} /></div>
    </div>
  </article>;
}
