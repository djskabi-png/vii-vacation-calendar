"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BreadcrumbTrail } from "../components/breadcrumb-trail";
import { vacationBreadcrumbForLocation } from "../data/vacation-landings";
import { eventBreadcrumbsForLocation, hourlyBreadcrumbsForLocation } from "../data/world-search-landings";
import { spaBreadcrumbsForLocation } from "../data/spa-search-landings";
import { CalendarDemo, currentSiteDay } from "../calendar-demo";
import { ListingMap } from "../components/listing-map";
import { PageShell } from "../components/page-shell";
import { PropertyCard, resolveAvailabilityForStay } from "../components/property-card";
import { DiscoveryCard } from "../components/discovery-card";
import { ListingAccessibility } from "../components/listing-accessibility";
import { hasVerifiedAccessibilityFeature } from "../data/accessibility-data";
import { SleepingArrangements } from "../components/sleeping-arrangements";
import { VerifiedSleepingDetails, type VerifiedSleepingRoom } from "../components/verified-sleeping-details";
import type { BusinessWorld, ListingFeatureGroup, ListingHighlightIcon, Property } from "../data/site-data";
import type { DiscoveryItem } from "../data/world-data";
import { getListingOfferings } from "../lib/listing-offerings";
import { nearbyTrails, type Trail } from "../data/trail-data";
import { nearbyRecommendations, nearbyRecommendationCopy } from "../lib/nearby-recommendations";
import { HomeMobileRail } from "../components/home-mobile-rail";
import { TrailCard } from "../components/trail-card";
import { GalleryExperience } from "../components/gallery-experience";
import { useGalleryDeepLink } from "../components/use-gallery-deep-link";
import { GuestReviewStudio } from "../components/guest-review-studio";
import { WhatsAppLeadButton } from "../components/whatsapp-lead-button";
import { ListingContactPreview, SampleListingDisclosure } from "../components/listing-contact-preview";
import { DetailReviewSummary, DetailStickyDock, type DetailSectionLink } from "../components/detail-sticky-dock";
import { ModernSelect } from "../components/modern-select";
import { FavoriteButton } from "../components/favorite-button";
import { ShareButton } from "../components/share-dialog";
import { CalendarIcon, PinIcon } from "../site-header";
import { VacationBookingHub } from "../components/vacation-booking-hub";
import { OnlineBookingBadge } from "../components/online-booking-badge";
import { canShowOnlineBookingBadge } from "../lib/online-booking-eligibility";
import { HomeDealDetailStatus } from "../components/home-deal-detail-status";
import { useLegacyAvailability } from "../components/use-legacy-availability";
import { useViiStayQuote } from "../components/use-vii-stay-quote";
import { useViiStayCalendar } from "../components/use-vii-stay-calendar";
import { vacationPartyForGuestCount } from "../lib/vacation-party";
import { legacyAvailabilitySourceFor } from "../lib/legacy-availability-sources";
import { ViewedItemTracker } from "../components/viewed-item-tracker";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { latinBusinessAlias, localizedBusinessList, localizedBusinessText } from "../i18n/localized-business-content";
import { publishedLastMinuteDeal } from "../data/last-minute-deals";
import { UnitDetailsDialog } from "../components/unit-details-dialog";
import { PropertyGallery } from "../components/property-gallery";
import { FloatingContactActions } from "../components/floating-contact-actions";
import { SearchAfterResults } from "../components/search-after-results";
import type { SupplierPlaceDetail } from "../data/supplier-place-detail";
import { trackBusinessEvent } from "../lib/analytics";
import { DirectPhoneLink } from "../components/direct-phone-link";
import { Accessibility, Bath, BedDouble, Check, CircleParking, CookingPot, Eye, Gamepad2, Sparkles, Trees, Waves } from "lucide-react";

function bedroomLabel(count: number) {
  return count === 1 ? "חדר שינה אחד" : `${count} חדרי שינה`;
}

function highlightIconFor(label: string): ListingHighlightIcon {
  if (/בריכ/.test(label)) return "pool";
  if (/ג׳קוזי|ג'קוזי|סאונה|ספא/.test(label)) return "spa";
  if (/משחק|סנוקר|פינג פונג|קריוקי/.test(label)) return "games";
  if (/חצר|גינה|מדשא|מרפסת/.test(label)) return "garden";
  if (/מטבח|מטבחון/.test(label)) return "kitchen";
  if (/נוף|ים/.test(label)) return "view";
  if (/חניה/.test(label)) return "parking";
  if (/נגיש/.test(label)) return "accessibility";
  if (/אירוע/.test(label)) return "events";
  if (/יחיד|סוויט|חדר/.test(label)) return "units";
  return "default";
}

function derivedFeatureGroups(features: string[]): ListingFeatureGroup[] {
  const groups: ListingFeatureGroup[] = [
    { title: "מתחם חיצוני", items: features.filter((item) => /בריכ|ג׳קוזי|ג'קוזי|סאונה|חצר|גינה|מדשא|מרפסת|מנגל/.test(item)) },
    { title: "מתחם פנימי", items: features.filter((item) => /מטבח|מטבחון|סלון|מיזוג|טלוויז|מסך|חדר רחצה/.test(item)) },
  ];
  const assigned = new Set(groups.flatMap((group) => group.items));
  const general = features.filter((item) => !assigned.has(item));
  return [...(general.length ? [{ title: "כללי", items: general }] : []), ...groups.filter((group) => group.items.length)];
}

type DisplayFeatureGroup = { title: string; items: string[] };

function balanceFeatureGroups(groups: DisplayFeatureGroup[]): [DisplayFeatureGroup[], DisplayFeatureGroup[]] {
  const columns: [DisplayFeatureGroup[], DisplayFeatureGroup[]] = [[], []];
  const height = [0, 0];
  for (const group of groups) {
    const column = height[0] <= height[1] ? 0 : 1;
    columns[column].push(group);
    height[column] += 1 + Math.ceil(group.items.length / 2);
  }
  return columns;
}

function PropertyHighlightIcon({ icon }: { icon: ListingHighlightIcon }) {
  const Icon = icon === "pool" ? Waves
    : icon === "spa" ? Bath
    : icon === "games" ? Gamepad2
    : icon === "garden" ? Trees
    : icon === "kitchen" ? CookingPot
    : icon === "view" ? Eye
    : icon === "parking" ? CircleParking
    : icon === "accessibility" ? Accessibility
    : icon === "events" ? Sparkles
    : icon === "units" ? BedDouble
    : Check;
  return <span className={`property-highlight-icon property-highlight-icon--${icon}`} aria-hidden="true"><Icon strokeWidth={1.9} /></span>;
}

const worldLabels: Record<BusinessWorld, string> = {
  vacation: "נופש ולינה",
  events: "אירועים",
  hourly: "שהייה לפי שעה",
  spa: "ספא",
};

function formatInitialStay(from: string | undefined, till: string | undefined, language: SiteLanguage) {
  if (!from || !till) return "בחרו תאריכים";
  const arrival = new Date(`${from}T12:00:00`);
  const departure = new Date(`${till}T12:00:00`);
  if (Number.isNaN(arrival.getTime()) || Number.isNaN(departure.getTime())) return "בחרו תאריכים";
  const locale: Record<SiteLanguage, string> = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" };
  const separator: Record<SiteLanguage, string> = { he: " עד ", en: " to ", ru: " – ", fr: " au " };
  const format = new Intl.DateTimeFormat(locale[language], { day: "numeric", month: "numeric" });
  return `${format.format(arrival)}${separator[language]}${format.format(departure)}`;
}

function demoAvailabilityForDate(date: Date) {
  const today = currentSiteDay();
  if (date < today) return { kind: "past" as const, units: 0, label: "תאריך שעבר" };
  const epochDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const open = Math.floor(epochDay / 2) % 2 === 0;
  return open
    ? { kind: "open" as const, units: 1, label: "פנוי" }
    : { kind: "busy" as const, units: 0, label: "תפוס" };
}

function demoNightlyPrice(from: string, weekday: number, weekend: number) {
  const date = new Date(`${from}T12:00:00`);
  return date.getDay() === 4 || date.getDay() === 5 ? weekend : weekday;
}

function roomBookingHref(bookingQuery: string, index: number, nightlyPrice: number) {
  const params = new URLSearchParams(bookingQuery);
  params.set("unitIndex", String(index + 1));
  params.set("price", String(nightlyPrice));
  return `/booking?${params.toString()}`;
}

function comparableSleepingTitle(value: string) {
  return value.trim().replace(/[?؟]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("he");
}

function isVerifiedBedroomGroup(title: string) {
  const normalized = comparableSleepingTitle(title);
  return /^חדר שינה(?:\s+\d+)?$/.test(normalized)
    || /^bedroom(?:\s+\d+)?$/.test(normalized)
    || /^chambre(?:\s+\d+)?$/.test(normalized)
    || /^спальня(?:\s+\d+)?$/.test(normalized);
}
export default function BusinessPage({ initialProperty, relatedProperties, trailInventory = [], complementaryInventory = [], providerInventory = [], faqItems, supplierDetail, initialWorld = "vacation", initialDates, initialFrom, initialTill, initialGuests = "2", initialRooms, initialChildren, initialInfants, initialRoomID, initialPrice, initialIllustrative = false, initialSource, initialPeriod }: { initialSlug: string; initialProperty: Property; relatedProperties: Property[]; trailInventory?: Trail[]; complementaryInventory?: DiscoveryItem[]; providerInventory?: DiscoveryItem[]; faqItems: Array<{ question: string; answer: string }>; supplierDetail?: SupplierPlaceDetail; initialWorld?: BusinessWorld; initialDates?: string; initialFrom?: string; initialTill?: string; initialGuests?: string; initialRooms?: string; initialChildren?: string; initialInfants?: string; initialRoomID?: string; initialPrice?: string; initialIllustrative?: boolean; initialSource?: string; initialPeriod?: string }) {
  const { language, translate } = useSiteLanguage();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dates, setDates] = useState(initialDates || "");
  const displayDates = dates || formatInitialStay(initialFrom, initialTill, language);
  const [dateRange, setDateRange] = useState({ from: initialFrom || "", till: initialTill || "" });
  const [guests, setGuests] = useState(Math.max(1, Number(initialGuests) || 2));
  const [selectedPrice, setSelectedPrice] = useState(initialPrice || "");
  const { galleryOpen, galleryStart, galleryTab, openGallery, closeGallery, updateGallerySelection } = useGalleryDeepLink();
  const [galleryTopic, setGalleryTopic] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [allFeaturesOpen, setAllFeaturesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState<number | null>(null);
  const closeUnitDetails = useCallback(() => setSelectedRoomIndex(null), []);
  const property = useMemo<Property>(() => {
    const base = initialProperty;
    return supplierDetail ? { ...base, name: supplierDetail.name || base.name, image: supplierDetail.images[0] || base.image,
      images: supplierDetail.images.length ? supplierDetail.images : base.images, location: supplierDetail.location || base.location, area: supplierDetail.area || base.area,
      lat: supplierDetail.lat ?? base.lat, lng: supplierDetail.lng ?? base.lng, guests: supplierDetail.guests || base.guests,
      units: supplierDetail.units || base.units, contact: { ...base.contact, ...(supplierDetail.phone ? { phone: supplierDetail.phone } : {}), whatsapp: supplierDetail.whatsapp },
      galleryGroups: supplierDetail.galleryGroups?.length ? supplierDetail.galleryGroups : base.galleryGroups,
      description: supplierDetail.summary || base.description,
      roomOptions: supplierDetail.rooms.length ? supplierDetail.rooms.map((room) => ({ name: room.name, quantity: room.quantity, guests: room.guests,
        maxAdults: room.maxAdults, maxKids: room.maxKids, showKidsAndAdults: room.showKidsAndAdults, basisGuests: room.basisGuests, roomType: room.roomType,
        bedrooms: room.bedrooms, area: room.area, image: room.images?.[0] || "", images: room.images || [], features: room.features,
        featureGroups: room.featureGroups,
        ...(room.id ? { supplierRoomID: room.id } : {}) })) : base.roomOptions,
      featureGroups: supplierDetail.featureGroups?.length ? supplierDetail.featureGroups : base.featureGroups,
      features: [...new Set([...(supplierDetail.highlights || []), ...(supplierDetail.features || []), ...base.features, ...supplierDetail.rooms.flatMap((room) => room.features)])] } : base;
  }, [initialProperty, supplierDetail]);
  const businessCopy = {
    he: { name: "מקום אירוח מאומת", location: "ישראל", description: (name: string, location: string) => `${name} הוא מקום אירוח ב${location}. בעמוד תוכלו לראות תמונות, מתקנים, יחידות, זמינות ודרכי הזמנה.`, unit: "יחידת אירוח", feature: "מתקן במקום", faqQuestion: "מידע חשוב על המקום", faqAnswer: "הפרטים העדכניים, הזמינות ותנאי ההזמנה מאושרים מול המקום.", policy: "תנאי הביטול והשינויים נמסרים לפני אישור ההזמנה והתשלום.", checkIn: "כניסה", checkOut: "עזיבה", checkOutSat: "עזיבה בשבת", confirmHours: "יש לאשר את השעות מול המקום.", locationTitle: (name: string, location: string, area: string) => `המיקום של ${name} ב${location}, ${area}`, endcap: "אפשר להשוות מקומות נוספים באזור, לבחור מסלול לטיול או למצוא שירות שמגיע עד מקום האירוח.", moreArea: "עוד מקומות באזור" },
    en: { name: "Verified stay", location: "Israel", description: (name: string, location: string) => `${name} is a verified stay in ${location}. Explore its photos, amenities, units, availability and booking options on this page.`, unit: "Accommodation unit", feature: "Property amenity", faqQuestion: "Important property information", faqAnswer: "Current details, availability and booking terms are confirmed directly with the property.", policy: "Cancellation and change terms are provided before the booking and payment are confirmed.", checkIn: "Check-in", checkOut: "Check-out", checkOutSat: "Saturday check-out", confirmHours: "Please confirm the hours with the property.", locationTitle: (name: string, location: string, area: string) => `Location of ${name} in ${location}, ${area}`, endcap: "Compare more stays nearby, choose a walking route or find a service that comes directly to your accommodation.", moreArea: "More stays in" },
    ru: { name: "Проверенное размещение", location: "Израиль", description: (name: string, location: string) => `${name} — проверенный вариант размещения в регионе ${location}. Здесь собраны фотографии, удобства, варианты проживания, наличие и способы бронирования.`, unit: "Вариант размещения", feature: "Удобство объекта", faqQuestion: "Важная информация об объекте", faqAnswer: "Актуальные сведения, наличие и условия бронирования подтверждаются непосредственно объектом.", policy: "Условия отмены и изменений сообщаются до подтверждения бронирования и оплаты.", checkIn: "Заезд", checkOut: "Выезд", checkOutSat: "Выезд в субботу", confirmHours: "Подтвердите время непосредственно у объекта.", locationTitle: (name: string, location: string, area: string) => `Расположение ${name}: ${location}, ${area}`, endcap: "Сравните другие варианты поблизости, выберите маршрут для прогулки или найдите услугу с выездом к месту проживания.", moreArea: "Другие варианты в регионе" },
    fr: { name: "Hébergement vérifié", location: "Israël", description: (name: string, location: string) => `${name} est un hébergement vérifié situé en ${location}. Consultez les photos, les équipements, les unités, les disponibilités et les options de réservation.`, unit: "Unité d’hébergement", feature: "Équipement sur place", faqQuestion: "Informations importantes sur l’établissement", faqAnswer: "Les informations, les disponibilités et les conditions de réservation sont confirmées directement avec l’établissement.", policy: "Les conditions d’annulation et de modification sont communiquées avant la confirmation et le paiement.", checkIn: "Arrivée", checkOut: "Départ", checkOutSat: "Départ le samedi", confirmHours: "Veuillez confirmer les horaires auprès de l’établissement.", locationTitle: (name: string, location: string, area: string) => `Emplacement de ${name} à ${location}, ${area}`, endcap: "Comparez d’autres hébergements à proximité, choisissez un itinéraire de promenade ou trouvez un service qui se déplace jusqu’à votre hébergement.", moreArea: "Autres hébergements dans la région" },
  }[language];
  const safeBusinessText = (value: string | undefined | null, fallback: string) => localizedBusinessText(value, language, translate, fallback);
  const localizedPropertyName = safeBusinessText(property.name, property.name);
  const localizedArea = safeBusinessText(property.area, businessCopy.location);
  const localizedLocation = safeBusinessText(property.location, localizedArea);
  const localizedDescription = safeBusinessText(property.description, businessCopy.description(localizedPropertyName, localizedLocation));
  const localizedMapProperty: Property = { ...property, name: localizedPropertyName, location: localizedLocation, area: localizedArea, description: localizedDescription };
  const localizedGalleryProperty: Property = {
    ...localizedMapProperty,
    roomOptions: property.roomOptions?.map((room, index) => ({ ...room, name: safeBusinessText(room.name, `${businessCopy.unit} ${index + 1}`) })),
    sleepingArrangements: property.sleepingArrangements?.map((room, index) => ({ ...room, name: safeBusinessText(room.name, `${businessCopy.unit} ${index + 1}`) })),
  };
  const localizeRelatedProperty = (item: Property): Property => ({
    ...item,
    name: safeBusinessText(item.name, latinBusinessAlias(item.name) || businessCopy.name),
    location: safeBusinessText(item.location, businessCopy.location),
    area: safeBusinessText(item.area, businessCopy.location),
    description: safeBusinessText(item.description, businessCopy.description(latinBusinessAlias(item.name) || businessCopy.name, businessCopy.location)),
    type: safeBusinessText(item.type, businessCopy.name),
    features: localizedBusinessList(item.features, language, translate),
    highlights: item.highlights?.map((highlight) => ({ ...highlight, label: safeBusinessText(highlight.label, businessCopy.feature) })),
  });
  useEffect(() => { trackBusinessEvent("page_view", { placeId: property.slug, placeName: property.name, world: initialWorld }); }, [initialWorld, property.name, property.slug]);
  const offerings = useMemo(() => getListingOfferings(property), [property]);
  const [worldSelection, setWorldSelection] = useState<{ slug: string; world: BusinessWorld } | null>(null);
  const initialActiveWorld = offerings.some((offering) => offering.world === initialWorld) ? initialWorld : offerings[0].world;
  const activeWorld = worldSelection?.slug === property.slug
    && offerings.some((offering) => offering.world === worldSelection.world)
    ? worldSelection.world
    : initialActiveWorld;
  const activeOffering = offerings.find((offering) => offering.world === activeWorld) || offerings[0];
  const hasSelectedDates = Boolean(dateRange.from && dateRange.till);
  const selectedStay = hasSelectedDates ? { from: dateRange.from, till: dateRange.till, guests } : null;
  const supplierSiteID = /^vacation-(\d+)$/.exec(property.slug)?.[1];
  const siteToday = currentSiteDay();
  const calendarFrom = `${siteToday.getFullYear()}-${String(siteToday.getMonth() + 1).padStart(2, "0")}-${String(siteToday.getDate()).padStart(2, "0")}`;
  const supplierCalendar = useViiStayCalendar(supplierSiteID ? Number(supplierSiteID) : null, calendarOpen && activeWorld === "vacation", calendarFrom);
  const supplierRooms = useMemo(() => vacationPartyForGuestCount(guests, Number(initialChildren) || 0, Number(initialInfants) || 0, Number(initialRooms) || 1), [guests, initialChildren, initialInfants, initialRooms]);
  const preferredSupplierRoomID = Number.isSafeInteger(Number(initialRoomID)) && Number(initialRoomID) > 0
    && property.roomOptions?.some((room) => room.supplierRoomID === Number(initialRoomID)) ? Number(initialRoomID) : undefined;
  const supplierQuote = useViiStayQuote(supplierSiteID ? Number(supplierSiteID) : null, dateRange.from, dateRange.till, guests, supplierRooms, preferredSupplierRoomID);
  const liveLegacyAvailability = useLegacyAvailability(property, selectedStay);
  const verifiedLastMinuteDeal = activeWorld === "vacation" && selectedStay
    ? publishedLastMinuteDeal({ slug: property.slug, period: initialPeriod, from: selectedStay.from, till: selectedStay.till, guests, nightlyPrice: Number(selectedPrice) || 0 })
    : null;
  const resolvedAvailability = supplierSiteID ? supplierQuote.quote : verifiedLastMinuteDeal || liveLegacyAvailability.quote || resolveAvailabilityForStay(property, selectedStay, "/business", null);
  const usesLiveLegacyAvailability = Boolean(legacyAvailabilitySourceFor(property.slug));
  const vacationAvailabilityMode: "live" | "demo" | "inquiry" = supplierSiteID || usesLiveLegacyAvailability ? "live" : property.demoOperations?.fictional ? "demo" : "inquiry";
  const effectiveVacationAvailability = vacationAvailabilityMode !== "inquiry" ? resolvedAvailability : null;
  // A quote supplied in a link is useful only for properties without a live source.
  // For migrated listings the source response always wins, so an old shared link
  // cannot display a stale or manipulated amount as a current price.
  const resolvedSelectedPrice = effectiveVacationAvailability?.nightlyPrice
    ? String(effectiveVacationAvailability.nightlyPrice)
    : vacationAvailabilityMode === "demo" ? selectedPrice : "";
  const hasSelectedPrice = Boolean(resolvedSelectedPrice && Number(resolvedSelectedPrice) > 0);
  const verifiedSupplierRoomID = supplierQuote.roomIDs.length === 1 && property.roomOptions?.some((room) => room.supplierRoomID === supplierQuote.roomIDs[0]) ? supplierQuote.roomIDs[0] : undefined;
  const vacationOnlineReady = activeWorld === "vacation" && vacationAvailabilityMode !== "inquiry" && hasSelectedDates && effectiveVacationAvailability?.availability === "available" && hasSelectedPrice && (!supplierSiteID || supplierQuote.onlineBooking && supplierQuote.roomIDs.length === 1 && Boolean(verifiedSupplierRoomID));
  const onlineBookingEligible = canShowOnlineBookingBadge({
    ready: supplierQuote.status === "ready", onlineBooking: supplierQuote.onlineBooking,
    bookingSupported: vacationOnlineReady, availability: effectiveVacationAvailability?.availability,
    price: Number(resolvedSelectedPrice), from: effectiveVacationAvailability?.from, till: effectiveVacationAvailability?.till,
    selectedFrom: dateRange.from, selectedTill: dateRange.till,
    illustrative: Boolean(initialIllustrative || property.demoOperations?.fictional || effectiveVacationAvailability?.illustrative),
  });
  const vacationPhoneFallback = activeWorld === "vacation" && !vacationOnlineReady;
  const vacationRequest = activeWorld === "vacation" && !vacationOnlineReady;
  const onlineBooking = activeWorld === "vacation" ? vacationOnlineReady : activeOffering.bookingMode !== "call-only";
  const phoneBooking = activeOffering.bookingMode === "call-only" || activeOffering.bookingMode === "online-or-call";
  const phoneHref = property.contact?.phone ? `tel:${property.contact.phone.replace(/[^\d+]/g, "")}` : undefined;
  const bookingQuery = new URLSearchParams({ world: activeWorld, place: property.slug, ...(dateRange.from ? { from: dateRange.from } : {}), ...(dateRange.till ? { till: dateRange.till } : {}), guests: String(guests), ...(initialRooms ? { rooms: initialRooms } : {}), ...(initialChildren ? { children: initialChildren } : {}), ...(initialInfants ? { infants: initialInfants } : {}), ...(resolvedSelectedPrice ? { price: resolvedSelectedPrice } : {}), ...(supplierSiteID && supplierQuote.roomIDs.length === 1 ? { roomID: String(supplierQuote.roomIDs[0]) } : {}), ...(verifiedLastMinuteDeal ? { period: initialPeriod || "last-minute", source: initialSource || "last-minute" } : {}), ...(initialIllustrative || property.demoOperations?.fictional || effectiveVacationAvailability?.illustrative ? { illustrative: "1" } : {}) }).toString();
  const ownerWhatsapp = property.contact?.whatsapp;
  const bookingActionHref = vacationPhoneFallback ? "#booking-summary" : `/booking?${bookingQuery}`;
  const verifiedSleepingRooms = useMemo<VerifiedSleepingRoom[]>(() => (property.roomOptions || []).flatMap((room, roomIndex) =>
    (room.featureGroups || []).flatMap((group, groupIndex) => {
      if (!isVerifiedBedroomGroup(group.title) || !group.items.length) return [];
      const galleryGroup = property.galleryGroups?.find((gallery) => comparableSleepingTitle(gallery.title) === comparableSleepingTitle(group.title));
      return [{
        key: `${roomIndex}-${groupIndex}-${group.title}`,
        name: group.title,
        unitName: property.scenario === "multi" ? room.name : undefined,
        details: [...new Set(group.items)],
        galleryImage: galleryGroup?.images[0],
      }];
    })
  ), [property.galleryGroups, property.roomOptions, property.scenario]);
  const sectionLinks = useMemo<DetailSectionLink[]>(() => [
    { href: "#about", label: translate("על המקום") },
    ...(property.roomOptions?.length ? [{ href: "#rooms" as const, label: translate(property.scenario === "multi" ? "סוויטות ויחידות" : "מבנה המקום") }] : []),
    ...(verifiedSleepingRooms.length || property.bedrooms ? [{ href: "#sleeping" as const, label: translate("איפה ישנים") }] : []),
    { href: "#features", label: translate("מאפיינים") },
    ...(hasVerifiedAccessibilityFeature(property.features) ? [{ href: "#accessibility" as const, label: translate("נגישות") }] : []),
    { href: "#location", label: translate("מיקום") },
    { href: "#faq", label: translate("שאלות ותשובות") },
    { href: "#reviews", label: translate("חוות דעת") },
    { href: "#policies", label: translate("חשוב לדעת") },
  ], [property.bedrooms, property.features, property.roomOptions?.length, property.scenario, translate, verifiedSleepingRooms.length]);
  const roomQuantity = property.roomOptions?.reduce((total, room) => total + room.quantity, 0) || 0;
  const highlights = (property.highlights?.length ? property.highlights : property.features.map((label) => ({ label, icon: highlightIconFor(label) }))).slice(0, 5);
  const featureGroups = property.featureGroups?.length ? property.featureGroups : derivedFeatureGroups(property.features);
  const localizedFeatureGroups = featureGroups.flatMap((group) => {
    const items = localizedBusinessList(group.items, language, translate);
    return items.length ? [{ title: safeBusinessText(group.title, businessCopy.feature), items }] : [];
  });
  const desktopFeatureColumns = balanceFeatureGroups(localizedFeatureGroups);
  const mobileFeaturePreview = featureGroups.flatMap((group) => group.items).slice(0, 4);
  const placeGalleryImages = property.images;
  const complementSelection = useMemo(() => nearbyRecommendations(complementaryInventory.filter((item) => item.world === "spa" || item.world === "activities"), property, { key: (item) => `${item.world}:${item.id}` }), [complementaryInventory, property]);
  const complements = complementSelection.items;
  const localTrails = useMemo(() => nearbyTrails(property.area, property.location, 6, { inventory: trailInventory, lat: property.lat, lng: property.lng }), [trailInventory, property.area, property.location, property.lat, property.lng]);
  const nearbyCopy = nearbyRecommendationCopy[language];
  const regionalVacationLanding = useMemo(() => vacationBreadcrumbForLocation(property.area), [property.area]);
  const matchingProviders = useMemo(() => {
    const providers = providerInventory.filter((item) => item.world === "providers" && item.image);
    return [...providers.filter((item) => item.id === "masu-home-wellness"), ...providers.filter((item) => item.id !== "masu-home-wellness")].slice(0, 6);
  }, [providerInventory]);
  const unitCopy = {
    he: { available: "פנויה בתאריכים שבחרתם", unavailable: "לא פנויה בתאריכים שבחרתם", inquiry: "זמינות ומחיר באישור המקום", error: "לא הצלחנו לבדוק כרגע", combination: "פנויה כחלק מהשילוב המומלץ", tooSmall: "אינה מספיקה לבדה להרכב", quick: "הזמנה מהירה של", otherDate: "בדיקת תאריך אחר", enquire: "פנייה לבירור זמינות", retry: "בדיקה חוזרת", check: "בדיקת זמינות", dates: "בדיקת תאריכים ל", perNight: "ללילה", total: "לכל השהייה" },
    en: { available: "Available for your selected dates", unavailable: "Unavailable for your selected dates", inquiry: "Availability and price confirmed by the property", error: "We could not check right now", combination: "Available in the recommended combination", tooSmall: "Cannot host the whole party alone", quick: "Quick book", otherDate: "Check another date", enquire: "Enquire about availability", retry: "Try again", check: "Check availability for", dates: "Check dates for", perNight: "per night", total: "for the entire stay" },
    ru: { available: "Доступна на выбранные даты", unavailable: "Недоступна на выбранные даты", inquiry: "Наличие и цену подтвердит объект", error: "Не удалось проверить сейчас", combination: "Доступна в рекомендуемой комбинации", tooSmall: "Не вмещает всю группу", quick: "Быстро забронировать", otherDate: "Проверить другую дату", enquire: "Уточнить наличие", retry: "Повторить проверку", check: "Проверить доступность", dates: "Проверить даты для", perNight: "за ночь", total: "за всё проживание" },
    fr: { available: "Disponible aux dates choisies", unavailable: "Indisponible aux dates choisies", inquiry: "Disponibilité et prix confirmés par l’établissement", error: "Vérification impossible pour le moment", combination: "Disponible dans la combinaison recommandée", tooSmall: "Ne suffit pas seule pour le groupe", quick: "Réservation rapide", otherDate: "Vérifier une autre date", enquire: "Demander la disponibilité", retry: "Réessayer", check: "Vérifier la disponibilité de", dates: "Vérifier les dates pour", perNight: "par nuit", total: "pour tout le séjour" },
  }[language];
  const numberLocale = language === "he" ? "he-IL" : language === "en" ? "en-GB" : language === "ru" ? "ru-RU" : "fr-FR";

  function chooseWorld(world: BusinessWorld) {
    setWorldSelection({ slug: property.slug, world });
    const url = new URL(window.location.href);
    if (world === offerings[0].world) url.searchParams.delete("mode");
    else url.searchParams.set("mode", world);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <PageShell variant={activeWorld}>
      <main id="main-content" className="property-page">
        <ViewedItemTracker id={property.slug} world={activeWorld} name={property.name} location={`${property.location}, ${property.area}`} image={property.image} href={`/business?id=${property.slug}${activeWorld === offerings[0].world ? "" : `&mode=${activeWorld}`}`} meta={property.guests > 0 ? `${property.type} · עד ${property.guests} אורחים` : property.type} />
        <BreadcrumbTrail items={activeWorld === "events"
          ? [{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, ...eventBreadcrumbsForLocation(property.area, property.location), { name: localizedPropertyName }]
          : activeWorld === "spa"
            ? [{ name: "ראשי", path: "/" }, { name: "בתי ספא", path: "/spas" }, ...spaBreadcrumbsForLocation(property.area, property.location), { name: localizedPropertyName }]
            : activeWorld === "hourly"
              ? [{ name: "ראשי", path: "/" }, { name: "חדרים לפי שעה", path: "/hourly" }, ...hourlyBreadcrumbsForLocation(property.area, property.location), { name: localizedPropertyName }]
              : [{ name: "ראשי", path: "/" }, { name: "נופש", path: "/search" }, vacationBreadcrumbForLocation(property.area),
                ...(property.location && property.location !== property.area ? [{ name: `נופש ב${localizedLocation}`, path: `/search?location=${encodeURIComponent(property.location)}` }] : []),
                { name: localizedPropertyName }]} />

        <section className="shell property-title">
          <div><span className="eyebrow">{safeBusinessText(property.type, businessCopy.name)} · {safeBusinessText(activeOffering.label, translate(worldLabels[activeWorld]))}</span><h1>{localizedPropertyName}</h1><p><PinIcon />{localizedLocation}, {localizedArea}</p><OnlineBookingBadge eligible={onlineBookingEligible} />{property.demoOperations?.fictional ? <SampleListingDisclosure /> : null}</div>
          <div className="property-title__side">
            <div className="property-title__actions property-title__actions--contact">
              {property.demoOperations?.fictional && !vacationOnlineReady ? <ListingContactPreview placeName={property.name} className="listing-contact-preview--title" /> : null}
              {phoneHref ? <DirectPhoneLink phone={property.contact?.phone} placeName={localizedPropertyName} className="property-phone-action" tracking={{ placeId: property.slug, placeName: property.name, world: activeWorld, placement: "property_detail" }} /> : null}
              {ownerWhatsapp ? <WhatsAppLeadButton world={activeWorld} placeId={property.slug} placeName={property.name} businessPhone={ownerWhatsapp} serviceName={activeOffering.label} initialDate={dateRange.from} initialTill={dateRange.till} initialGuests={guests} buttonClassName="property-whatsapp-action" /> : null}
              <ShareButton title={property.name} image={property.image} />
            </div>
            {activeWorld === "vacation" ? null : onlineBooking ? <Link className="button primary" href={bookingActionHref}>הזמנה אונליין</Link> : property.contact?.phone ? <Link className="button primary" href="#booking-summary">טלפון להזמנה</Link> : null}
          </div>
        </section>

        {offerings.length > 1 ? <section className="shell multiworld-offerings" aria-labelledby="multiworld-title">
          <div><h2 id="multiworld-title">מה תרצו לעשות במקום?</h2><p>המידע על המקום נשאר זהה. הזמינות, המחיר ותהליך ההזמנה משתנים לפי הבחירה.</p></div>
          <div className="multiworld-offerings__options" role="group" aria-label="בחירת סוג הזמנה">
            {offerings.map((offering) => <button key={offering.world} type="button" aria-pressed={activeWorld === offering.world} className={activeWorld === offering.world ? "active" : ""} onClick={() => chooseWorld(offering.world)}><span>{translate(worldLabels[offering.world])}</span><strong>{translate(offering.label)}</strong><small>{translate(offering.summary)}</small></button>)}
          </div>
        </section> : null}

        <div className="shell property-gallery-wrap">
          <PropertyGallery images={placeGalleryImages} name={localizedPropertyName} onOpen={(index) => { setGalleryTopic(null); openGallery("all", index); }} />
          <FavoriteButton compact className="property-gallery__favorite" id={property.slug} world={activeWorld} name={localizedPropertyName} location={`${localizedLocation}, ${localizedArea}`} image={property.image} href={`/business?id=${property.slug}${activeWorld === offerings[0].world ? "" : `&mode=${activeWorld}`}`} meta={safeBusinessText(property.type, businessCopy.name)} />
        </div>
        <DetailReviewSummary
          className="shell detail-mobile-review-summary"
          rating={supplierDetail?.reviewScore ?? property.score}
          reviewCount={supplierDetail?.reviewCount ?? property.reviews}
          outOfTenLabel={translate("מתוך 10")}
          reviewsLabel={translate("חוות דעת")}
          numberLocale={numberLocale}
        />

        {property.demoOperations?.fictional && property.videos?.[0] ? <section className="shell palumbo-media-story" aria-labelledby="palumbo-media-title">
          <header><div><h2 id="palumbo-media-title">רואים את הווילה לפני שבוחרים</h2><p>סיור מלא, חדרים, חללים ותמונות אורחים במקום אחד.</p></div><button type="button" data-gallery-trigger className="button secondary" onClick={() => { setGalleryTopic(null); openGallery("all", 0); }}>פתיחת הגלריה המלאה</button></header>
          <div className="palumbo-media-story__grid">
            <article className="palumbo-media-story__video"><video controls playsInline preload="metadata" poster={property.videos[0].poster} aria-label={property.videos[0].title}><source src={property.videos[0].src} type="video/mp4" /></video><div><span>סיור בווידאו</span><h3>{property.videos[0].title}</h3><p>עוברים בין החללים ומכירים את מבנה הווילה לפני הבחירה.</p></div></article>
            <aside className="palumbo-media-story__guests"><div className="palumbo-media-story__guests-heading"><span className="eyebrow">גלריית אורחים</span><h3>רגעים מהאירוח</h3><p>תמונות אורחים מוצגות לאחר אימות ואישור לפרסום.</p></div><div>{property.guestPhotos?.map((photo) => <button type="button" data-gallery-trigger key={photo.src} onClick={() => openGallery("guests", 0)}><img src={photo.src} alt={photo.alt} title={photo.alt} /><span>{photo.author}</span></button>)}</div></aside>
          </div>
        </section> : null}

        <DetailStickyDock
          name={localizedPropertyName}
          sections={sectionLinks}
          onlineHref={activeWorld === "vacation" ? "#booking-summary" : onlineBooking || vacationPhoneFallback ? bookingActionHref : undefined}
          onlineLabel={activeWorld === "events" ? "בדיקת תאריך לאירוע" : activeWorld === "vacation" ? "בדיקת תאריך והזמנה" : "הזמנה אונליין"}
          phone={phoneBooking ? property.contact?.phone : undefined}
          rating={supplierDetail?.reviewScore ?? property.score}
          reviewCount={supplierDetail?.reviewCount ?? property.reviews}
          outOfTenLabel={translate("מתוך 10")}
          reviewsLabel={translate("חוות דעת")}
          numberLocale={numberLocale}
        />

        <div className={`shell property-layout ${activeWorld === "vacation" ? "property-layout--vacation" : ""}`}>
          <div className="property-content">
            <section id="about" className="property-about"><h2>{translate("על המקום")}</h2><p>{localizedDescription}</p><div className="feature-chips audience-chips">{localizedBusinessList(property.audiences, language, translate).map((audience) => <span key={audience}>{translate("מתאים ל")} {audience}</span>)}</div>{highlights.length ? <div className="property-highlights" aria-label={translate("הדברים הבולטים במקום")}>{highlights.flatMap((highlight) => { const label = safeBusinessText(highlight.label, ""); return label ? [<article key={highlight.label}><PropertyHighlightIcon icon={highlight.icon} /><strong>{label}</strong></article>] : []; })}</div> : null}</section>

            {activeWorld === "vacation" && (initialSource === "home-deals" || initialSource === "home-holidays") && /^vacation-\d+$/.test(property.slug) ? <HomeDealDetailStatus siteID={Number(property.slug.slice(9))} period={initialPeriod} source={initialSource} from={dateRange.from} till={dateRange.till} guests={guests} /> : null}

            {activeWorld === "vacation" && property.guests > 0 ? <VacationBookingHub
              property={property}
              dates={displayDates}
              from={dateRange.from}
              till={dateRange.till}
              guests={guests}
              selectedPrice={resolvedSelectedPrice}
              availability={effectiveVacationAvailability}
              availabilityStatus={supplierSiteID ? supplierQuote.status : vacationAvailabilityMode === "live" ? liveLegacyAvailability.status : vacationAvailabilityMode === "demo" ? "ready" : "idle"}
              availabilityMode={vacationAvailabilityMode}
              bookingEnabled={!supplierSiteID || supplierQuote.onlineBooking && Boolean(verifiedSupplierRoomID)}
              bookingHref={`/booking?${bookingQuery}`}
              ownerWhatsapp={ownerWhatsapp}
              phoneHref={phoneHref}
              illustrative={initialIllustrative || vacationAvailabilityMode === "demo" || Boolean(effectiveVacationAvailability?.illustrative)}
              onOpenCalendar={() => setCalendarOpen(true)}
              onGuestsChange={setGuests}
              onRetryAvailability={supplierSiteID ? supplierQuote.retry : liveLegacyAvailability.retry}
            /> : activeWorld === "vacation" ? <section id="booking-summary" className="property-about"><h2>בירור אירוח</h2><p>פרטי היחידות והקיבולת עדיין לא נמסרו. אפשר לפנות למקום לבירור.</p>{phoneHref ? <a className="button primary" href={phoneHref}>שיחה עם המקום</a> : null}</section> : null}

            {property.roomOptions?.length ? <section id="rooms" className="units-section" aria-labelledby="units-heading-title">
              <div className={`units-heading${property.scenario === "multi" ? " units-heading--overview" : ""}`}>
                <div>
                  <span className="eyebrow">פרטי הלינה במקום</span>
                  <h2 id="units-heading-title">{translate(property.scenario === "multi" ? "הסוויטות והיחידות" : "מבנה המקום")}</h2>
                </div>
                <span className="units-total">{property.scenario === "multi" ? (roomQuantity === 1 ? "יחידת אירוח אחת" : `${roomQuantity} יחידות אירוח`) : "המקום כולו עומד לרשותכם"}</span>
              </div>
              <div className="room-card-list">
                {property.roomOptions.map((room, roomIndex) => {
                  // A place sold as one whole property has one live quote. Its
                  // editorial room entry is descriptive, not a separately priced
                  // inventory unit, so it must reuse that quote.
                  const roomAvailability = supplierSiteID
                    ? supplierQuote.roomIDs?.includes(room.supplierRoomID || 0) ? effectiveVacationAvailability : undefined
                    : property.scenario === "single" && usesLiveLegacyAvailability
                    ? effectiveVacationAvailability
                    : effectiveVacationAvailability?.units?.find((unit) => unit.index === roomIndex);
                  const roomAvailable = roomAvailability?.availability === "available";
                  const roomUnavailable = roomAvailability?.availability === "unavailable";
                  const roomCapacity = roomAvailability && "maxGuests" in roomAvailability ? roomAvailability.maxGuests || room.guests : room.guests;
                  const roomFitsParty = guests <= roomCapacity;
                  const roomInRecommendation = Boolean(effectiveVacationAvailability?.recommendation?.items.some((item) => item.index === roomIndex));
                  const roomNightlyPrice = roomAvailability?.nightlyPrice || 0;
                  const roomTotalPrice = (roomAvailability && "totalPrice" in roomAvailability ? roomAvailability.totalPrice : undefined) || (roomNightlyPrice && dateRange.from && dateRange.till ? roomNightlyPrice * Math.max(1, Math.round((Date.parse(`${dateRange.till}T12:00:00`) - Date.parse(`${dateRange.from}T12:00:00`)) / 86_400_000)) : 0);
                  const minimumStayRestriction = effectiveVacationAvailability?.unavailableReason === "min_nights" && effectiveVacationAvailability.minimumNights
                    ? `נדרשים לפחות ${effectiveVacationAvailability.minimumNights} לילות. בחרו תאריך עזיבה מאוחר יותר`
                    : "";
                  const unitGalleryStart = property.roomOptions!.slice(0, roomIndex).reduce((total, option) => total + (option.images?.length || 1), 0);
                  const roomStatus = vacationAvailabilityMode === "inquiry"
                    ? unitCopy.inquiry
                    : supplierSiteID && supplierQuote.status === "loading"
                      ? "מעדכנים זמינות ומחיר"
                    : supplierSiteID && supplierQuote.status === "ready" && effectiveVacationAvailability?.availability === "available" && !roomAvailable
                      ? "ליחידה זו נדרשת בדיקת זמינות נפרדת"
                    : supplierSiteID && supplierQuote.status === "ready" && minimumStayRestriction
                      ? minimumStayRestriction
                    : supplierSiteID && supplierQuote.status === "ready" && !roomAvailable
                      ? "לא התקבל אישור זמינות ליחידה זו"
                    : (supplierSiteID ? supplierQuote.status : liveLegacyAvailability.status) === "error"
                      ? unitCopy.error
                      : roomAvailable && roomFitsParty
                        ? unitCopy.available
                        : roomAvailable && roomInRecommendation
                          ? unitCopy.combination
                          : roomAvailable
                            ? unitCopy.tooSmall
                            : roomUnavailable ? unitCopy.unavailable : unitCopy.error;
                  const canBookRoom = vacationAvailabilityMode === "live" && (supplierSiteID ? supplierQuote.status : liveLegacyAvailability.status) === "ready" && roomAvailable && roomFitsParty && roomNightlyPrice > 0 && (!supplierSiteID || supplierQuote.onlineBooking && Boolean(verifiedSupplierRoomID));
                  const localizedRoomName = safeBusinessText(room.name, `${businessCopy.unit} ${roomIndex + 1}`);
                  return <article className={`room-card${roomAvailable ? " room-card--available" : roomUnavailable ? " room-card--unavailable" : ""}${vacationAvailabilityMode === "inquiry" ? " room-card--inquiry" : ""}`} key={room.name}>
                  <div className="room-card__identity"><span>{safeBusinessText(property.type, businessCopy.name)}</span><h3>{localizedRoomName}</h3></div>
                  {room.image ? <button className="room-card__image" type="button" data-gallery-trigger onClick={() => { setGalleryTopic(room.name); openGallery("units", unitGalleryStart); }} aria-label={`${translate("פתיחת גלריית")} ${localizedRoomName}`}><img src={room.image} alt={`${localizedRoomName}, ${localizedPropertyName}`} title={`${localizedRoomName}, ${localizedPropertyName}`} width="960" height="640" loading="lazy" decoding="async" /><span>{room.images?.length ? `${room.images.length} ${translate("תמונות")}` : translate("תמונת היחידה")}</span></button> : <div className="room-card__image room-card__image--missing"><img src={property.image} alt={`${localizedPropertyName}, ${localizedRoomName}`} title={`${localizedPropertyName}, ${localizedRoomName}`} width="960" height="640" loading="lazy" decoding="async" /><span>{translate("תמונת המתחם, לא היחידה")}</span></div>}
                  <div className="room-card__body">
                    <div className="room-card__facts"><span>{translate(`עד ${room.guests} אורחים`)}</span>{room.bedrooms > 0 ? <span>{translate(bedroomLabel(room.bedrooms))}</span> : null}{room.area ? <span>{room.area} {translate("מ״ר")}</span> : null}<button className="room-card__more" type="button" onClick={() => setSelectedRoomIndex(roomIndex)}>{translate("פרטי היחידה")}</button></div>
                    {room.features?.length ? <div className="room-card__amenities" aria-label={translate("מתקנים ושירותים ביחידה")}>{localizedBusinessList(room.features, language, translate).map((feature) => <span key={feature}><PropertyHighlightIcon icon={highlightIconFor(feature)} /><b>{feature}</b></span>)}</div> : null}
                    {activeWorld === "vacation" && hasSelectedDates ? <div className="room-card__availability" role="status"><strong>{roomStatus}</strong>{vacationAvailabilityMode === "live" && roomNightlyPrice ? <span>{roomNightlyPrice.toLocaleString(numberLocale)} ₪ {unitCopy.perNight}{roomTotalPrice ? ` · ${roomTotalPrice.toLocaleString(numberLocale)} ₪ ${unitCopy.total}` : ""}</span> : null}</div> : null}
                    <div className="room-card__actions">{activeWorld === "vacation"
                      ? canBookRoom ? <Link className="button primary" href={supplierSiteID ? `/booking?${bookingQuery}` : roomBookingHref(bookingQuery, roomIndex, roomNightlyPrice)}>{unitCopy.quick} {safeBusinessText(room.name, `${businessCopy.unit} ${roomIndex + 1}`)}</Link>
                        : supplierSiteID && roomAvailable && roomFitsParty && roomNightlyPrice > 0 && phoneHref ? <a className="button primary" href={phoneHref}>הזמנה בטלפון</a>
                        : vacationAvailabilityMode === "inquiry" && ownerWhatsapp ? <WhatsAppLeadButton world="vacation" placeId={property.slug} placeName={property.name} businessPhone={ownerWhatsapp} serviceName={`${unitCopy.check} ${safeBusinessText(room.name, `${businessCopy.unit} ${roomIndex + 1}`)}`} initialDate={dateRange.from} initialTill={dateRange.till} initialGuests={guests} buttonLabel={unitCopy.enquire} buttonClassName="button primary" />
                          : vacationAvailabilityMode === "inquiry" && phoneHref ? <a className="button primary" href={phoneHref}>{unitCopy.enquire}</a>
                            : (supplierSiteID ? supplierQuote.status : liveLegacyAvailability.status) === "error" ? <button className="button secondary" type="button" onClick={supplierSiteID ? supplierQuote.retry : liveLegacyAvailability.retry}>{unitCopy.retry}</button>
                              : roomUnavailable ? <button className="button secondary" type="button" onClick={() => setCalendarOpen(true)}>{unitCopy.otherDate}</button>
                                : roomAvailable && !roomFitsParty && ownerWhatsapp ? <WhatsAppLeadButton world="vacation" placeId={property.slug} placeName={property.name} businessPhone={ownerWhatsapp} serviceName={`בדיקת שילוב יחידות עם ${safeBusinessText(room.name, `${businessCopy.unit} ${roomIndex + 1}`)}`} initialDate={dateRange.from} initialTill={dateRange.till} initialGuests={guests} buttonLabel="בדיקת שילוב יחידות" buttonClassName="button secondary" />
                                  : <button className="button secondary" type="button" onClick={() => setCalendarOpen(true)}>{hasSelectedDates ? `${unitCopy.check} ${safeBusinessText(room.name, `${businessCopy.unit} ${roomIndex + 1}`)}` : `${unitCopy.dates} ${safeBusinessText(room.name, `${businessCopy.unit} ${roomIndex + 1}`)}`}</button>
                      : onlineBooking ? <Link className="button primary" href={bookingActionHref}>הזמנה אונליין</Link> : phoneHref ? <Link className="button primary" href="#booking-summary">טלפון להזמנה</Link> : null}</div>
                  </div>
                </article>;
                })}
              </div>
            </section> : null}

            {verifiedSleepingRooms.length ? <VerifiedSleepingDetails placeName={localizedPropertyName} rooms={verifiedSleepingRooms} /> : property.sleepingArrangements?.length ? <SleepingArrangements placeName={property.name} arrangements={property.sleepingArrangements} /> : property.bedrooms ? <section id="sleeping" className="sleeping-summary" aria-labelledby="sleeping-summary-title"><span className="eyebrow">חדרי שינה אינם יחידות אירוח</span><h2 id="sleeping-summary-title">איפה ישנים?</h2><p>{property.scenario === "multi" ? `במתחם יש ${property.units || roomQuantity} יחידות אירוח ובהן ${property.bedrooms} חדרי שינה בסך הכול. פירוט השינה מופיע בתוך כל כרטיס יחידה.` : `במקום יש ${property.bedrooms} חדרי שינה. לפרטים על סוגי המיטות, בדקו מול המקום.`}</p></section> : null}

            <section id="features" className="feature-section">
              <span className="eyebrow">עיקרי המקום</span>
              <h2>מתקנים ושירותים</h2>
              <div className="feature-section__mobile-preview" aria-label="הדברים הבולטים במקום">
                {localizedBusinessList(mobileFeaturePreview, language, translate).map((feature) => <span key={feature}><PropertyHighlightIcon icon={highlightIconFor(feature)} /><b>{feature}</b></span>)}
              </div>
              <div className="property-feature-groups">{desktopFeatureColumns.map((column, columnIndex) => <div className="property-feature-groups__column" key={columnIndex}>{column.map((group) => <article key={group.title}><h3>{group.title}</h3><div className="feature-list">{group.items.map((feature) => <span key={feature}><PropertyHighlightIcon icon={highlightIconFor(feature)} /><b>{feature}</b></span>)}</div></article>)}</div>)}</div>
              <div className={`feature-section__mobile-details ${mobileFeaturesOpen ? "is-open" : ""}`}>
                <button className="feature-section__mobile-toggle" type="button" aria-expanded={mobileFeaturesOpen} aria-controls="mobile-feature-groups" onClick={() => setMobileFeaturesOpen((open) => !open)}>{mobileFeaturesOpen ? "הסתרת כל המתקנים" : "הצגת כל המתקנים"}</button>
                <div id="mobile-feature-groups" className="feature-section__mobile-groups" hidden={!mobileFeaturesOpen}>{featureGroups.map((group) => { const items = localizedBusinessList(group.items, language, translate); return items.length ? <section key={group.title}><h3>{safeBusinessText(group.title, businessCopy.feature)}</h3><div>{items.map((feature) => <span key={feature}><PropertyHighlightIcon icon={highlightIconFor(feature)} /><b>{feature}</b></span>)}</div></section> : null; })}</div>
              </div>
              <button className="button subtle feature-section__desktop-more" type="button" onClick={() => setAllFeaturesOpen(true)}>הצגת כל המתקנים</button>
            </section>

            <GuestReviewStudio placeName={localizedPropertyName} subjectId={property.slug} rating={supplierDetail?.reviewScore ?? property.score} reviewCount={supplierDetail?.reviewCount ?? property.reviews} publishedReviews={property.reviewHighlights} supplierReviews={supplierDetail?.reviews} illustrative={property.reviewSource === "fictional-demo"} open={reviewOpen} onClose={() => setReviewOpen(false)} onOpenGallery={() => { setGalleryTopic(null); openGallery("guests", 0); }} />

            <ListingAccessibility slug={property.slug} features={property.features} />

            <section id="location" className="location-card location-card--map-only" aria-labelledby="property-location-title"><h2 id="property-location-title" className="sr-only">{businessCopy.locationTitle(localizedPropertyName, localizedLocation, localizedArea)}</h2>{typeof property.lat === "number" && typeof property.lng === "number" ? <ListingMap listings={[localizedMapProperty]} single /> : <p>{safeBusinessText("המיקום המדויק טרם נמסר על ידי המקום.", businessCopy.locationTitle(localizedPropertyName, localizedLocation, localizedArea))}</p>}</section>

            <section id="faq" className="faq-section"><h2>{translate("שאלות ותשובות")}</h2>{faqItems.map((item, index) => <article key={item.question} className={openFaq === index ? "open" : ""}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{safeBusinessText(item.question, businessCopy.faqQuestion)}</span><b>{openFaq === index ? "−" : "+"}</b></button>{openFaq === index && <p>{safeBusinessText(item.answer, businessCopy.faqAnswer)}</p>}</article>)}</section>

            <section id="policies" className="policies-section"><h2>{translate("כללים ותנאי הזמנה")}</h2><div><article><b>{translate("צ׳ק-אין וצ׳ק-אאוט")}</b><p>{supplierDetail?.policy.checkIn ? `${businessCopy.checkIn}: ${supplierDetail.policy.checkIn.slice(0, 5)}` : translate("שעת הכניסה נקבעת באישור ההזמנה")}{supplierDetail?.policy.checkOut ? ` · ${businessCopy.checkOut}: ${supplierDetail.policy.checkOut.slice(0, 5)}` : ""}{supplierDetail?.policy.checkOutSat ? ` · ${businessCopy.checkOutSat}: ${supplierDetail.policy.checkOutSat.slice(0, 5)}` : ""}. {businessCopy.confirmHours}</p></article><article><b>{translate("מחיר ותשלום")}</b><p>{translate("המחיר הסופי תלוי בתאריכים, בהרכב וביחידה שנבחרה.")}</p></article><article><b>{translate("ביטול ושינויים")}</b><p>{safeBusinessText(supplierDetail?.policy.remarks || "תנאי הביטול נמסרים לפני אישור ההזמנה והתשלום.", businessCopy.policy)}</p></article></div></section>
            {property.demoOperations?.fictional ? <section className="palumbo-practical" aria-labelledby="palumbo-practical-title"><h2 id="palumbo-practical-title">כל מה שצריך לדעת לפני ההזמנה</h2><div><article><strong>15:00</strong><span>כניסה החל משעה זו</span></article><article><strong>11:00</strong><span>עזיבה עד שעה זו</span></article><article><strong>2 לילות</strong><span>מינימום להזמנה</span></article><article><strong>8 אורחים</strong><span>תפוסה מרבית</span></article></div></section> : null}
          </div>

        {activeWorld === "vacation" ? null : !onlineBooking && phoneHref ? <aside className="booking-card booking-card--phone"><span className="eyebrow">הזמנה בטלפון</span><h2>מדברים ישירות עם המקום</h2><p>הצוות בודק את התאריך, ההרכב והמחיר בשיחה אחת.</p><a className="button primary wide" href={phoneHref}>חיוג להזמנה</a><small>ההזמנה סופית רק לאחר אישור המקום.</small></aside> : activeWorld === "events" ? <aside className="booking-card booking-card--event"><span className="eyebrow">הזמנת אירוע</span><h2>בוחרים תאריך והרכב</h2><label>תאריך האירוע<input type="date" /></label><label>כמות משתתפים<input type="number" min="1" max={activeOffering.maxGuests} placeholder="כמה משתתפים צפויים?" /></label>{activeOffering.eventTypes?.length ? <ModernSelect label="סוג האירוע" defaultValue={activeOffering.eventTypes[0]} options={activeOffering.eventTypes.map((eventType) => ({ value: eventType, label: eventType }))} /> : null}<div className="booking-facts"><span>ההזמנה נבדקת לפי סוג האירוע</span><span>האירוח והאירוע מנוהלים בנפרד</span></div><div className="booking-card__actions"><Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה אונליין</Link>{phoneBooking && phoneHref ? <a className="button secondary wide" href={phoneHref}>או חיוג למקום</a> : null}</div><small>הזמינות, המחיר וכללי המקום לאירוע מאושרים לפני חיוב.</small></aside> : <aside id="booking-summary" className={`booking-card ${vacationRequest ? "booking-card--request" : "booking-card--instant"}`}><span className="eyebrow">{vacationRequest ? "בדיקת זמינות במתחם" : "הזמנה אונליין"}</span><h2>{vacationRequest ? hasSelectedDates ? "בודקים את החופשה שבחרתם" : "מתי תרצו להתארח?" : property.scenario === "single" ? "סיכום השהייה" : "תאריכים והרכב"}</h2><p className="booking-card__lead">{vacationRequest ? hasSelectedDates ? "התאריכים והרכב האורחים נשמרו מהחיפוש. אפשר לשנות אותם או לשלוח בקשת זמינות מסודרת." : "בחרו תאריכים וכמות אורחים. לאחר הבחירה תוכלו לשלוח למקום בקשת זמינות מסודרת." : "בחרו תאריכים לבדיקת מחיר וזמינות."}</p><div className="booking-card__selection"><button type="button" className="date-choice" onClick={() => setCalendarOpen(true)}><CalendarIcon /><span><small>תאריכי השהייה</small><strong>{displayDates}</strong></span></button></div><label className="booking-guests">כמות אורחים<input type="number" min="1" max={activeOffering.maxGuests || property.guests} value={guests} onChange={(event) => setGuests(Math.max(1, Number(event.target.value) || 1))} /></label><div className="booking-facts"><span>עד {activeOffering.maxGuests || property.guests} אורחים</span>{property.bedrooms && <span>{property.bedrooms} חדרי שינה</span>}</div><div className="booking-card__actions"><Link className="button primary wide" href={`/booking?${bookingQuery}`}>המשך להזמנה</Link></div></aside>}
        </div>

        <section className="section property-complements">
          <div className="shell">
            <section className="property-provider-strip" aria-labelledby="matching-providers-title"><div className="section-head"><div><h2 id="matching-providers-title">{translate("ספקים שמגיעים אליכם")}</h2></div><Link href="/providers">{translate("לכל הספקים")}</Link></div><HomeMobileRail shufflePlaces id="vacation-detail-providers" label={translate("ספקים שמגיעים אליכם")} className="property-provider-strip__rail">{matchingProviders.map((item) => <DiscoveryCard key={item.id} item={item} />)}</HomeMobileRail></section>
            <div className="property-complements__intro">
              <div className="section-head">
                <div><h2>{translate("מה יש בסביבה של")} {localizedPropertyName}?</h2></div>
                <span className="section-head__links property-complements__nav"><Link href="/trails"><b aria-hidden="true">↗</b> מסלולי טיול</Link><Link href="/attractions"><b aria-hidden="true">✦</b> אטרקציות</Link></span>
              </div>
              <p className="property-complements__note">{complementSelection.expanded ? `${nearbyCopy.expanded} ` : ""}{complementSelection.regionalOnly ? nearbyCopy.regional : nearbyCopy.places}</p>
            </div>
            {complements.length ? <HomeMobileRail shufflePlaces id="vacation-detail-nearby" label={translate("מקומות נוספים בסביבה")} className="discovery-grid discovery-grid--compact">{complements.map((item) => <DiscoveryCard key={`${item.world}-${item.id}`} item={item} />)}</HomeMobileRail> : <p>לא נמצאו כרגע מקומות עם מיקום מתאים שאפשר לאמת בסביבה הקרובה.</p>}
            {localTrails.length ? <div className="property-nearby-trails"><div className="section-head"><div><h2>{translate("מסלולים באזור")}</h2><p>{nearbyCopy.trails}</p></div><Link href="/trails">{translate("לכל המסלולים")}</Link></div><HomeMobileRail shufflePlaces id="vacation-detail-trails" label={translate("מסלולים באזור")} className="trail-grid trail-grid--business">{localTrails.map((trail) => <TrailCard key={trail.slug} trail={trail} compact />)}</HomeMobileRail></div> : null}
          </div>
        </section>

        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים שיכולים להתאים</h2></div><HomeMobileRail shufflePlaces id="vacation-detail-similar" label="מקומות נוספים שיכולים להתאים" className="card-grid">{relatedProperties.filter((item) => item.slug !== property.slug).slice(0, 3).map((item) => <PropertyCard key={item.slug} property={localizeRelatedProperty(item)} promotional />)}</HomeMobileRail></div></section>

        <section className="property-page-endcap" aria-labelledby="property-endcap-title">
          <div className="shell property-page-endcap__inner">
            <div className="property-page-endcap__intro"><h2 id="property-endcap-title">{translate("עוד דרכים ליהנות באזור")} {localizedLocation}</h2><p>{businessCopy.endcap}</p></div>
            <nav className="property-page-endcap__links" aria-label="המשך תכנון החופשה">
              <Link href={regionalVacationLanding.path}><span aria-hidden="true">⌂</span><strong>{businessCopy.moreArea} {localizedArea}</strong><small>להשוואת מקומות ואפשרויות אירוח</small></Link>
              <Link href="/trails"><span aria-hidden="true">↗</span><strong>מסלולים באזור</strong><small>לבחירת טיול שמתאים ליום שלכם</small></Link>
              <Link href="/providers"><span aria-hidden="true">✦</span><strong>ספקים שמגיעים אליכם</strong><small>טיפולים, אוכל וחוויות במקום האירוח</small></Link>
            </nav>
          </div>
        </section>
        {(activeWorld === "vacation" || activeWorld === "events" || activeWorld === "hourly") ? <FloatingContactActions world={activeWorld} placeId={property.slug} placeName={property.name} phone={property.contact?.phone} whatsapp={ownerWhatsapp} serviceName={activeOffering.label} from={dateRange.from} till={dateRange.till} guests={guests} /> : null}
        <SearchAfterResults world={activeWorld} discoveryOnly location={property.location} inventory={[property, ...(relatedProperties || [])].map(entry => ({ location: entry.location, area: entry.area, type: entry.type }))} />
      </main>

      <CalendarDemo mode="business" businessKind={property.scenario} businessName={property.name} open={calendarOpen && activeWorld === "vacation"} onClose={() => setCalendarOpen(false)} guests={guests} maxGuests={activeOffering.maxGuests || property.guests} onGuestsChange={setGuests}
        liveCalendar={supplierCalendar.calendar} calendarRequired={Boolean(supplierSiteID)} calendarStatus={supplierCalendar.status} onRetryCalendar={supplierCalendar.retry} illustrative={Boolean(property.demoOperations?.fictional)}
        availabilityResolver={property.demoOperations?.fictional ? demoAvailabilityForDate : undefined} priceResolver={property.demoOperations?.fictional ? (date) => demoNightlyPrice(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`, property.demoOperations!.weekdayNightlyPrice, property.demoOperations!.weekendNightlyPrice) : undefined} onConfirm={(result) => { const from = result.checkIn || ""; setDates(result.summary); setDateRange({ from, till: result.checkOut || "" }); setSelectedPrice(property.demoOperations?.fictional && from ? String(demoNightlyPrice(from, property.demoOperations.weekdayNightlyPrice, property.demoOperations.weekendNightlyPrice)) : ""); }} />

      <GalleryExperience key={`${property.slug}-${galleryOpen ? `${galleryTab}-${galleryStart}-${galleryTopic || "all"}` : "closed"}`} property={localizedGalleryProperty} guestPhotos={property.guestPhotos} open={galleryOpen} initialIndex={galleryStart} initialTab={galleryTab} initialTopic={galleryTopic} onAddGuestContent={() => { closeGallery(); setReviewOpen(true); }} onSelectionChange={updateGallerySelection} onClose={closeGallery} />
      <UnitDetailsDialog propertyName={property.name} room={selectedRoomIndex === null ? null : property.roomOptions?.[selectedRoomIndex] || null} open={selectedRoomIndex !== null} onClose={closeUnitDetails} onOpenGallery={() => { if (selectedRoomIndex === null || !property.roomOptions) return; const room = property.roomOptions[selectedRoomIndex]; const start = property.roomOptions.slice(0, selectedRoomIndex).reduce((total, option) => total + (option.images?.length || 1), 0); setGalleryTopic(room.name); closeUnitDetails(); window.setTimeout(() => openGallery("units", start), 0); }} />

      {allFeaturesOpen && <div className="simple-modal" onMouseDown={(event) => event.target === event.currentTarget && setAllFeaturesOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="features-title"><header><h2 id="features-title">המתקנים של {property.name}</h2><button type="button" onClick={() => setAllFeaturesOpen(false)}>סגירה</button></header><div className="modal-feature-groups">{featureGroups.map((group) => <section key={group.title}><h3>{group.title}</h3><div className="feature-list modal-features">{group.items.map((feature) => <span key={feature}><PropertyHighlightIcon icon={highlightIconFor(feature)} /><b>{feature}</b></span>)}</div></section>)}</div></section></div>}
    </PageShell>
  );
}
