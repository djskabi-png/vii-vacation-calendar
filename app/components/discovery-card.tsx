"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { DiscoveryItem } from "../data/world-data";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { PinIcon } from "../site-header";
import { trackPhoneReveal } from "../lib/analytics";
import { FavoriteButton } from "./favorite-button";
import { useState } from "react";

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 3.5 9 3a1.6 1.6 0 0 1 1.8 1l1 3a1.6 1.6 0 0 1-.5 1.7L9.7 10a14 14 0 0 0 4.3 4.3l1.3-1.6a1.6 1.6 0 0 1 1.7-.5l3 1a1.6 1.6 0 0 1 1 1.8l-.5 2.3a3 3 0 0 1-3 2.4A15.5 15.5 0 0 1 4.3 6.5a3 3 0 0 1 2.4-3Z"/></svg>;
}

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
  en: { details: "View details", from: "From", israel: "Israel", demo: "Demo profile", system: "Curated suggestion", image: "Illustrative image" },
  ru: { details: "Подробнее", from: "От", israel: "Израиль", demo: "Демо-профиль", system: "Рекомендация VII", image: "Иллюстрация" },
  fr: { details: "Voir les détails", from: "À partir de", israel: "Israël", demo: "Profil de démonstration", system: "Suggestion VII", image: "Image d'illustration" },
} satisfies Record<Exclude<SiteLanguage, "he">, Record<string, string>>;

function localizedPrice(label: string | undefined, language: Exclude<SiteLanguage, "he">, details: string) {
  if (!label) return details;
  const amount = label.match(/[\d,.]+/)?.[0];
  return amount ? `${interfaceCopy[language].from} ₪${amount}` : details;
}

export function DiscoveryCard({ item }: { item: DiscoveryItem }) {
  const { language, translate } = useSiteLanguage();
  const [phoneVisible, setPhoneVisible] = useState(false);
  const localized = language === "he" ? null : worldCopy[language][item.world];
  const ui = language === "he" ? null : interfaceCopy[language];
  const location = language === "he" ? item.location : placeNames[language][item.location] || ui!.israel;
  const area = language === "he" ? item.area : placeNames[language][item.area] || ui!.israel;
  const description = localized?.description || item.description;
  const features = localized?.chips || item.features.slice(0, 3);
  const details = ui?.details || (item.world === "hourly" ? "פרטי המקום" : "לפרטים");
  const price = language === "he" ? item.priceLabel || item.duration || details : localizedPrice(item.priceLabel || item.duration, language, details);

  if (!item.image) return null;

  const imageFit = item.imageFit || "cover";

  return <article className={`discovery-card discovery-card--${item.world}`}>
    <Link className={`discovery-card__visual discovery-card__visual--${imageFit}`} href={`/discover/place/${item.id}`} target="_blank" rel="noopener noreferrer" aria-label={`${details}: ${translate(item.name)}`}>
      <img src={item.image} alt={item.imageLabel && ui ? ui.image : translate(item.name)} loading="lazy" decoding="async" style={item.imagePosition ? { objectPosition: item.imagePosition } : undefined} />
      {item.imageLabel && <span className="image-context-label">{ui?.image || item.imageLabel}</span>}
      {item.rating && <span className="rating-badge">★ {item.rating.toFixed(1)}</span>}
    </Link>
    <FavoriteButton id={item.id} world={item.world} name={item.name} location={`${location}, ${area}`} image={item.image} href={`/discover/place/${item.id}`} meta={price} />
    <div className="discovery-card__body">
      <span className="discovery-card__meta"><PinIcon />{location}<small>{area}</small></span>
      <h3><Link href={`/discover/place/${item.id}`} target="_blank" rel="noopener noreferrer">{item.name}<span className="sr-only"></span></Link></h3>
      <p>{description}</p>
      <div className="discovery-card__chips">{features.map((feature) => <span key={feature}>{feature}</span>)}</div>
      <footer className={item.world === "hourly" ? "discovery-card__hourly-footer" : undefined}>
        <strong>{price}</strong>
        <div className="discovery-card__footer-actions">
          {item.world === "hourly" && item.phone ? phoneVisible
            ? <a className="discovery-card__quick-call" dir="ltr" href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} aria-label={translate(`חיוג אל ${item.name}`)}><PhoneIcon /><bdi>{item.phone}</bdi></a>
            : <button className="discovery-card__reveal-phone" type="button" onClick={() => { setPhoneVisible(true); trackPhoneReveal({ placeId: item.id, placeName: item.name, world: item.world, placement: "discovery_card" }); }}><PhoneIcon /><span>הצגת מספר</span></button>
          : null}
          <Link href={`/discover/place/${item.id}`} target="_blank" rel="noopener noreferrer">{details}<span className="sr-only"></span></Link>
        </div>
      </footer>
    </div>
  </article>;
}
