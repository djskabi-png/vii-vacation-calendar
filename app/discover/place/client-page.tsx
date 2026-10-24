"use client";
import { nearbyRecommendations } from "../../lib/nearby-recommendations";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { validSpaDealDate } from "../../lib/spa-package-deals";
import { spaDealCopy } from "../../i18n/spa-deal-copy";
import { localizedSpaPackageTitle } from "../../i18n/localized-spa-package";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { worldBreadcrumb } from "../../lib/seo";
import { FavoriteButton } from "../../components/favorite-button";
import { ViewedItemTracker } from "../../components/viewed-item-tracker";
import { useEffect, useMemo, useState } from "react";
import { DiscoveryCard } from "../../components/discovery-card";
import { ListingAccessibility } from "../../components/listing-accessibility";
import { PageShell } from "../../components/page-shell";
import { getSpaDetails, type SpaDetails, type SpaPackage } from "../../data/spa-details";
import { getProviderDetails, type ProviderDetails, type ProviderService } from "../../data/provider-details";
import { getHourlyDetails, type HourlyDetails } from "../../data/hourly-details";
import { getActivityDetails, type ActivityDetails } from "../../data/activity-details";
import { discoveryItems, worlds, type DiscoveryItem, type WorldId } from "../../data/world-data";
import { PinIcon } from "../../site-header";
import { DeferredDiscoveryMap } from "../../components/deferred-listing-map";
import { MasuExperience } from "../../components/masu-experience";
import { GalleryExperience } from "../../components/gallery-experience";
import { useGalleryDeepLink } from "../../components/use-gallery-deep-link";
import { DetailStickyDock, type DetailSectionLink } from "../../components/detail-sticky-dock";
import { GuestReviewStudio } from "../../components/guest-review-studio";
import { WhatsAppLeadButton } from "../../components/whatsapp-lead-button";
import { FloatingContactActions } from "../../components/floating-contact-actions";
import { DirectPhoneLink } from "../../components/direct-phone-link";
import { FeatureIcon } from "../../components/feature-icon";
import { SearchAfterResults } from "../../components/search-after-results";
import { providerDepthLocation } from "../../lib/world-depth-policy";
import { activityRegion, activityType } from "../../lib/activity-discovery-taxonomy";
import { HomeMobileRail } from "../../components/home-mobile-rail";
import { useSiteLanguage } from "../../i18n/locale-provider";
import { latinBusinessAlias, localizedBusinessList, localizedBusinessText } from "../../i18n/localized-business-content";
import { hourlyBreadcrumbsForLocation } from "../../data/world-search-landings";
import { spaBreadcrumbsForLocation } from "../../data/spa-search-landings";
import { discoveryBreadcrumbsForLocation } from "../../lib/place-breadcrumb-locations";

function hourlyRateLabel(value: string, language: "he" | "en" | "ru" | "fr", translate: (value: string) => string) {
  const [room, duration, day] = value.split(" · ");
  if (language === "he" || !room || !duration || !day) return value;
  const roomFallback = { en: "Private room", ru: "Отдельный номер", fr: "Chambre privée" }[language];
  const roomLabel = localizedBusinessText(room, language, translate, latinBusinessAlias(room) || roomFallback);
  const durations = {
    en: { "שעה": "1 hour", "שעתיים": "2 hours", "3 שעות": "3 hours" },
    ru: { "שעה": "1 час", "שעתיים": "2 часа", "3 שעות": "3 часа" },
    fr: { "שעה": "1 heure", "שעתיים": "2 heures", "3 שעות": "3 heures" },
  };
  const days = {
    en: { "יום חול": "weekday", "סוף שבוע": "weekend" },
    ru: { "יום חול": "будний день", "סוף שבוע": "выходные" },
    fr: { "יום חול": "en semaine", "סוף שבוע": "week-end" },
  };
  return `${roomLabel} · ${durations[language][duration as keyof typeof durations.en] || duration} · ${days[language][day as keyof typeof days.en] || day}`;
}

function hasListingMedia(item: DiscoveryItem) {
  return Boolean(item.image?.trim() || item.images?.some((image) => image?.trim()));
}

function SpaPackageCard({ pack, requestedDate }: { pack: SpaPackage; requestedDate?: string }) {
  const { language, translate } = useSiteLanguage();
  const text = spaDealCopy[language];
  const title = localizedSpaPackageTitle({title:pack.title,durationMinutes:pack.durationMinutes || null,people:pack.people || null,group:pack.group},language,translate);
  return <article className="spa-package-card" id={`spa-package-${pack.id}`}>
    {pack.image && <img className="spa-package-card__image" src={pack.image} alt={title} title={title} loading="lazy" decoding="async" />}
    <header><span>{translate(pack.audience === "לא צוין" ? "חבילת ספא" : pack.audience)}</span>{pack.duration && <small>{translate(pack.duration)}</small>}</header>
    <h3>{title}</h3>
    {requestedDate ? <p className="spa-package-request-date" data-no-translate>{text.requested}: {new Intl.DateTimeFormat(language === "he" ? "he-IL" : language, {day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${requestedDate}T12:00:00Z`))}. {text.chooseDate}</p> : null}
    {pack.includes.length > 0 && <ul>{pack.includes.map((entry) => <li key={entry}>{translate(entry)}</li>)}</ul>}
    <footer><strong>{pack.price}</strong><a className="button primary" href={pack.bookingUrl} target="_blank" rel="noopener noreferrer" aria-label={`בדיקת זמינות והזמנת ${pack.title} באתר ספא פלוס, נפתח בלשונית חדשה`}>בדיקת זמינות והזמנה</a></footer>
  </article>;
}

function SpaContent({ details }: { details: SpaDetails }) {
  const { language, translate } = useSiteLanguage();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date") || "";
  const selectedPackage = searchParams.get("package");
  const sourceFallback = { he: "מידע נוסף נמסר ישירות מהמקום.", en: "Additional information is supplied directly by the spa.", ru: "Дополнительная информация предоставлена непосредственно спа-центром.", fr: "Les informations complémentaires sont fournies directement par le spa." }[language];
  const addressFallback = { he: "הכתובת המלאה מופיעה בפרטי המקום.", en: "The full address appears in the venue details.", ru: "Полный адрес указан в информации о спа-центре.", fr: "L’adresse complète figure dans les informations du spa." }[language];
  const [expanded, setExpanded] = useState(false);
  const [sourceAbout, setSourceAbout] = useState<string[] | null>(null);
  const [sourceError, setSourceError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!expanded || sourceAbout) return;
    const controller = new AbortController();
    fetch(`/api/spa/description?id=${details.siteId}`, { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("source_unavailable"); return response.json(); })
      .then((body: { about?: unknown; editorial?: unknown }) => {
        if (body.editorial !== "vii" || !Array.isArray(body.about) || !body.about.length || body.about.some((value) => typeof value !== "string")) throw new Error("editorial_unavailable");
        if (!controller.signal.aborted) {
          setSourceAbout(body.about.filter((value): value is string => typeof value === "string"));
          setSourceError(false);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setSourceError(true); });
    return () => controller.abort();
  }, [expanded, details.siteId, sourceAbout, attempt]);

  return <>
    <section className="section shell spa-about" id="spa-about">
      <div><h2>{translate("על המקום")}</h2><p className="spa-about__summary">{localizedBusinessText(details.editorialSummary, language, translate, sourceFallback)}</p>
        <button type="button" className="spa-about__more" aria-expanded={expanded} aria-controls="spa-source-description" onClick={() => setExpanded((value) => !value)}>{expanded ? "הצג פחות" : "קרא עוד"}</button>
        <div id="spa-source-description" hidden={!expanded}>
          {expanded && <><h3>{translate("עוד על המקום")}</h3>{sourceAbout?.map((paragraph, index) => <p key={`${index}-${paragraph}`}>{localizedBusinessText(paragraph, language, translate, sourceFallback)}</p>)}{!sourceAbout && !sourceError && <p role="status">{translate("טוענים את המידע הנוסף...")}</p>}{sourceError && <p role="alert">{translate("לא הצלחנו לטעון את המידע.")} <button type="button" className="spa-about__more" onClick={() => { setSourceError(false); setAttempt((value) => value + 1); }}>{translate("נסו שוב")}</button></p>}</>}
        </div>
      </div>
      <aside>
        {details.address && <div><small>{translate("כתובת")}</small><strong>{localizedBusinessText(details.address, language, translate, addressFallback)}</strong></div>}
        {details.suitableFor.length > 0 && <div><small>{translate("מתאים עבור")}</small><strong>{details.suitableFor.map(translate).join(" · ")}</strong></div>}
      </aside>
    </section>
    {details.packages.length ? <section className="section section-tint" id="spa-packages"><div className="shell"><div className="section-head"><div><h2>חבילות הספא</h2></div></div><div className="spa-packages-grid">{details.packages.map((pack) => <SpaPackageCard key={pack.id} pack={pack} requestedDate={pack.id === selectedPackage && validSpaDealDate(requestedDate) ? requestedDate : undefined} />)}</div><p className="spa-price-note">המחיר והזמינות הסופיים מוצגים לפני אישור ההזמנה.</p></div></section> : <section className="section section-tint" id="spa-packages"><div className="shell depth-final-cta"><div><span className="eyebrow">חבילות ספא</span><h2>לבירור חבילות ומחירים</h2><p>בדקו חבילות וזמינות לפני ההזמנה.</p></div><a className="button primary" href={details.bookingUrl} target="_blank" rel="noopener noreferrer">בדיקת אפשרויות בספא פלוס</a></div></section>}
    {(details.treatments?.length || details.facilities.length) ? <section className="section shell spa-details-grid">
      {details.treatments?.length ? <div id="spa-treatments" className="spa-detail-panel"><h2>{translate("טיפולים")}</h2><div className="spa-treatment-list">{details.treatments.map((treatment) => <article key={treatment.name}><strong>{translate(treatment.name)}</strong>{treatment.durations?.length ? <span>{treatment.durations.map(translate).join(" · ")}</span> : null}{treatment.priceNote ? <small>{translate(treatment.priceNote)}</small> : null}</article>)}</div></div> : null}
      {details.facilities.length > 0 && <div id="spa-facilities" className="spa-detail-panel"><h2>{translate("מתקנים ושירותים")}</h2><ul className="spa-facility-list">{details.facilities.map((facility) => <li key={facility}><FeatureIcon label={facility} className="spa-facility-icon" /><span>{translate(facility)}</span></li>)}</ul></div>}
    </section> : null}
    {(details.hours?.length || details.arrivalNotes?.length) ? <section className="section section-soft" id="spa-info"><div className="shell spa-visit-info"><div><h2>שעות ופרטים שימושיים</h2>{details.hours?.map((entry) => <p key={entry}>{translate(entry)}</p>)}</div>{details.arrivalNotes?.length ? <ul>{details.arrivalNotes.map((note) => <li key={note}>{localizedBusinessText(note, language, translate, sourceFallback)}</li>)}</ul> : null}</div></section> : null}
    {details.faq?.length ? <section className="section shell spa-faq"><div className="section-head"><div><span className="eyebrow">{translate("שאלות נפוצות")}</span><h2>{translate("כל מה שרציתם לדעת")}</h2></div></div><div>{details.faq.map((entry) => <details key={entry.question}><summary>{translate(entry.question)}</summary><p>{translate(entry.answer)}</p></details>)}</div></section> : null}
  </>;
}

const masuServiceLinks: Record<string, string> = {
  "home-massage": "https://masu.co.il/partners/?page=product&lang=he",
  "home-facial": "https://masu.co.il/partners/?page=skincare&lang=he",
  "office-wellness": "https://masu.co.il/your-office-massage/",
  "event-massage": "https://masu.co.il/your-pamper-party/",
};

function ProviderServiceCard({ itemId, providerName, phone, service, priceLabel, bookingMode }: { itemId: string; providerName: string; phone?: string; service: ProviderService; priceLabel: string; bookingMode: "full" | "whatsapp" }) {
  const { translate } = useSiteLanguage();
  const requestHref = `/booking?world=providers&place=${encodeURIComponent(itemId)}&service=${encodeURIComponent(service.id)}`;
  const masuServiceHref = itemId === "masu-home-wellness" ? masuServiceLinks[service.id] : undefined;
  return <article className="provider-service-card">
    <span>{translate(service.suitableFor)}</span>
    <h3>{translate(service.title)}</h3>
    <p>{translate(service.description)}</p>
    <ul>{service.includes.map((entry) => <li key={entry}>{translate(entry)}</li>)}</ul>
    <strong className="provider-service-price">{translate(priceLabel)}</strong>
    {masuServiceHref
      ? <a
          className="button primary"
          href={masuServiceHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${service.title} באתר מאסו, נפתח בלשונית חדשה`}
        >בחירת השירות באתר מאסו</a>
      : bookingMode === "whatsapp"
        ? phone ? <WhatsAppLeadButton world="providers" placeId={itemId} placeName={providerName} businessPhone={phone} serviceName={service.title} buttonLabel="הזמנה בוואטסאפ" /> : null
        : <Link className="button primary" href={requestHref}>התחלת הזמנה</Link>}
  </article>;
}

function ProviderContent({ itemId, providerName, details, priceLabel }: { itemId: string; providerName: string; details: ProviderDetails; priceLabel: string }) {
  const { translate } = useSiteLanguage();
  const bookingMode = details.bookingMode || "full";
  return <>
    <section className="section shell provider-about" id="provider-about">
      <div><h2>{translate("מה אפשר להזמין")}</h2>{details.about.map((paragraph) => <p key={paragraph}>{translate(paragraph)}</p>)}</div>
      <aside>
        <span>{translate("תחום")}</span><strong>{translate(details.category)}</strong>
        <span>{translate("מתאים עבור")}</span><strong>{details.occasions.slice(0, 3).map(translate).join(" · ")}</strong>
        <span>דרך ההזמנה</span><strong>{bookingMode === "whatsapp" ? "הזמנה קצרה בוואטסאפ" : "תהליך הזמנה מלא באתר"}</strong>
        {details.phone ? <><span>{translate("שיחה ישירה")}</span><DirectPhoneLink phone={details.phone} placeName={providerName} className="provider-phone" tracking={{ placeId: itemId, placeName: providerName, world: "providers", placement: "provider_detail" }} /></> : null}
      </aside>
    </section>
    <section className="section section-tint provider-services-section" id="provider-services"><div className="shell"><div className="section-head"><div><h2>שירותים וחבילות להזמנה</h2><p>{bookingMode === "whatsapp" ? "בוחרים שירות וממלאים פרטים כדי לפנות לספק בוואטסאפ." : "בוחרים שירות וממשיכים לתיאום המועד והפרטים."}</p></div></div><div className="provider-services-grid">{details.services.map((service) => <ProviderServiceCard key={service.id} itemId={itemId} providerName={providerName} phone={details.phone} service={service} priceLabel={priceLabel} bookingMode={bookingMode} />)}</div></div></section>
    <section className="section shell provider-occasions"><div><h2>{translate("סוגי אירועים")}</h2></div><div>{details.occasions.map((occasion) => <span key={occasion}>{translate(occasion)}</span>)}</div></section>
    <section className="section section-soft provider-process-section" id="provider-process"><div className="shell"><div className="section-head"><div><h2>{translate("איך מזמינים")}</h2></div></div><ol className="provider-process">{details.process.map((step, index) => <li key={step}><span>{index + 1}</span><p>{translate(step)}</p></li>)}</ol></div></section>
    <section className="section shell provider-practical" id="provider-info"><div><h2>{translate("חשוב לדעת")}</h2></div><ul>{details.practicalNotes.map((note) => <li key={note}>{translate(note)}</li>)}</ul></section>
    <section className="section shell provider-faq" id="provider-faq"><div className="section-head"><div><span className="eyebrow">{translate("שאלות נפוצות")}</span><h2>{translate("תשובות לפני ההזמנה")}</h2></div></div><div>{details.faq.map((entry) => <details key={entry.question}><summary>{translate(entry.question)}</summary><p>{translate(entry.answer)}</p></details>)}</div></section>
    <section className="section provider-final-cta"><div className="shell"><div><h2>{bookingMode === "whatsapp" ? "פונים ישירות לספק" : "ממשיכים להזמנה מלאה ומסודרת"}</h2><p>{bookingMode === "whatsapp" ? "שלחו את פרטי האירוע לספק ובדקו יחד זמינות ומחיר." : "בחרו מועד, ציינו את מספר המשתתפים ובקשו את השירות שמתאים לכם."}</p></div><div>{bookingMode === "whatsapp" && details.phone ? <WhatsAppLeadButton world="providers" placeId={itemId} placeName={providerName} businessPhone={details.phone} serviceName={details.services[0]?.title} buttonLabel="הזמנה בוואטסאפ" /> : <Link className="button primary" href={`/booking?world=providers&place=${encodeURIComponent(itemId)}`}>התחלת הזמנה</Link>}</div></div></section>
  </>;
}

function HourlyContent({ item, details }: { item: (typeof discoveryItems)[number]; details: HourlyDetails }) {
  const { language, translate } = useSiteLanguage();
  const hourlyFallback = {
    he: { about: "המידע והמחירים מאושרים ישירות מול המקום.", room: "חדר פרטי", roomDescription: "אפשרות אירוח פרטית לפי שעה.", note: "יש לאשר את הפרטים מול המקום." },
    en: { about: "Details and prices are confirmed directly with the property.", room: "Private room", roomDescription: "A private hourly-stay option.", note: "Please confirm the details directly with the property." },
    ru: { about: "Информация и цены подтверждаются непосредственно объектом.", room: "Отдельный номер", roomDescription: "Вариант частного почасового размещения.", note: "Подтвердите детали непосредственно у объекта." },
    fr: { about: "Les informations et les tarifs sont confirmés directement avec l’établissement.", room: "Chambre privée", roomDescription: "Une option de séjour privé à l’heure.", note: "Veuillez confirmer les détails auprès de l’établissement." },
  }[language];
  const safeHourlyText = (value: string | undefined | null, fallback: string) => localizedBusinessText(value, language, translate, fallback);
  const [selectedDuration, setSelectedDuration] = useState(details.rates[0]?.duration || "");
  const selectedRate = details.rates.find((rate) => rate.duration === selectedDuration);
  const contactCopy = {
    he: { eyebrow: "תיאום ישיר", title: "בדיקת זמינות מול המקום", selected: (duration: string, price: string) => `בחרתם ${duration}, במחיר בסיס של ${price}. `, confirm: "בשיחה מאשרים תאריך, שעה, חדר, מחיר והנחיות הגעה.", payment: "התשלום והתיאום נעשים ישירות מול המקום." },
    en: { eyebrow: "Direct coordination", title: "Check availability with the property", selected: (duration: string, price: string) => `You selected ${duration}, with a base price of ${price}. `, confirm: "Confirm the date, time, room, final price and arrival instructions directly with the property.", payment: "Payment and coordination are handled directly with the property." },
    ru: { eyebrow: "Прямое согласование", title: "Проверка доступности напрямую", selected: (duration: string, price: string) => `Вы выбрали ${duration}, базовая цена ${price}. `, confirm: "Подтвердите дату, время, номер, итоговую цену и инструкции по прибытию непосредственно у объекта.", payment: "Оплата и согласование выполняются непосредственно с объектом." },
    fr: { eyebrow: "Coordination directe", title: "Vérifier la disponibilité auprès de l’établissement", selected: (duration: string, price: string) => `Vous avez choisi ${duration}, au tarif de base de ${price}. `, confirm: "Confirmez la date, l’heure, la chambre, le tarif final et les modalités d’arrivée auprès de l’établissement.", payment: "Le paiement et la coordination se font directement avec l’établissement." },
  }[language];
  const phoneHref = item.phone ? `tel:${item.phone.replace(/[^\d+]/g, "")}` : undefined;
  const roomImages = item.images?.length ? item.images : item.image ? [item.image] : [];

  return <>
    <section className="section shell hourly-overview" id="hourly-about">
      <div className="hourly-overview__copy"><span className="eyebrow">כל המידע במקום אחד</span><h2>{translate("על המקום")}</h2>{details.about.map((paragraph) => <p key={paragraph}>{safeHourlyText(paragraph, hourlyFallback.about)}</p>)}</div>
      <div className="hourly-overview__facts" aria-label="פרטי שהייה מרכזיים">
        <article><small>סוג שהייה</small><strong>אירוח פרטי לפי שעה</strong></article>
        <article><small>תיאום</small><strong>ישירות מול המקום</strong></article>
        <article><small>אישור</small><strong>לאחר בחירת שעה וחדר</strong></article>
        {details.entryDisclosure ? <article><small>{translate("אופן הכניסה")}</small><strong>{translate(details.entryDisclosure.label)}</strong></article> : null}
      </div>
    </section>
    <section className="section section-tint hourly-rooms" id="hourly-options"><div className="shell">
      <div className="section-head"><div><span className="eyebrow">אפשרויות האירוח</span><h2>החדרים והמחירים</h2><p>בוחרים חדר ומשך שהייה, ואז מאשרים מול המקום את השעה הפנויה והמחיר הסופי.</p></div></div>
      {details.stayOptions.length ? <div className="hourly-room-grid">{details.stayOptions.map((option, index) => {
        const roomRates = details.rates.filter((rate) => rate.duration.startsWith(`${option.title} ·`));
        const image = roomImages[index % Math.max(roomImages.length, 1)];
        return <article className="hourly-room-card" key={option.title}>
          {image ? <div className="hourly-room-card__media"><img src={image} alt="" /></div> : null}
          <div className="hourly-room-card__body"><h3>{safeHourlyText(option.title, latinBusinessAlias(option.title) || `${hourlyFallback.room} ${index + 1}`)}</h3><p>{safeHourlyText(option.description, hourlyFallback.roomDescription)}</p>
            {roomRates.length ? <div className="hourly-room-card__rates" role="group" aria-label={`מחירי ${option.title}`}>{roomRates.map((rate) => <button key={rate.duration} type="button" className={selectedDuration === rate.duration ? "selected" : ""} onClick={() => setSelectedDuration(rate.duration)} aria-pressed={selectedDuration === rate.duration}><span data-no-translate>{hourlyRateLabel(rate.duration, language, translate).replace(`${translate(option.title)} · `, "")}</span><strong>{rate.price}</strong></button>)}</div> : <p className="hourly-room-card__no-rate">{translate("למחיר ולבירור זמינות, פנו למקום.")}</p>}
          </div>
        </article>;
      })}</div> : details.rates.length ? <div className="hourly-rate-grid" role="group" aria-label="מחירי בסיס לפי חדר ומשך שהייה">{details.rates.map((rate) => <button key={rate.duration} type="button" className={selectedDuration === rate.duration ? "selected" : ""} onClick={() => setSelectedDuration(rate.duration)} aria-pressed={selectedDuration === rate.duration}><span data-no-translate>{hourlyRateLabel(rate.duration, language, translate)}</span><strong>{rate.price}</strong></button>)}</div> : <p>{translate("למחירי החדרים ולבירור זמינות, פנו למקום.")}</p>}
      <div className="hourly-contact-card" id="hourly-contact"><div><span className="eyebrow">{contactCopy.eyebrow}</span><h3>{contactCopy.title}</h3><p>{selectedRate ? contactCopy.selected(hourlyRateLabel(selectedRate.duration, language, translate), selectedRate.price) : ""}{contactCopy.confirm}</p></div><aside><small>{translate("טלפון המקום")}</small>{phoneHref ? <DirectPhoneLink phone={item.phone} placeName={item.name} className="hourly-phone-number" tracking={{ placeId: item.id, placeName: item.name, world: "hourly", placement: "hourly_detail" }} /> : <span className="hourly-phone-missing">{translate("מספר טלפון אינו זמין כרגע")}</span>}<small>{contactCopy.payment}</small></aside></div>
    </div></section>
    <section className="section shell hourly-practical">
      {details.amenities.length ? <div id="hourly-amenities"><span className="eyebrow">מה מחכה בחדר</span><h2>{translate("מתקנים ושירותים")}</h2><div className="hourly-feature-grid">{details.amenities.map((entry) => <article key={entry}><FeatureIcon label={entry} className="hourly-feature-icon" /><strong>{translate(entry)}</strong></article>)}</div></div> : null}
      <div id="hourly-info"><span className="eyebrow">לפני שמגיעים</span><h2>{translate("מידע שימושי")}</h2><div className="hourly-info-list">{details.arrivalNotes.map((entry) => <p key={entry}>{safeHourlyText(entry, hourlyFallback.note)}</p>)}</div></div>
    </section>
    <section className="section shell depth-faq" id="hourly-faq"><div className="section-head"><div><h2>{translate("שאלות נפוצות")}</h2></div></div>{details.faq.map((entry) => <details key={entry.question}><summary>{translate(entry.question)}</summary><p>{translate(entry.answer)}</p></details>)}</section>
    <section className="section depth-final-cta"><div className="shell"><div><h2>מאשרים שעה ישירות מול המקום</h2><p>בודקים חדר, שעה, מחיר והנחיות הגעה בשיחה.</p></div>{phoneHref ? <a className="button primary" href={phoneHref}>חיוג למקום</a> : <a className="button primary" href="#hourly-contact">לפרטי הקשר</a>}</div></section>
  </>;
}

function ActivityContent({ itemId, details }: { itemId: string; details: ActivityDetails }) {
  const onlineHref = `/booking?world=activities&place=${encodeURIComponent(itemId)}&offer=activity-order`;
  const phoneHref = details.booking?.phone ? `tel:${details.booking.phone.replace(/[^\d+]/g, "")}` : "";
  return <>
    <section className="section shell depth-about" id="activity-about"><div><h2>על החוויה</h2>{details.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div><aside>{details.facts.map((fact) => <div key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></div>)}</aside></section>
    <section className="section section-tint" id="activity-highlights"><div className="shell"><div className="section-head"><div><h2>מה מחכה בדרך</h2></div></div><div className="depth-card-grid">{details.highlights.map((entry) => <article key={entry}><h3>{entry}</h3></article>)}</div></div></section>
    <section className="section shell depth-columns"><div id="activity-plan"><h2>{details.kind === "matching" ? "כך מתאימים את החוויה" : "תוכנית מוצעת"}</h2><ol>{details.plan.map((entry, index) => <li key={entry}><span>{index + 1}</span><p>{entry}</p></li>)}</ol></div><div id="activity-preparation"><h2>מה חשוב להכין</h2><ul>{details.preparation.map((entry) => <li key={entry}>{entry}</li>)}</ul></div></section>
    {details.booking ? <section className="section section-soft activity-booking" id="activity-booking"><div className="shell activity-booking__inner"><div><span className="eyebrow">לפי אופן העבודה של הספק</span><h2>איך מזמינים את האטרקציה?</h2><p>{details.booking.note}</p></div><div className="activity-booking__actions">{details.booking.mode !== "phone" ? <Link className="button primary" href={onlineHref}>{details.booking.onlineLabel || "רכישה אונליין"}</Link> : phoneHref ? <a className="button secondary" href={phoneHref}>הזמנה בטלפון</a> : null}</div></div></section> : null}
    <section className="section shell depth-faq" id="activity-faq"><div className="section-head"><div><h2>שאלות נפוצות</h2></div></div>{details.faq.map((entry) => <details key={entry.question}><summary>{entry.question}</summary><p>{entry.answer}</p></details>)}</section>
    <section className="section depth-final-cta"><div className="shell"><div><h2>{details.kind === "matching" ? "מזמינים חוויה שמתאימה להרכב שלכם" : "שומרים את התוכנית וממשיכים לבחור מקום אירוח"}</h2><p>{details.kind === "matching" ? "בחרו חוויה ובדקו את המועד, המחיר ומה כלול לפני ההזמנה." : "אפשר לחזור לחיפוש ולבחור מקום באזור שמתאים למסלול."}</p></div>{details.booking ? <div className="activity-booking__actions">{details.booking.mode !== "phone" ? <Link className="button primary" href={onlineHref}>{details.booking.onlineLabel || "רכישה אונליין"}</Link> : phoneHref ? <a className="button secondary" href={phoneHref}>הזמנה בטלפון</a> : null}</div> : <Link className="button primary" href={details.kind === "matching" ? `/booking?world=activities&place=${encodeURIComponent(itemId)}` : "/"}>{details.kind === "matching" ? "הזמנה אונליין" : "לחיפוש מקום אירוח"}</Link>}</div></section>
  </>;
}

export default function DiscoveryPlacePage({ initialId, initialItem, relatedItems, initialSpaDetails, initialHourlyDetails }:
  { initialId: string; initialItem?: DiscoveryItem; relatedItems?: DiscoveryItem[];
    initialSpaDetails?: SpaDetails; initialHourlyDetails?: HourlyDetails }) {
  const { language, translate } = useSiteLanguage();
  const { galleryOpen, galleryStart, galleryTab, openGallery, closeGallery, updateGallerySelection } = useGalleryDeepLink();
  const item = useMemo(() => initialItem || discoveryItems.find((entry) => entry.id === initialId) || discoveryItems[0], [initialId, initialItem]);
  const world = worlds.find((entry) => entry.id === item.world) || worlds[2];
  const detailCopy = {
    he: { name: "עסק מאומת", location: "ישראל", description: (name: string, location: string) => `${name} נמצא ב${location}. בעמוד מרוכזים התמונות, השירותים, המידע המעשי ודרכי ההזמנה שנמסרו לאתר.` },
    en: { name: "Verified business", location: "Israel", description: (name: string, location: string) => `${name} is located in ${location}. This page brings together its photos, services, practical details and booking options.` },
    ru: { name: "Проверенный объект", location: "Израиль", description: (name: string, location: string) => `${name} находится в регионе ${location}. На странице собраны фотографии, услуги, практическая информация и способы бронирования.` },
    fr: { name: "Établissement vérifié", location: "Israël", description: (name: string, location: string) => `${name} se trouve en ${location}. Cette page regroupe les photos, les services, les informations pratiques et les options de réservation.` },
  }[language];
  const safeDetailText = (value: string | undefined | null, fallback: string) => localizedBusinessText(value, language, translate, fallback);
  const localizedItemName = safeDetailText(item.name, latinBusinessAlias(item.name) || detailCopy.name);
  const localizedArea = safeDetailText(item.area, detailCopy.location);
  const localizedLocation = safeDetailText(item.location, localizedArea);
  const localizedDescription = safeDetailText(item.description, detailCopy.description(localizedItemName, localizedLocation));
  const localizedFeatures = localizedBusinessList(item.features, language, translate);
  const breadcrumbPrefix = {
    he: { hourly: "חדרים לפי שעה ב", spa: "ספא ב", activities: "אטרקציות ב", providers: "ספקים ב" },
    en: { hourly: "Hourly rooms in ", spa: "Spa in ", activities: "Activities in ", providers: "Providers in " },
    ru: { hourly: "Почасовые комнаты в ", spa: "Спа в ", activities: "Развлечения в ", providers: "Поставщики в " },
    fr: { hourly: "Chambres à l’heure à ", spa: "Spa à ", activities: "Activités à ", providers: "Prestataires à " },
  }[language];
  const localizedBreadcrumbs = (items: Array<{ name: string; path?: string }>, prefix: string) => items.map((entry) => {
    const rawLocation = entry.path ? new URL(entry.path, "https://vii.local").searchParams.get("location") : null;
    const localized = rawLocation ? safeDetailText(rawLocation, latinBusinessAlias(rawLocation) || detailCopy.location) : detailCopy.location;
    return { ...entry, name: `${prefix}${localized}` };
  });
  const related = nearbyRecommendations((relatedItems || discoveryItems).filter((entry) => entry.world === item.world && hasListingMedia(entry)), item,
    { key: (entry) => entry.id, exclude: item.id }).items;
  const spaDetails = item.world === "spa" ? initialSpaDetails || getSpaDetails(item.id) : undefined;
  const providerDetails = item.world === "providers" ? getProviderDetails(item.id) : undefined;
  const hourlyDetails = item.world === "hourly" ? initialHourlyDetails || getHourlyDetails(item) : undefined;
  const activityDetails = item.world === "activities" ? getActivityDetails(item) : undefined;
  const galleryImages = item.images?.length ? item.images : item.image ? [item.image] : [];
  const gallerySubject = { name: item.name, images: galleryImages };
  const sections = useMemo<DetailSectionLink[]>(() => {
    if (spaDetails) return [
      { href: "#spa-about", label: "על המקום" },
      { href: "#spa-packages", label: spaDetails.packages?.length ? "חבילות" : "הזמנה" },
      ...(spaDetails.treatments?.length ? [{ href: "#spa-treatments" as const, label: "טיפולים" }] : []),
      ...(spaDetails.facilities.length ? [{ href: "#spa-facilities" as const, label: "מתקנים" }] : []),
      ...(spaDetails.hours?.length ? [{ href: "#spa-info" as const, label: "שעות ופרטים" }] : []),
      ...(item.lat && item.lng ? [{ href: "#location" as const, label: "מפה" }] : []),
      { href: "#reviews", label: translate("חוות דעת") },
    ];
    if (providerDetails) return [
      { href: "#provider-about", label: "על הספק" }, { href: "#provider-services", label: "שירותים" },
      { href: "#provider-process", label: "איך מזמינים" }, { href: "#provider-info", label: "חשוב לדעת" },
      { href: "#provider-faq", label: translate("שאלות נפוצות") }, { href: "#reviews", label: translate("חוות דעת") },
    ];
    if (hourlyDetails) return [
      { href: "#hourly-about", label: "על המקום" }, { href: "#hourly-options", label: "אפשרויות שהייה" },
      { href: "#hourly-amenities", label: "מה במקום" }, { href: "#hourly-info", label: "לפני שמגיעים" },
      { href: "#hourly-faq", label: translate("שאלות נפוצות") },
      ...(item.lat && item.lng ? [{ href: "#location" as const, label: translate("מפה") }] : []),
      { href: "#reviews", label: translate("חוות דעת") },
    ];
    return [
      { href: "#activity-about", label: "על החוויה" }, { href: "#activity-highlights", label: "מה מחכה בדרך" },
      { href: "#activity-plan", label: "תכנון מלא" }, { href: "#activity-preparation", label: "מה להכין" },
      ...(activityDetails?.booking ? [{ href: "#activity-booking" as const, label: "איך מזמינים" }] : []),
      { href: "#activity-faq", label: translate("שאלות נפוצות") }, { href: "#reviews", label: translate("חוות דעת") },
    ];
  }, [activityDetails, hourlyDetails, providerDetails, spaDetails, item.lat, item.lng, translate]);
  const activityPhoneOnly = activityDetails?.booking?.mode === "phone";
  const phone = item.world === "hourly" ? item.phone : activityPhoneOnly ? activityDetails.booking?.phone : undefined;
  const onlineHref = item.id === "masu-home-wellness" || item.world === "hourly" || activityPhoneOnly ? undefined : item.world === "providers" && providerDetails?.bookingMode === "whatsapp"
    ? "#provider-services"
    : item.world === "spa" && spaDetails?.packages?.length
    ? "#spa-packages"
    : `/booking?world=${item.world}&place=${encodeURIComponent(item.id)}`;
  const onlineLabel = item.world === "spa" ? "בחירת חבילת ספא" : item.world === "providers" ? "בחירת שירות" : "הזמנה אונליין";

  return <PageShell variant={item.world as WorldId}>
    <ViewedItemTracker id={item.id} world={item.world} name={item.name} location={`${item.location}, ${item.area}`} image={item.image} href={`/discover/place/${item.id}`} meta={item.priceLabel || item.duration} />
    <main id="main-content" className={`discovery-detail discovery-detail--${item.world}`}>
      <BreadcrumbTrail items={item.world === "hourly"
        ? [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...localizedBreadcrumbs(hourlyBreadcrumbsForLocation(item.area, item.location), breadcrumbPrefix.hourly), { name: localizedItemName }]
        : item.world === "spa"
          ? [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...localizedBreadcrumbs(spaBreadcrumbsForLocation(item.area, item.location), breadcrumbPrefix.spa), { name: localizedItemName }]
          : item.world === "activities"
            ? [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...localizedBreadcrumbs(discoveryBreadcrumbsForLocation("activities", item.area, item.location), breadcrumbPrefix.activities), { name: localizedItemName }]
            : [{ name: "ראשי", path: "/" }, worldBreadcrumb(item.world), ...localizedBreadcrumbs(discoveryBreadcrumbsForLocation("providers", undefined, item.location), breadcrumbPrefix.providers), { name: localizedItemName }]} />
      <section className="shell discovery-detail__hero">
        <div className="discovery-detail__copy"><span className="eyebrow">{translate(world.label)}</span><h1>{localizedItemName}</h1><p className="discovery-detail__location"><PinIcon />{localizedLocation}, {localizedArea}</p>{(item.world === "spa" || item.world === "hourly") ? <ListingAccessibility slug={item.id} features={item.features} compact /> : null}<p>{localizedDescription}</p><div className="discovery-card__chips">{localizedFeatures.map((feature) => <span key={feature}><FeatureIcon label={feature} className="discovery-card__chip-icon" /><span>{feature}</span></span>)}</div><div className="discovery-detail__actions">{spaDetails ? <a className="button primary" href="#spa-packages">{translate("לבחירת חבילה")}</a> : providerDetails ? <a className="button primary" href="#provider-services">{translate("לבחירת שירות")}</a> : hourlyDetails ? <DirectPhoneLink phone={item.phone} placeName={localizedItemName} className="button primary" tracking={{ placeId: item.id, placeName: item.name, world: "hourly", placement: "hourly_title" }} /> : activityDetails?.booking ? <a className="button primary" href="#activity-booking">{translate("איך מזמינים")}</a> : activityDetails ? <a className="button primary" href="#activity-plan">{translate("לתכנון המלא")}</a> : <Link className="button primary" href={world.href}>{translate("לכל האפשרויות")}</Link>}<FavoriteButton id={item.id} world={item.world} name={item.name} location={`${item.location}, ${item.area}`} image={item.image} href={`/discover/place/${item.id}`} meta={item.priceLabel || item.duration} compact={false} /><Link className="button secondary" href={world.href}>{translate("חזרה לרשימה")}</Link></div></div>
        <div className={`discovery-detail__media discovery-card__placeholder--${item.world}`}>{item.image ? <><button className="discovery-detail__gallery-media" type="button" data-gallery-trigger onClick={() => openGallery("all", 0)} aria-label={`פתיחת הגלריה של ${item.name}`}><img src={item.image} alt="" title="" data-image-role="decorative" /></button><button className="discovery-detail__gallery-launch" type="button" data-gallery-trigger onClick={() => openGallery("all", 0)}><span aria-hidden="true">▦</span>לגלריה <small>{galleryImages.length} {galleryImages.length === 1 ? "תמונה" : "תמונות"}</small></button></> : null}</div>
      </section>
      <DetailStickyDock name={localizedItemName} sections={sections} onlineHref={onlineHref} onlineLabel={onlineLabel} phone={phone} />
      {spaDetails ? <SpaContent key={spaDetails.siteId} details={spaDetails} /> : null}
      {providerDetails ? <ProviderContent itemId={item.id} providerName={item.name} details={providerDetails} priceLabel={item.priceLabel || "מחיר ייקבע לפני אישור"} /> : null}
      {hourlyDetails ? <HourlyContent item={item} details={hourlyDetails} /> : null}
      {activityDetails ? <ActivityContent itemId={item.id} details={activityDetails} /> : null}
      {((spaDetails && item.lat && item.lng) || (hourlyDetails && item.lat && item.lng)) ? <section className={`section shell discovery-location discovery-location--${item.world}`} id="location"><div className="discovery-location__intro"><h2>המקום על המפה</h2><p>{item.world === "spa" ? "המיקום במפה הוא אזורי. הכתובת המדויקת מופיעה בפרטי המקום." : "רואים את אזור המקום ושומרים על פרטיות מלאה. פרטי ההגעה המדויקים נמסרים לאחר אישור."}</p></div><DeferredDiscoveryMap items={[item]} tone={item.world === "spa" ? "spa" : "hourly"} single /></section> : null}
      {(item.world === "spa" || item.world === "hourly") && <div className="shell discovery-detail__accessibility"><ListingAccessibility slug={item.id} features={item.features} /></div>}
      {(item.world === "spa" || item.world === "hourly") && item.id !== "masu-home-wellness" ? <div className="section shell"><MasuExperience context={item.world === "spa" ? "spa" : "hourly"} /></div> : null}
      <div className="section shell"><GuestReviewStudio placeName={localizedItemName} subjectId={item.id} rating={item.rating} /></div>
      <section className="section section-tint"><div className="shell"><div className="section-head"><div><h2>{translate("עוד אפשרויות שכדאי לראות")}</h2></div></div><HomeMobileRail shufflePlaces id="discovery-detail-related" label={translate("עוד אפשרויות שכדאי לראות")} className="discovery-grid">{related.map((entry) => <DiscoveryCard key={entry.id} item={entry} />)}</HomeMobileRail></div></section>
      {item.world === "hourly" ? <FloatingContactActions world="hourly" placeId={item.id} placeName={item.name} phone={item.phone} whatsapp={item.whatsapp} serviceName="חדרים לפי שעה" /> : null}
      {(item.world === "spa" || item.world === "hourly" || item.world === "providers" || item.world === "activities") ? <SearchAfterResults world={item.world} discoveryOnly location={item.world === "providers" ? providerDepthLocation(item.serviceAreas) : item.world === "activities" ? activityRegion(item) || undefined : item.location} inventory={[item, ...(relatedItems || []).filter(entry => entry.world === item.world)].map(entry => ({ location: entry.location, area: item.world === "activities" ? activityRegion(entry) || "" : entry.area, type: item.world === "activities" ? activityType(entry) || undefined : undefined, serviceAreas: entry.serviceAreas }))} /> : null}
    </main>
    <GalleryExperience key={`${item.id}-${galleryOpen ? `${galleryTab}-${galleryStart}` : "closed"}`} property={{ ...gallerySubject, name: localizedItemName }} open={galleryOpen} initialIndex={galleryStart} initialTab={galleryTab} onSelectionChange={updateGallerySelection} onClose={closeGallery} />
  </PageShell>;
}
