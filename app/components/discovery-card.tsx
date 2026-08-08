"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { DiscoveryItem } from "../data/world-data";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { PinIcon } from "../site-header";
import { FavoriteButton } from "./favorite-button";
import { useState } from "react";

const placeNames: Record<Exclude<SiteLanguage, "he">, Record<string, string>> = {
  en: { "תל אביב": "Tel Aviv", "ירושלים": "Jerusalem", "נהריה": "Nahariya", "חיפה": "Haifa", "רגבה": "Regba", "כמון": "Kamon", "רמת גן": "Ramat Gan", "אילת": "Eilat", "הרצליה": "Herzliya", "אשדוד": "Ashdod", "אשקלון": "Ashkelon", "טבריה": "Tiberias", "נתניה": "Netanya", "פתח תקווה": "Petah Tikva", "ראשון לציון": "Rishon LeZion", "רחובות": "Rehovot", "באר שבע": "Beersheba", "ים המלח": "Dead Sea", "מרכז": "Central Israel", "צפון": "Northern Israel", "דרום ונגב": "Southern Israel and the Negev", "ירושלים והסביבה": "Jerusalem area", "אילת והערבה": "Eilat and the Arava", "גליל מערבי": "Western Galilee", "חיפה והקריות": "Haifa area" },
  ru: { "תל אביב": "Тель-Авив", "ירושלים": "Иерусалим", "נהריה": "Нагария", "חיפה": "Хайфа", "רגבה": "Регба", "כמון": "Камон", "רמת גן": "Рамат-Ган", "אילת": "Эйлат", "הרצליה": "Герцлия", "אשדוד": "Ашдод", "אשקלון": "Ашкелон", "טבריה": "Тверия", "נתניה": "Нетания", "פתח תקווה": "Петах-Тиква", "ראשון לציון": "Ришон-ле-Цион", "רחובות": "Реховот", "באר שבע": "Беэр-Шева", "ים המלח": "Мёртвое море", "מרכז": "Центр Израиля", "צפון": "Север Израиля", "דרום ונגב": "Юг Израиля и Негев", "ירושלים והסביבה": "Иерусалим и окрестности", "אילת והערבה": "Эйлат и Арава", "גליל מערבי": "Западная Галилея", "חיפה והקריות": "Хайфа и окрестности" },
  fr: { "תל אביב": "Tel-Aviv", "ירושלים": "Jérusalem", "נהריה": "Nahariya", "חיפה": "Haïfa", "רגבה": "Regba", "כמון": "Kamon", "רמת גן": "Ramat Gan", "אילת": "Eilat", "הרצליה": "Herzliya", "אשדוד": "Ashdod", "אשקלון": "Ashkelon", "טבריה": "Tibériade", "נתניה": "Netanya", "פתח תקווה": "Petah Tikva", "ראשון לציון": "Rishon LeZion", "רחובות": "Rehovot", "באר שבע": "Beer-Sheva", "ים המלח": "Mer Morte", "מרכז": "Centre d'Israël", "צפון": "Nord d'Israël", "דרום ונגב": "Sud d'Israël et Néguev", "ירושלים והסביבה": "Jérusalem et environs", "אילת והערבה": "Eilat et Arava", "גליל מערבי": "Galilée occidentale", "חיפה והקריות": "Haïfa et environs" },
};

const worldCopy: Record<Exclude<SiteLanguage, "he">, Record<DiscoveryItem["world"], { description: string; chips: string[] }>> = {
  en: {
    spa: { description: "Spa venue with treatments, packages and facilities presented here for easy comparison and booking.", chips: ["Spa treatments", "Packages", "Booking options"] },
    hourly: { description: "Private short-stay accommodation with clear stay options and booking information.", chips: ["Private stay", "Flexible hours", "Booking options"] },
    providers: { description: "Professional service for holidays and events, with service details and a direct booking route.", chips: ["Professional service", "Events", "Direct booking"] },
    activities: { description: "An experience to add to your visit, with practical information and booking options in one place.", chips: ["Experience", "Nearby", "Visitor information"] },
  },
  ru: {
    spa: { description: "Спа-центр с процедурами, пакетами и удобствами для простого сравнения и бронирования.", chips: ["Спа-процедуры", "Пакеты", "Варианты бронирования"] },
    hourly: { description: "Приватное размещение на несколько часов с понятными вариантами пребывания и бронирования.", chips: ["Приватность", "Гибкие часы", "Бронирование"] },
    providers: { description: "Профессиональная услуга для отдыха и мероприятий с подробностями и прямым способом заказа.", chips: ["Профессиональная услуга", "Мероприятия", "Прямой заказ"] },
    activities: { description: "Впечатление для вашей поездки с полезной информацией и вариантами заказа в одном месте.", chips: ["Впечатление", "Рядом", "Информация"] },
  },
  fr: {
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
  const { language } = useSiteLanguage();
  const [phoneVisible, setPhoneVisible] = useState(false);
  const localized = language === "he" ? null : worldCopy[language][item.world];
  const ui = language === "he" ? null : interfaceCopy[language];
  const location = language === "he" ? item.location : placeNames[language][item.location] || ui!.israel;
  const area = language === "he" ? item.area : placeNames[language][item.area] || ui!.israel;
  const description = localized?.description || item.description;
  const features = localized?.chips || item.features.slice(0, 3);
  const details = ui?.details || "לפרטים";
  const price = language === "he" ? item.priceLabel || item.duration || details : localizedPrice(item.priceLabel || item.duration, language, details);

  if (!item.image) return null;

  const imageFit = item.imageFit || "cover";

  return <article className={`discovery-card discovery-card--${item.world}`}>
    <Link className={`discovery-card__visual discovery-card__visual--${imageFit}`} href={`/discover/place?world=${item.world}&id=${item.id}`} aria-label={`${details}: ${item.name}`}>
      <img src={item.image} alt={item.imageLabel && ui ? ui.image : item.name} style={item.imagePosition ? { objectPosition: item.imagePosition } : undefined} />
      {item.imageLabel && <span className="image-context-label">{ui?.image || item.imageLabel}</span>}
      {item.rating && <span className="rating-badge">★ {item.rating.toFixed(1)}</span>}
    </Link>
    <FavoriteButton id={item.id} world={item.world} name={item.name} location={`${location}, ${area}`} image={item.image} href={`/discover/place?world=${item.world}&id=${item.id}`} meta={price} />
    <div className="discovery-card__body" data-no-translate={language !== "he" ? true : undefined}>
      <span className="discovery-card__meta"><PinIcon />{location}<small>{area}</small></span>
      <h3><Link href={`/discover/place?world=${item.world}&id=${item.id}`}>{item.name}</Link></h3>
      <p>{description}</p>
      <div className="discovery-card__chips">{features.map((feature) => <span key={feature}>{feature}</span>)}</div>
      <footer className={item.world === "hourly" ? "discovery-card__hourly-footer" : undefined}>
        <strong>{price}</strong>
        <div className="discovery-card__footer-actions">
          {item.world === "hourly" && item.phone ? phoneVisible
            ? <a className="discovery-card__quick-call" dir="ltr" href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} aria-label={`חיוג אל ${item.name}`}>☎ {item.phone}</a>
            : <button className="discovery-card__reveal-phone" type="button" onClick={() => setPhoneVisible(true)}>הצגת מספר</button>
          : null}
          <Link href={`/discover/place?world=${item.world}&id=${item.id}`}>{details}</Link>
        </div>
      </footer>
    </div>
  </article>;
}
