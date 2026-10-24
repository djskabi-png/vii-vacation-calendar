"use client";

import Link from "next/link";
import type { EventPlace } from "../data/site-data";
import { PinIcon } from "../site-header";
import { EventCardContactActions } from "./event-card-contact-actions";
import { FavoriteButton } from "./favorite-button";
import { PreviewCardGallery } from "./preview-card-gallery";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { CatalogStartingPrice } from "./catalog-starting-price";
import { latinBusinessAlias, localizedBusinessText } from "../i18n/localized-business-content";

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
  const { language, translate } = useSiteLanguage();
  const copy = {
    he: { venue: "מתחם אירועים", location: "ישראל", guests: "אורחים ביחידה הגדולה" },
    en: { venue: "Event venue", location: "Israel", guests: "guests in the largest unit" },
    ru: { venue: "Площадка для мероприятий", location: "Израиль", guests: "гостей в самой большой зоне" },
    fr: { venue: "Lieu événementiel", location: "Israël", guests: "personnes dans le plus grand espace" },
  }[language];
  const safe = (value: string, fallback: string) => localizedBusinessText(value, language, translate, fallback);
  const name = safe(place.name, latinBusinessAlias(place.name) || copy.venue);
  const type = safe(place.type, copy.venue);
  const location = safe(place.location, safe(place.area, copy.location));
  const area = safe(place.area, copy.location);

  return <article
    className={`event-result-card${mapActive ? " is-map-active" : ""}`}
    data-map-place-id={place.slug}
    onPointerEnter={() => onActiveChange?.(true)}
    onPointerLeave={() => onActiveChange?.(false)}
    onFocusCapture={() => onActiveChange?.(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onActiveChange?.(false); }}
  >
    <PreviewCardGallery className="event-card-gallery" href={href} name={name} images={[place.image, ...place.images]} countLabel={(count) => `${count} ${photoCountCopy[language]}`}>
      <FavoriteButton id={place.slug} world="events" name={name} location={`${location}, ${area}`} image={place.image} href={href} meta={`${type} · ${place.guests} ${copy.guests}`} />
    </PreviewCardGallery>
    <div className="event-result-card__body">
      <small className="event-result-card__type">{type}</small>
      <h3 className="event-result-card__title"><Link className="event-result-card__stretched-link" href={href} title={name}>{name}</Link></h3>
      <p className="event-result-card__location"><PinIcon /><span>{location}, {area}</span></p>
      <div className="event-capacity">{language === "he" ? "עד" : language === "en" ? "Up to" : language === "ru" ? "До" : "Jusqu’à"} {place.guests} {copy.guests}</div>
      <div className="event-result-card__offer">{supplierStatus ? <p className="event-live-status" role="status">{supplierStatus}</p> : startingPrice ? <CatalogStartingPrice amount={startingPrice} /> : null}</div>
      <div className="stay-card__actions event-card__actions"><EventCardContactActions placeId={place.slug} placeName={name} phone={place.contact?.phone} whatsapp={place.contact?.whatsapp} serviceName={type} /></div>
    </div>
  </article>;
}
