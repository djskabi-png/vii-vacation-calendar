"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { boundedSliderIndex, SliderRailControls } from "./slider-rail-controls";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { ListingAvailability, ListingDateQuote, Property } from "../data/site-data";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { PinIcon } from "../site-header";
import { trackBusinessEvent, trackPhoneReveal } from "../lib/analytics";
import { FavoriteButton } from "./favorite-button";
import { WhatsAppLeadButton } from "./whatsapp-lead-button";
import { ListingContactPreview, SampleListingDisclosure } from "./listing-contact-preview";
import { type LegacyAvailabilityState, useLegacyAvailability } from "./use-legacy-availability";
import { legacyAvailabilitySourceFor } from "../lib/legacy-availability-sources";
import { latinBusinessAlias, localizedBusinessList, localizedBusinessText } from "../i18n/localized-business-content";

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 1.1 3.7 2 2 0 0 1 3.1 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L7.1 9.5a16 16 0 0 0 7.4 7.4l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></svg>;
}

const cardCopy: Record<SiteLanguage, { call: string; whatsapp: string; reviews: string; outOfTen: string; details: string; quickBook: string; searchedDates: string; noDates: string; from: string; night: string; stayTotal: string; nightlyAverage: string; to: string; inquirePrice: string; checking: string; unavailableSource: string; includedGuests: (count: number) => string; minimumNights: (count: number) => string; availability: Record<ListingAvailability, string> }> = {
  he: { call: "טלפון", whatsapp: "פנייה בוואטסאפ", reviews: "חוות דעת", outOfTen: "מתוך 10", details: "לפרטים", quickBook: "הזמנה מהירה", searchedDates: "התאריכים שחיפשת", noDates: "לא נבחרו תאריכים", from: "החל מ־", night: "ללילה", stayTotal: "לכל השהייה", nightlyAverage: "ממוצע ללילה", to: "עד", inquirePrice: "פנו למקום לקבלת הצעת מחיר", checking: "בודקים זמינות ומחיר מול מערכת המקום", unavailableSource: "לא הצלחנו לאמת זמינות ומחיר כרגע", includedGuests: (count) => `בסיס המחיר: ${count} אורחים`, minimumNights: (count) => `נדרשים לפחות ${count} לילות`, availability: { available: "פנוי בתאריכים שבחרת", unavailable: "לא פנוי בתאריכים שבחרת", unknown: "לבירור זמינות ומחיר פנו למקום" } },
  en: { call: "Call", whatsapp: "WhatsApp enquiry", reviews: "reviews", outOfTen: "out of 10", details: "View details", quickBook: "Quick booking", searchedDates: "Your searched dates", noDates: "No dates selected", from: "From ", night: "per night", stayTotal: "for the whole stay", nightlyAverage: "average per night", to: "to", inquirePrice: "Contact the property for availability and price", checking: "Checking live availability and price", unavailableSource: "We could not verify availability and price right now", includedGuests: (count) => `Price basis: ${count} guests`, minimumNights: (count) => `Minimum stay: ${count} nights`, availability: { available: "Available for your dates", unavailable: "Unavailable for your dates", unknown: "Contact the property for availability and price" } },
  ru: { call: "Позвонить", whatsapp: "Запрос в WhatsApp", reviews: "отзывов", outOfTen: "из 10", details: "Подробнее", quickBook: "Быстрое бронирование", searchedDates: "Даты вашего поиска", noDates: "Даты не выбраны", from: "От ", night: "за ночь", stayTotal: "за весь период", nightlyAverage: "в среднем за ночь", to: "по", inquirePrice: "Уточните наличие и цену у объекта", checking: "Проверяем актуальные наличие и цену", unavailableSource: "Не удалось проверить наличие и цену", includedGuests: (count) => `Цена рассчитана для ${count} гостей`, minimumNights: (count) => `Минимум ${count} ночи`, availability: { available: "Свободно на ваши даты", unavailable: "Нет мест на ваши даты", unknown: "Уточните наличие и цену у объекта" } },
  fr: { call: "Appeler", whatsapp: "Demande par WhatsApp", reviews: "avis", outOfTen: "sur 10", details: "Voir les détails", quickBook: "Réservation rapide", searchedDates: "Dates de votre recherche", noDates: "Aucune date sélectionnée", from: "À partir de ", night: "par nuit", stayTotal: "pour tout le séjour", nightlyAverage: "moyenne par nuit", to: "au", inquirePrice: "Contactez l'établissement pour la disponibilité et le prix", checking: "Vérification des disponibilités et du prix", unavailableSource: "Impossible de vérifier la disponibilité et le prix pour le moment", includedGuests: (count) => `Prix calculé pour ${count} personnes`, minimumNights: (count) => `Séjour minimum : ${count} nuits`, availability: { available: "Disponible à vos dates", unavailable: "Indisponible à vos dates", unknown: "Contactez l'établissement pour la disponibilité et le prix" } },
};

const phoneCopy: Record<SiteLanguage, { reveal: string; call: string }> = {
  he: { reveal: "הצגת מספר", call: "לחיוג" },
  en: { reveal: "Show number", call: "Call now" },
  ru: { reveal: "Показать номер", call: "Позвонить" },
  fr: { reveal: "Afficher le numéro", call: "Appeler" },
};

const propertyCardInterfaceCopy: Record<SiteLanguage, { stay: string; location: string; open: string; details: string; image: string; previous: string; next: string; choose: string; units: (count: number) => string; whole: string; capacity: (count: number, perUnit: boolean) => string; pending: string; highlights: string }> = {
  he: { stay: "מקום אירוח", location: "ישראל", open: "פתיחת עמוד המקום", details: "פרטים על", image: "תמונה", previous: "התמונה הקודמת", next: "התמונה הבאה", choose: "בחירת תמונה", units: (count) => `${count} יחידות`, whole: "מקום אירוח שלם", capacity: (count, perUnit) => `עד ${count} אורחים${perUnit ? " ביחידה" : ""}`, pending: "קיבולת בבירור מול המקום", highlights: "מאפיינים מרכזיים" },
  en: { stay: "Stay", location: "Israel", open: "Open property page", details: "Details for", image: "image", previous: "Previous image", next: "Next image", choose: "Choose image", units: (count) => `${count} units`, whole: "Entire property", capacity: (count, perUnit) => `Up to ${count} guests${perUnit ? " per unit" : ""}`, pending: "Capacity confirmed by the property", highlights: "Key features" },
  ru: { stay: "Размещение", location: "Израиль", open: "Открыть страницу объекта", details: "Подробнее об объекте", image: "фото", previous: "Предыдущее фото", next: "Следующее фото", choose: "Выбрать фото", units: (count) => `${count} вариантов размещения`, whole: "Объект целиком", capacity: (count, perUnit) => `До ${count} гостей${perUnit ? " в каждом варианте" : ""}`, pending: "Вместимость подтвердит объект", highlights: "Основные удобства" },
  fr: { stay: "Hébergement", location: "Israël", open: "Ouvrir la page de l’établissement", details: "Détails de", image: "photo", previous: "Photo précédente", next: "Photo suivante", choose: "Choisir une photo", units: (count) => `${count} unités`, whole: "Établissement entier", capacity: (count, perUnit) => `Jusqu’à ${count} personnes${perUnit ? " par unité" : ""}`, pending: "Capacité confirmée par l’établissement", highlights: "Caractéristiques principales" },
};

export type SelectedStay = { from: string; till: string; guests?: number };

type DemoAvailabilityKind = "available-price" | "price-only" | "available-no-price" | "no-data" | "unavailable" | "unavailable-alternatives" | "unavailable-price";
export type ResolvedAvailability = ListingDateQuote & {
  showSelectedDates: boolean;
  totalPrice?: number;
  priceMode?: "stay_total" | "nightly_average" | "event_total";
  onlineBooking?: boolean;
  alternatives?: Array<{ from: string; till: string; nightlyPrice: number }>;
  illustrative?: boolean;
  units?: Array<{
    index: number;
    availability: "available" | "unavailable";
    availableCount: number;
    totalPrice?: number;
    nightlyPrice?: number;
    maxGuests?: number;
  }>;
  recommendation?: {
    guests: number;
    unitCount: number;
    totalCapacity: number;
    totalPrice?: number;
    nightlyPrice?: number;
    items: Array<{
      index: number;
      quantity: number;
      maxGuests: number;
      totalPrice?: number;
      nightlyPrice?: number;
    }>;
  } | null;
};

const demoScenarioCopy: Record<SiteLanguage, { label: string; alternatives: string; alternativePrice: string }> = {
  he: { label: "\u05d4\u05de\u05d7\u05e9\u05ea \u05ea\u05e6\u05d5\u05d2\u05d4 \u05d1\u05dc\u05d1\u05d3", alternatives: "\u05ea\u05d0\u05e8\u05d9\u05db\u05d9\u05dd \u05d7\u05dc\u05d5\u05e4\u05d9\u05d9\u05dd \u05dc\u05d3\u05d5\u05d2\u05de\u05d4", alternativePrice: "\u05de\u05d7\u05d9\u05e8 \u05dc\u05d3\u05d5\u05d2\u05de\u05d4" },
  en: { label: "Display example only", alternatives: "Example alternative dates", alternativePrice: "Example price" },
  ru: { label: "\u0422\u043e\u043b\u044c\u043a\u043e \u043f\u0440\u0438\u043c\u0435\u0440 \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f", alternatives: "\u041f\u0440\u0438\u043c\u0435\u0440\u044b \u0430\u043b\u044c\u0442\u0435\u0440\u043d\u0430\u0442\u0438\u0432\u043d\u044b\u0445 \u0434\u0430\u0442", alternativePrice: "\u041f\u0440\u0438\u043c\u0435\u0440 \u0446\u0435\u043d\u044b" },
  fr: { label: "Exemple d\u2019affichage uniquement", alternatives: "Exemples de dates alternatives", alternativePrice: "Exemple de prix" },
};
export const availabilityDemoStay = { from: "2026-09-04", till: "2026-09-06" } as const;

const demoAvailabilityScenarios: Array<Record<string, DemoAvailabilityKind>> = [
  {
    "aqua-resort": "available-price", "kesem-harimon": "price-only", "ahuzat-or": "available-no-price", "sol-gilgal": "no-data",
    "anael-estate": "unavailable", "magic-garden-gefen": "unavailable-alternatives", "perfumes-villa": "unavailable-price",
    "ar-suites": "available-price", "infinity-suites": "available-price", "rose-estate": "unavailable-alternatives",
    "vacation-villa-esem-harimon": "available-price", "vacation-gesthouse-royal": "price-only", "vacation-vila-harel": "available-no-price",
    "vacation-villa-yotam": "no-data", "vacation-villa-circle": "unavailable",
    "vacation-hamata-begalil-primium": "available-price", "vacation-como-boutique": "available-price", "vacation-villa-exodus": "available-price",
    "vacation-tepers-estate": "available-price", "vacation-daniel": "available-price",
  },
  {
    "aqua-resort": "unavailable-alternatives", "kesem-harimon": "available-price", "ahuzat-or": "price-only", "sol-gilgal": "available-no-price",
    "anael-estate": "no-data", "magic-garden-gefen": "unavailable", "perfumes-villa": "unavailable-price",
    "ar-suites": "available-price", "infinity-suites": "unavailable-alternatives", "rose-estate": "available-price",
    "vacation-villa-esem-harimon": "available-price", "vacation-gesthouse-royal": "price-only", "vacation-vila-harel": "available-no-price",
    "vacation-villa-yotam": "no-data", "vacation-villa-circle": "unavailable",
    "vacation-hamata-begalil-primium": "available-price", "vacation-como-boutique": "available-price", "vacation-villa-exodus": "available-price",
    "vacation-tepers-estate": "available-price", "vacation-daniel": "available-price",
  },
  {
    "aqua-resort": "unavailable", "kesem-harimon": "unavailable-price", "ahuzat-or": "available-price", "sol-gilgal": "price-only",
    "anael-estate": "available-no-price", "magic-garden-gefen": "no-data", "perfumes-villa": "unavailable-alternatives",
    "ar-suites": "available-price", "infinity-suites": "available-price", "rose-estate": "unavailable",
    "vacation-villa-esem-harimon": "available-price", "vacation-gesthouse-royal": "price-only", "vacation-vila-harel": "available-no-price",
    "vacation-villa-yotam": "no-data", "vacation-villa-circle": "unavailable",
    "vacation-hamata-begalil-primium": "available-price", "vacation-como-boutique": "available-price", "vacation-villa-exodus": "available-price",
    "vacation-tepers-estate": "available-price", "vacation-daniel": "available-price",
  },
  {
    "aqua-resort": "available-no-price", "kesem-harimon": "no-data", "ahuzat-or": "unavailable", "sol-gilgal": "unavailable-alternatives",
    "anael-estate": "unavailable-price", "magic-garden-gefen": "available-price", "perfumes-villa": "price-only",
    "ar-suites": "available-price", "infinity-suites": "unavailable", "rose-estate": "available-price",
    "vacation-villa-esem-harimon": "available-price", "vacation-gesthouse-royal": "price-only", "vacation-vila-harel": "available-no-price",
    "vacation-villa-yotam": "no-data", "vacation-villa-circle": "unavailable",
    "vacation-hamata-begalil-primium": "available-price", "vacation-como-boutique": "available-price", "vacation-villa-exodus": "available-price",
    "vacation-tepers-estate": "available-price", "vacation-daniel": "available-price",
  },
];

const demoNightlyPrices: Record<string, number> = {
  "aqua-resort": 1300, "kesem-harimon": 1100, "ahuzat-or": 1500, "ar-suites": 1200, "sol-gilgal": 700,
  "infinity-suites": 1600, "magic-garden-gefen": 2400, "anael-estate": 4000, "perfumes-villa": 4500, "rose-estate": 6000,
  "vacation-villa-esem-harimon": 1100,
  "vacation-gesthouse-royal": 3900,
  "vacation-hamata-begalil-primium": 1800,
  "vacation-como-boutique": 2200,
  "vacation-villa-exodus": 2600,
  "vacation-tepers-estate": 3200,
  "vacation-daniel": 2800,
};

const demoAvailabilityKinds: DemoAvailabilityKind[] = ["available-price", "price-only", "available-no-price", "no-data", "unavailable", "unavailable-alternatives", "unavailable-price"];
const demoPriceRange = [700, 1100, 1200, 1300, 1500, 1600, 2400, 4000, 4500, 6000];

function stableDemoIndex(value: string) {
  return Array.from(value).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0);
}

export const availabilityDemoSlugs = Object.keys(demoAvailabilityScenarios[0]);

export function isAvailabilityDemoSearch(selectedStay: SelectedStay | null, requestedLocation: string | null) {
  void selectedStay;
  void requestedLocation;
  // Public search results must never manufacture availability or a price.
  return false;
}

function demoSeptemberPeriod(value: string) {
  const day = Number(value.slice(-2));
  return Number.isFinite(day) ? Math.min(3, Math.max(0, Math.floor((day - 1) / 7))) : 0;
}

function localizedDate(value: string, language: SiteLanguage) {
  const locales: Record<SiteLanguage, string> = { he: "he-IL", en: "en-GB", ru: "ru-RU", fr: "fr-FR" };
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locales[language], { day: "numeric", month: "short" }).format(date);
}

function PriceValue({ amount, language }: { amount: string; language: SiteLanguage }) {
  return <bdi className="stay-card__price-value" dir={language === "he" ? "rtl" : "ltr"} aria-label={`${amount} \u20AA`}><span className="stay-card__price-number">{amount}</span><span className="stay-card__currency" aria-hidden="true">{"\u20AA"}</span></bdi>;
}

function quoteForStay(property: Property, selectedStay: SelectedStay | null): (ListingDateQuote & { illustrative?: boolean }) | null {
  if (!selectedStay) return null;
  if (property.demoOperations?.fictional) {
    const arrival = new Date(`${selectedStay.from}T12:00:00Z`);
    const departure = new Date(`${selectedStay.till}T12:00:00Z`);
    let available = arrival < departure;
    const cursor = new Date(arrival);
    while (available && cursor < departure) {
      const epochDay = Math.floor(cursor.getTime() / 86_400_000);
      if (Math.floor(epochDay / 2) % 2 !== 0) available = false;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const weekend = arrival.getUTCDay() === 4 || arrival.getUTCDay() === 5;
    return {
      ...selectedStay,
      illustrative: true,
      availability: available ? "available" : "unavailable",
      nightlyPrice: weekend ? property.demoOperations.weekendNightlyPrice : property.demoOperations.weekdayNightlyPrice,
      includedGuests: property.guests,
    };
  }
  const exactQuote = property.dateQuotes?.find((quote) => quote.from === selectedStay.from && quote.till === selectedStay.till);
  if (exactQuote) return exactQuote;
  if (property.dailyAvailability?.length) {
    const byDate = new Map(property.dailyAvailability.map((day) => [day.date, day]));
    const cursor = new Date(`${selectedStay.from}T12:00:00Z`);
    const departure = new Date(`${selectedStay.till}T12:00:00Z`);
    const selectedDays: NonNullable<Property["dailyAvailability"]> = [];
    while (cursor < departure) {
      const day = byDate.get(cursor.toISOString().slice(0, 10));
      if (!day) return { ...selectedStay, availability: "unknown" };
      selectedDays.push(day);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (selectedDays.length) {
      const prices = selectedDays.map((day) => day.nightlyPrice).filter((price): price is number => typeof price === "number" && price > 0);
      const oneNightlyPrice = prices.length === selectedDays.length && prices.every((price) => price === prices[0]) ? prices[0] : undefined;
      const includedGuests = selectedDays.every((day) => day.includedGuests === selectedDays[0].includedGuests) ? selectedDays[0].includedGuests : undefined;
      const minimumNights = selectedDays[0].minimumNights || 1;
      const satisfiesMinimumStay = selectedDays.length >= minimumNights;
      return {
        ...selectedStay,
        availability: selectedDays.every((day) => day.availableUnits > 0) && satisfiesMinimumStay ? "available" : "unavailable",
        nightlyPrice: oneNightlyPrice,
        includedGuests,
        minimumNights,
      };
    }
  }
  return {
    ...selectedStay,
    availability: "unknown",
  };
}

export function propertyDetailHref(baseHref: string, context: Record<string, string | undefined>) {
  const [pathAndQuery, hash = ""] = baseHref.split("#", 2);
  const [path, query = ""] = pathAndQuery.split("?", 2);
  const params = new URLSearchParams(query);
  for (const [key, value] of Object.entries(context)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const serialized = params.toString();
  return `${path}${serialized ? `?${serialized}` : ""}${hash ? `#${hash}` : ""}`;
}

function shiftStayDate(value: string, days: number) {
  const date = new Date(value + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function demoAvailabilityFor(property: Property, selectedStay: SelectedStay | null, pathname: string, requestedLocation: string | null): ResolvedAvailability | null {
  if (property.dailyAvailability?.length || property.dateQuotes?.length) return null;
  if (!selectedStay || !isAvailabilityDemoSearch(selectedStay, requestedLocation)) return null;
  void pathname;
  const period = demoSeptemberPeriod(selectedStay.from);
  const stableIndex = stableDemoIndex(property.slug);
  const kind = demoAvailabilityScenarios[period][property.slug] || demoAvailabilityKinds[(stableIndex + period) % demoAvailabilityKinds.length];
  const nightlyPrice = demoNightlyPrices[property.slug] || property.price || demoPriceRange[stableIndex % demoPriceRange.length];
  const common = { ...selectedStay, illustrative: true };
  if (kind === "available-price") return { ...common, availability: "available", nightlyPrice, includedGuests: property.guests || 2, showSelectedDates: true };
  if (kind === "price-only") return { ...common, availability: "unknown", nightlyPrice, includedGuests: property.guests || 2, showSelectedDates: false };
  if (kind === "available-no-price") return { ...common, availability: "available", showSelectedDates: true };
  if (kind === "no-data") return { ...common, availability: "unknown", showSelectedDates: false };
  if (kind === "unavailable") return { ...common, availability: "unavailable", showSelectedDates: true };
  if (kind === "unavailable-price") return { ...common, availability: "unavailable", nightlyPrice, includedGuests: property.guests || 2, showSelectedDates: true };
  const alternativeOffsets = period === 3 ? [-7, 2] : [3, 7];
  return { ...common, availability: "unavailable", showSelectedDates: true, alternatives: alternativeOffsets.map((days, index) => ({ from: shiftStayDate(selectedStay.from, days), till: shiftStayDate(selectedStay.till, days), nightlyPrice: nightlyPrice + (index * 200) })) };
}

export function resolveAvailabilityForStay(property: Property, selectedStay: SelectedStay | null, pathname = "", requestedLocation: string | null = null): ResolvedAvailability | null {
  if (legacyAvailabilitySourceFor(property.slug)) return null;
  const demoAvailability = demoAvailabilityFor(property, selectedStay, pathname, requestedLocation);
  const selectedQuote = quoteForStay(property, selectedStay);
  const resolved = demoAvailability || (selectedQuote ? { ...selectedQuote, showSelectedDates: true } : null);
  if (!resolved || !selectedStay || property.slug !== "hilat-hanof" || !property.roomOptions?.length || !property.dailyAvailability?.length) return resolved;

  const byDate = new Map(property.dailyAvailability.map((day) => [day.date, day]));
  const cursor = new Date(`${selectedStay.from}T12:00:00Z`);
  const departure = new Date(`${selectedStay.till}T12:00:00Z`);
  const selectedDays: NonNullable<Property["dailyAvailability"]> = [];
  while (cursor < departure) {
    const day = byDate.get(cursor.toISOString().slice(0, 10));
    if (!day) return resolved;
    selectedDays.push(day);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const totalUnits = property.roomOptions.length;
  const allUnitsAvailable = selectedDays.length > 0 && selectedDays.every((day) => day.availableUnits === totalUnits);
  const allUnitsUnavailable = selectedDays.length > 0 && selectedDays.every((day) => day.availableUnits === 0);
  if (!allUnitsAvailable && !allUnitsUnavailable) return resolved;
  const nightlyPrice = resolved.nightlyPrice;
  return {
    ...resolved,
    units: property.roomOptions.map((_, index) => ({
      index,
      availability: allUnitsAvailable ? "available" : "unavailable",
      availableCount: allUnitsAvailable ? 1 : 0,
      nightlyPrice,
      totalPrice: nightlyPrice ? nightlyPrice * selectedDays.length : undefined,
    })),
  };
}

export function hasAvailablePriceForSearch(property: Property, selectedStay: SelectedStay | null, pathname: string, requestedLocation: string | null) {
  if (!selectedStay) return false;
  const resolvedAvailability = resolveAvailabilityForStay(property, selectedStay, pathname, requestedLocation);
  return resolvedAvailability?.availability === "available"
    && typeof resolvedAvailability.nightlyPrice === "number"
    && resolvedAvailability.nightlyPrice > 0;
}

export function PropertyCard({ property, selectedStay = null, promotional = false, detailHref, liveAvailabilityState, mapActive = false, onActiveChange }: { property: Property; selectedStay?: SelectedStay | null; promotional?: boolean; detailHref?: string; liveAvailabilityState?: LegacyAvailabilityState; mapActive?: boolean; onActiveChange?: (active: boolean) => void }) {
  const { language, translate } = useSiteLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const copy = cardCopy[language];
  const interfaceCopy = propertyCardInterfaceCopy[language];
  const localizedName = localizedBusinessText(property.name, language, translate, latinBusinessAlias(property.name) || interfaceCopy.stay);
  const localizedLocation = localizedBusinessText(property.location, language, translate, interfaceCopy.location);
  const localizedArea = localizedBusinessText(property.area, language, translate, interfaceCopy.location);
  const localizedType = localizedBusinessText(property.type, language, translate, interfaceCopy.stay);
  const galleryImages = [property.image, ...property.images].filter((src, index, all) => src && all.indexOf(src) === index).slice(0, 10);
  const [imageIndex, setImageIndex] = useState(0);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const touchStart = useRef<number | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const highlightRailRef = useRef<HTMLDivElement>(null);
  const didSwipe = useRef(false);
  const swipeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phone = property.contact?.phone?.replace(/[^\d+]/g, "");
  const whatsapp = property.contact?.whatsapp;
  const ownLegacyAvailability = useLegacyAvailability(property, promotional || liveAvailabilityState ? null : selectedStay);
  const liveLegacyAvailability = liveAvailabilityState || ownLegacyAvailability;
  const resolvedAvailability = promotional ? null : liveLegacyAvailability.quote || (liveAvailabilityState ? null : resolveAvailabilityForStay(property, selectedStay, pathname, searchParams.get("location")));
  const isLiveAvailabilityLoading = !promotional && selectedStay && liveLegacyAvailability.status === "loading";
  const isLiveAvailabilityError = !promotional && selectedStay && liveLegacyAvailability.status === "error";
  const displayPrice = resolvedAvailability?.priceMode === "stay_total" ? resolvedAvailability.totalPrice : resolvedAvailability?.nightlyPrice;
  const priceUnit = resolvedAvailability?.priceMode === "stay_total" ? copy.stayTotal : resolvedAvailability?.priceMode === "nightly_average" ? copy.nightlyAverage : copy.night;
  const hasQuotedPrice = typeof displayPrice === "number" && displayPrice > 0;
  const quickBookingReady = Boolean(!/^vacation-\d+$/.test(property.slug) && selectedStay && resolvedAvailability?.availability === "available" && resolvedAvailability.nightlyPrice && resolvedAvailability.nightlyPrice > 0);
  const cardMode = promotional ? "promotional" : resolvedAvailability ? "dated" : "result";
  const basePropertyHref = detailHref || `/business?id=${property.slug}`;
  const selectedGuests = String(selectedStay?.guests || searchParams.get("guests") || searchParams.get("adults") || 2);
  const propertyHref = quickBookingReady && selectedStay ? propertyDetailHref(basePropertyHref, { source: "search", from: selectedStay.from, till: selectedStay.till, guests: selectedGuests, price: String(resolvedAvailability?.nightlyPrice || ""), illustrative: resolvedAvailability?.illustrative || property.demoOperations?.fictional ? "1" : undefined }) : basePropertyHref;
  const quickBookingHref = quickBookingReady && selectedStay ? `/booking?${new URLSearchParams({ world: "vacation", place: property.slug, from: selectedStay.from, till: selectedStay.till, guests: selectedGuests, price: String(resolvedAvailability?.nightlyPrice || ""), ...(resolvedAvailability?.illustrative || property.demoOperations?.fictional ? { illustrative: "1" } : {}) }).toString()}` : "";
  const cardHighlights = localizedBusinessList((property.highlights?.length ? property.highlights.map((highlight) => highlight.label) : property.features).slice(0, 3), language, translate);
  useEffect(() => { const node = cardRef.current; if (!node || !window.IntersectionObserver) return; let sent = false; const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && entry.intersectionRatio >= .5 && !sent) { sent = true; trackBusinessEvent("impression", { placeId: property.slug, placeName: property.name, world: "vacation" }); observer.disconnect(); } }, { threshold: .5 }); observer.observe(node); return () => observer.disconnect(); }, [property.name, property.slug]);

  function moveImage(event: MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    event.preventDefault();
    event.stopPropagation();
    setImageIndex((current) => boundedSliderIndex(current, direction, galleryImages.length));
  }

  const imagePreviousDisabled = imageIndex === 0;
  const imageNextDisabled = imageIndex >= galleryImages.length - 1;

  return (
    <article ref={cardRef} className={`stay-card stay-card--${cardMode}${mapActive ? " is-map-active" : ""}`} data-map-place-id={property.slug} onPointerEnter={() => onActiveChange?.(true)} onPointerLeave={() => onActiveChange?.(false)} onFocusCapture={() => onActiveChange?.(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onActiveChange?.(false); }}>
      <Link className="stay-card__surface-link" href={propertyHref} target="_blank" rel="noopener noreferrer" aria-label={`${interfaceCopy.open}: ${localizedName}`} />
      <div className="stay-card__media" onTouchStart={(event) => { if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); didSwipe.current = false; touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => { if (touchStart.current === null || galleryImages.length < 2) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) { didSwipe.current = true; swipeResetTimer.current = setTimeout(() => { didSwipe.current = false; swipeResetTimer.current = null; }, 500); setImageIndex((current) => boundedSliderIndex(current, distance > 0 ? -1 : 1, galleryImages.length)); } touchStart.current = null; }}>
        <Link href={propertyHref} target="_blank" rel="noopener noreferrer" aria-label={`${interfaceCopy.details}: ${localizedName}`} onClick={(event) => { if (!didSwipe.current) return; event.preventDefault(); event.stopPropagation(); didSwipe.current = false; if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current); swipeResetTimer.current = null; }}>
          <img key={galleryImages[imageIndex]} src={galleryImages[imageIndex]} alt={`${localizedName}, ${interfaceCopy.image} ${imageIndex + 1}/${galleryImages.length}`} title={`${localizedName}, ${interfaceCopy.image} ${imageIndex + 1}/${galleryImages.length}`} loading="lazy" decoding="async" />
        </Link>
        {galleryImages.length > 1 ? <><button className="stay-card__gallery-arrow stay-card__gallery-arrow--previous" type="button" aria-label={`${interfaceCopy.previous}: ${localizedName}`} title={interfaceCopy.previous} disabled={imagePreviousDisabled} data-slider-boundary onClick={(event) => moveImage(event, -1)}>{language === "he" ? <ChevronRight aria-hidden="true" /> : <ChevronLeft aria-hidden="true" />}</button><button className="stay-card__gallery-arrow stay-card__gallery-arrow--next" type="button" aria-label={`${interfaceCopy.next}: ${localizedName}`} title={interfaceCopy.next} disabled={imageNextDisabled} data-slider-boundary onClick={(event) => moveImage(event, 1)}>{language === "he" ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}</button><div className="stay-card__gallery-dots" aria-label={`${interfaceCopy.choose}: ${localizedName}`}>{galleryImages.slice(0, 5).map((src, index) => { const active = imageIndex === index || index === 4 && imageIndex >= 4; return <button key={src} className={active ? "active" : ""} type="button" aria-label={`${interfaceCopy.choose} ${index + 1}: ${localizedName}`} aria-current={active ? "true" : undefined} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setImageIndex(index); }} />; })}</div><span className="stay-card__gallery-count" aria-live="polite">{imageIndex + 1}/{galleryImages.length}</span></> : null}
        <FavoriteButton className="heart-button" id={property.slug} world="vacation" name={localizedName} location={`${localizedLocation}, ${localizedArea}`} image={property.image} href={propertyHref} meta={property.guests > 0 ? `${localizedType} · ${interfaceCopy.capacity(property.guests, property.capacityScope === "unit")}` : localizedType} />
        {property.cardNote ? <span className="stay-card__public-note">{property.cardNote}</span> : null}
        <div className="stay-card__badges">{property.badges.slice(0, 2).map((badge) => <span key={badge}>{badge}</span>)}</div>
      </div>
      <div className="stay-card__body">
        {property.demoOperations?.fictional ? <SampleListingDisclosure variant="card" /> : null}
        <div className="stay-card__title">
          <div>
            <h3><Link href={propertyHref} target="_blank" rel="noopener noreferrer">{localizedName}<span className="sr-only"></span></Link></h3>
            <p><PinIcon />{localizedLocation}, {localizedArea}</p>
          </div>
          {property.score && property.reviews ? <span className="stay-card__rating" aria-label={`${property.score} ${copy.outOfTen}, ${property.reviews} ${copy.reviews}`}><b aria-hidden="true">★</b><strong>{property.score}</strong><small>({property.reviews})</small></span> : null}
        </div>
        <p className="stay-card__meta">{localizedType}{property.units && property.units > 1 ? `, ${interfaceCopy.units(property.units)}` : property.capacityScope === "unit" ? "" : `, ${interfaceCopy.whole}`} · {property.guests > 0 ? interfaceCopy.capacity(property.guests, property.capacityScope === "unit") : interfaceCopy.pending}</p>
        {cardHighlights.length ? <div className="stay-card__highlights-shell">
          <div ref={highlightRailRef} className="feature-chips stay-card__highlights" aria-label={interfaceCopy.highlights} data-horizontal-rail>{cardHighlights.map((feature) => <span key={feature}>{feature}</span>)}</div>
          <SliderRailControls railRef={highlightRailRef} label={interfaceCopy.highlights} itemSelector=":scope > span" className="stay-card__highlight-controls" />
        </div> : null}
        {isLiveAvailabilityLoading ? <div className="stay-card__date-status stay-card__date-status--checking" aria-live="polite"><strong>{copy.checking}</strong></div> : null}
        {isLiveAvailabilityError ? <div className="stay-card__date-status stay-card__date-status--error" aria-live="polite"><strong>{copy.unavailableSource}</strong></div> : null}
        {!promotional && !selectedStay ? <div className="stay-card__date-status"><strong>{copy.noDates}</strong></div> : null}
        {!promotional && resolvedAvailability ? <div className="stay-card__date-status" aria-live="polite">
          {resolvedAvailability.illustrative ? <span className="stay-card__demo-label">{demoScenarioCopy[language].label}</span> : null}
          <div className="stay-card__date-status-row">
            <div className="stay-card__selected-dates"><small>{copy.searchedDates}</small><span>{localizedDate(resolvedAvailability.from, language)} <small>{copy.to}</small> {localizedDate(resolvedAvailability.till, language)}</span></div>
            <span className="stay-card__availability-group"><strong className={`stay-card__availability stay-card__availability--${resolvedAvailability.availability}`}>{copy.availability[resolvedAvailability.availability]}</strong>{resolvedAvailability.minimumNights && resolvedAvailability.minimumNights > 1 ? <small>{copy.minimumNights(resolvedAvailability.minimumNights)}</small> : null}</span>
          </div>
          {resolvedAvailability.availability === "available" && typeof resolvedAvailability.onlineBooking === "boolean" ? <small>{resolvedAvailability.onlineBooking ? { he: "אפשר להזמין באתר", en: "Book online", ru: "Бронирование на сайте", fr: "Réservation en ligne" }[language] : { he: "להזמנה מתקשרים למקום", en: "Call the property to book", ru: "Для бронирования позвоните", fr: "Réservation par téléphone" }[language]}</small> : null}
          {resolvedAvailability.alternatives?.length ? <div className="stay-card__alternatives">
            <strong>{demoScenarioCopy[language].alternatives}</strong>
            <div>{resolvedAvailability.alternatives.map((alternative) => <span key={alternative.from}><small>{localizedDate(alternative.from, language)} {copy.to} {localizedDate(alternative.till, language)}</small><b><PriceValue amount={alternative.nightlyPrice.toLocaleString()} language={language} /></b></span>)}</div>
          </div> : null}
        </div> : null}
        <div className={`stay-card__footer stay-card__footer--${cardMode}`}>
          {!promotional && (resolvedAvailability || (!selectedStay && property.price)) ? <div className="stay-card__commercial-summary">
            {resolvedAvailability ? <span className={`stay-card__price stay-card__price--selected ${hasQuotedPrice ? "stay-card__price--known" : ""}`}>{hasQuotedPrice ? <><b><PriceValue amount={displayPrice?.toLocaleString() || ""} language={language} /></b><small>{priceUnit}</small>{resolvedAvailability.includedGuests ? <em>{copy.includedGuests(resolvedAvailability.includedGuests)}</em> : null}</> : resolvedAvailability.alternatives?.length ? <strong>{demoScenarioCopy[language].alternativePrice}</strong> : <strong>{copy.inquirePrice}</strong>}</span> : property.price ? <span className="stay-card__price stay-card__price--known"><small>{copy.from}</small><b><PriceValue amount={property.price.toLocaleString()} language={language} /></b><small>{copy.night}</small></span> : null}
          </div> : null}
          <div className="stay-card__actions">
            {quickBookingReady ? <Link className="stay-card__details-link stay-card__details-link--booking" href={quickBookingHref}>{copy.quickBook}</Link> : null}
            {!quickBookingReady && !promotional && phone ? phoneVisible
              ? <a className="stay-card__contact stay-card__contact--phone stay-card__contact--revealed" href={`tel:${phone}`} aria-label={`${phoneCopy[language].call}: ${property.name}`}><PhoneIcon /><bdi>{property.contact?.phone}</bdi></a>
              : <button className="stay-card__contact stay-card__contact--phone" type="button" aria-expanded={phoneVisible} onClick={() => { setPhoneVisible(true); trackPhoneReveal({ placeId: property.slug, placeName: property.name, world: "vacation", placement: "property_card" }); }}><PhoneIcon /><span>{phoneCopy[language].reveal}</span></button>
            : null}
            {!quickBookingReady && !promotional && whatsapp ? <WhatsAppLeadButton world="vacation" placeId={property.slug} placeName={property.name} businessPhone={whatsapp} serviceName={property.type} initialDate={selectedStay?.from} buttonLabel={copy.whatsapp} buttonClassName="stay-card__contact stay-card__contact--whatsapp" /> : null}
            {!quickBookingReady && !promotional && property.demoOperations?.fictional ? <ListingContactPreview placeName={property.name} className="listing-contact-preview--card" /> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
