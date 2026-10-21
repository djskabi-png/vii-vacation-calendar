"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DiscoveryItem } from "../data/world-data";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { PinIcon } from "../site-header";
import { FavoriteButton } from "./favorite-button";
import { resolvePublicSliderMedia } from "../lib/public-media-policy";
import { latinBusinessAlias, localizedBusinessText } from "../i18n/localized-business-content";
import { PreviewCardGallery } from "./preview-card-gallery";
import { CardContactActions } from "./card-contact-actions";
import { HorizontalChipRail } from "./horizontal-chip-rail";

const placeNames: Record<Exclude<SiteLanguage, "he">, Record<string, string>> = {
  en: { "תל אביב": "Tel Aviv", "ירושלים": "Jerusalem", "נהריה": "Nahariya", "חיפה": "Haifa", "רגבה": "Regba", "כמון": "Kamon", "רמת גן": "Ramat Gan", "אילת": "Eilat", "הרצליה": "Herzliya", "אשדוד": "Ashdod", "אשקלון": "Ashkelon", "טבריה": "Tiberias", "נתניה": "Netanya", "פתח תקווה": "Petah Tikva", "ראשון לציון": "Rishon LeZion", "רחובות": "Rehovot", "באר שבע": "Beersheba", "ים המלח": "Dead Sea", "מרכז": "Central Israel", "צפון": "Northern Israel", "דרום ונגב": "Southern Israel and the Negev", "ירושלים והסביבה": "Jerusalem area", "אילת והערבה": "Eilat and the Arava", "גליל מערבי": "Western Galilee", "חיפה והקריות": "Haifa area" },
  ru: { "תל אביב": "Тель-Авив", "ירושלים": "Иерусалим", "נהריה": "Нагария", "חיפה": "Хайфа", "רגבה": "Регба", "כמון": "Камон", "רמת גן": "Рамат-Ган", "אילת": "Эйлат", "הרצליה": "Герцлия", "אשדוד": "Ашдод", "אשקלון": "Ашкелон", "טבריה": "Тверия", "נתניה": "Нетания", "פתח תקווה": "Петах-Тиква", "ראשון לציון": "Ришон-ле-Цион", "רחובות": "Реховот", "באר שבע": "Беэр-Шева", "ים המלח": "Мёртвое море", "מרכז": "Центр Израиля", "צפון": "Север Израиля", "דרום ונגב": "Юг Израиля и Негев", "ירושלים והסביבה": "Иерусалим и окрестности", "אילת והערבה": "Эйлат и Арава", "גליל מערבי": "Западная Галилея", "חיפה והקריות": "Хайфа и окрестности" },
  fr: { "תל אביב": "Tel-Aviv", "ירושלים": "Jérusalem", "נהריה": "Nahariya", "חיפה": "Haïfa", "רגבה": "Regba", "כמון": "Kamon", "רמת גן": "Ramat Gan", "אילת": "Eilat", "הרצליה": "Herzliya", "אשדוד": "Ashdod", "אשקלון": "Ashkelon", "טבריה": "Tibériade", "נתניה": "Netanya", "פתח תקווה": "Petah Tikva", "ראשון לציון": "Rishon LeZion", "רחובות": "Rehovot", "באר שבע": "Beer-Sheva", "ים המלח": "Mer Morte", "מרכז": "Centre d'Israël", "צפון": "Nord d'Israël", "דרום ונגב": "Sud d'Israël et Néguev", "ירושלים והסביבה": "Jérusalem et environs", "אילת והערבה": "Eilat et Arava", "גליל מערבי": "Galilée occidentale", "חיפה והקריות": "Haïfa et environs" },
};

const worldCopy: Record<Exclude<SiteLanguage, "he">, Record<DiscoveryItem["world"], { description: string; chips: string[] }>> = {
  en: {
    corporate: { description: "Corporate events and employee experiences with clear service details and booking options.", chips: ["Corporate events", "Employee experiences", "Booking options"] },
    spa: { description: "Spa venue with treatments, packages and facilities presented here for easy comparison and booking.", chips: ["Spa treatments", "Packages", "Booking options"] },
    hourly: { description: "Private short-stay accommodation with clear stay options and booking information.", chips: ["Private stay", "Flexible hours", "Booking options"] },
    providers: { description: "Professional service for holidays and events, with service details and a direct booking route.", chips: ["Professional service", "Events", "Direct booking"] },
    activities: { description: "An experience to add to your visit, with practical information and booking options in one place.", chips: ["Experience", "Nearby", "Visitor information"] },
  },
  ru: {
    corporate: { description: "Корпоративные мероприятия и программы для сотрудников с понятными условиями и вариантами бронирования.", chips: ["Корпоративные мероприятия", "Программы для сотрудников", "Бронирование"] },
    spa: { description: "Спа-центр с процедурами, пакетами и удобствами для простого сравнения и бронирования.", chips: ["Спа-процедуры", "Пакеты", "Варианты бронирования"] },
    hourly: { description: "Приватное размещение на несколько часов с понятными вариантами пребывания и бронирования.", chips: ["Приватность", "Гибкие часы", "Бронирование"] },
    providers: { description: "Профессиональная услуга для отдыха и мероприятий с подробностями и прямым способом заказа.", chips: ["Профессиональная услуга", "Мероприятия", "Прямой заказ"] },
    activities: { description: "Впечатление для вашей поездки с полезной информацией и вариантами заказа в одном месте.", chips: ["Впечатление", "Рядом", "Информация"] },
  },
  fr: {
    corporate: { description: "Événements d’entreprise et expériences pour les équipes, avec des informations claires et des options de réservation.", chips: ["Événements d’entreprise", "Expériences d’équipe", "Réservation"] },
    spa: { description: "Un spa avec soins, forfaits et équipements présentés ici pour comparer et réserver facilement.", chips: ["Soins spa", "Forfaits", "Options de réservation"] },
    hourly: { description: "Un hébergement privé de courte durée avec des formules claires et des options de réservation.", chips: ["Séjour privé", "Horaires flexibles", "Réservation"] },
    providers: { description: "Un service professionnel pour les séjours et événements, avec les détails et un parcours de réservation direct.", chips: ["Service professionnel", "Événements", "Réservation directe"] },
    activities: { description: "Une expérience à ajouter à votre séjour, avec les informations pratiques et les options de réservation au même endroit.", chips: ["Expérience", "À proximité", "Informations"] },
  },
};

const interfaceCopy = {
  en: { details: "View details", from: "From", israel: "Israel", demo: "Demo profile", system: "Curated suggestion", noPrice: "Price not supplied" },
  ru: { details: "Подробнее", from: "От", israel: "Израиль", demo: "Демо-профиль", system: "Рекомендация VII", noPrice: "Цена не указана" },
  fr: { details: "Voir les détails", from: "À partir de", israel: "Israël", demo: "Profil de démonstration", system: "Suggestion VII", noPrice: "Prix non fourni" },
} satisfies Record<Exclude<SiteLanguage, "he">, Record<string, string>>;

function localizedPrice(label: string | undefined, language: Exclude<SiteLanguage, "he">, details: string) {
  if (!label) return details;
  const amount = label.match(/[\d,.]+/)?.[0];
  return amount ? `${interfaceCopy[language].from} ₪${amount}` : details;
}

export function DiscoveryCard({ item, mapActive = false, onActiveChange }: { item: DiscoveryItem; mapActive?: boolean; onActiveChange?: (active: boolean) => void }) {
  const router = useRouter();
  const { language, translate } = useSiteLanguage();
  const localized = language === "he" ? null : worldCopy[language][item.world];
  const ui = language === "he" ? null : interfaceCopy[language];
  const location = language === "he" ? item.location : placeNames[language][item.location] || ui!.israel;
  const area = language === "he" ? item.area : placeNames[language][item.area] || ui!.israel;
  // Generated dictionaries load after hydration. Business identity must not
  // change between SSR and the browser, so use only a verified Latin alias or
  // a localized neutral fallback on these discovery cards.
  const localizedName = localizedBusinessText(item.name, language, translate, latinBusinessAlias(item.name) || `${localized?.chips[0] || ui?.details || item.name} · ${location}`, true);
  const description = (localized?.description || item.description).replace(/ש["״]ח/g, "₪");
  const features = localized?.chips || item.features.slice(0, 3);
  const details = ui?.details || "צפייה במקום";
  const price = item.world === "hourly" && !item.priceLabel
    ? translate("למחיר, פנו למקום")
    : language === "he" ? item.priceLabel || item.duration || details : localizedPrice(item.priceLabel || item.duration, language, details);

  if (!item.image && item.world !== "hourly") return null;

  const mediaTopic = `${item.world} ${item.name} ${item.area} ${item.features.join(" ")}`;
  const media = item.image
    ? resolvePublicSliderMedia({ image: item.image, topic: mediaTopic })
    : { image: "", fallbackApplied: false };
  const galleryImages = [...new Set([item.image, ...(item.images || [])]
    .map((image) => resolvePublicSliderMedia({ image, topic: mediaTopic }).image)
    .filter(Boolean))];

  const imageFit = item.imageFit || "cover";
  const detailsHref = `/discover/place/${item.id}`;

  return <article
    className={`discovery-card discovery-card--${item.world}${mapActive ? " is-map-active" : ""}`}
    data-map-place-id={item.id}
    onPointerEnter={() => onActiveChange?.(true)}
    onPointerLeave={() => onActiveChange?.(false)}
    onFocusCapture={() => onActiveChange?.(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onActiveChange?.(false); }}
    onClick={(event) => {
      const target = event.target as HTMLElement;
      if (target.closest("a,button,input,select,textarea,[role='button']")) return;
      router.push(detailsHref);
    }}
  >
    <PreviewCardGallery className={`discovery-card__visual discovery-card__visual--${imageFit}`} href={detailsHref} name={localizedName} images={galleryImages} imageFit={imageFit} imagePosition={item.imagePosition} imageLabel={localizedName} linkLabel={`${details}: ${localizedName}`}>
      {!media.image ? <span className="discovery-card__missing-image">{translate("תמונה אינה זמינה")}</span> : null}
      {item.rating && <span className="rating-badge">★ {item.rating.toFixed(1)}</span>}
    </PreviewCardGallery>
    <FavoriteButton id={item.id} world={item.world} name={localizedName} location={`${location}, ${area}`} image={media.image || undefined} href={`/discover/place/${item.id}`} meta={price} />
    <div className="discovery-card__body">
      <span className="discovery-card__meta"><PinIcon />{location}<small>{area}</small></span>
      <h3><Link className="discovery-card__stretched-link" href={detailsHref}>{localizedName}<span className="sr-only"></span></Link></h3>
      <p>{description}</p>
      <HorizontalChipRail className="discovery-card__chips" labels={features} ariaLabel={{he:"מאפיינים מרכזיים",en:"Key features",ru:"Основные удобства",fr:"Caractéristiques principales"}[language]} />
      <footer className={item.world === "hourly" ? "discovery-card__hourly-footer" : undefined}>
        {item.world === "hourly" ? <>
          <div className="preview-card-price-row"><strong>{price}</strong></div>
          <CardContactActions key={item.id} world="hourly" placeId={item.id} placeName={localizedName} phone={item.phone} whatsapp={item.whatsapp} serviceName={item.name} />
        </> : <>
        <strong>{price}</strong>
        </>}
      </footer>
    </div>
  </article>;
}
