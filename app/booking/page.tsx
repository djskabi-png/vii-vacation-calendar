import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "../components/page-shell";
import { properties, eventPlaces } from "../data/site-data";
import { discoveryItems } from "../data/world-data";
import { getSpaDetails } from "../data/spa-details";
import { getProviderDetails } from "../data/provider-details";
import BookingPageClient from "./client-page";
import { supplierLegacySlug, unavailableLegacySearchHref } from "../data/supplier-legacy-links";
import { supplierPlaceDetail } from "../data/supplier-place-detail";

export const metadata: Metadata = {
  title: "הזמנה אונליין",
  description: "בחירת מועד ושליחת הזמנה למקומות, חבילות ושירותים באתר וי פור ויקיישן.",
  alternates: { canonical: "/booking" },
  robots: { index: false, follow: true },
};

type Props = {
  searchParams: Promise<{
    world?: string;
    place?: string;
    package?: string;
    service?: string;
    offer?: string;
    action?: string;
    from?: string;
    till?: string;
    guests?: string;
    price?: string;
    unitIndex?: string;
    roomID?: string;
    illustrative?: string;
  }>;
};

function countNights(from?: string, till?: string) {
  if (!from || !till) return 0;
  const arrival = Date.parse(`${from}T00:00:00Z`);
  const departure = Date.parse(`${till}T00:00:00Z`);
  if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure <= arrival) return 0;
  return Math.round((departure - arrival) / 86_400_000);
}

async function resolveBooking(params: Awaited<Props["searchParams"]>) {
  const locale = (await headers()).get("x-vii-locale");
  const prefix = locale && locale !== "he" ? `/${locale}` : "";
  const unavailable = unavailableLegacySearchHref(params.place, params.world === "events" ? "events" : "vacations");
  if (unavailable) redirect(`${prefix}${unavailable}`);
  const mappedSlug = supplierLegacySlug(params.place, params.world === "events" ? "events" : "vacations");
  if (mappedSlug) {
    const query = new URLSearchParams({ place: mappedSlug });
    for (const key of ["world", "from", "till", "guests"] as const) if (params[key]) query.set(key, params[key]!);
    redirect(`${prefix}/booking?${query}`);
  }
  const offerId = params.package || params.service || params.offer || "";
  const property = properties.find((item) => item.slug === params.place);
  if (property) {
    const selectedUnitIndex = Math.max(0, Number(params.unitIndex || "0") - 1);
    const supplierRoomID = /^vacation-\d+$/.test(property.slug) && Number.isSafeInteger(Number(params.roomID)) && Number(params.roomID) > 0 ? Number(params.roomID) : undefined;
    const selectedUnit = supplierRoomID
      ? supplierPlaceDetail(property.slug)?.rooms.find((room) => room.id === supplierRoomID)
      : params.unitIndex ? property.roomOptions?.[selectedUnitIndex] : undefined;
    // Catalog records do not authorize prices supplied in a URL.
    const nightlyPrice = property.capacityScope === "unit" || /^vacation-\d+$/.test(property.slug) ? 0 : Number(params.price) || 0;
    const nights = countNights(params.from, params.till);
    const totalPrice = nightlyPrice > 0 && nights > 0 ? nightlyPrice * nights : 0;
    return {
    world: "vacation",
    placeId: property.slug,
    placeName: property.name,
    offerId: supplierRoomID ? `room-${supplierRoomID}` : selectedUnit ? `unit-${selectedUnitIndex + 1}` : offerId,
    offerName: selectedUnit ? `בקשת הזמנה ל${selectedUnit.name}` : "בקשת הזמנה למקום",
    price: totalPrice ? `${totalPrice.toLocaleString("he-IL")} ₪ לכל השהייה` : "מחיר סופי לאחר בחירת תאריך",
    vacationPrice: nightlyPrice > 0 && nights > 0 ? {
      nightlyPrice,
      nights,
      totalPrice,
      guests: Math.max(1, Number(params.guests) || 1),
      wholeProperty: property.scenario === "single" && !selectedUnit,
      taxesIncluded: property.demoOperations?.taxesIncluded === true,
    } : undefined,
    onlineReady: property.capacityScope !== "unit" && Boolean(params.from && params.till && nightlyPrice > 0),
    supplierRoomID,
    phone: property.contact?.phone,
    illustrative: property.capacityScope !== "unit" && (params.illustrative === "1" || property.demoOperations?.fictional === true),
    demoOwnerEmail: property.demoOperations?.ownerEmail,
    demoProperty: property.demoOperations?.fictional === true,
    placeImage: property.image,
    };
  }

  const eventPlace = eventPlaces.find((item) => item.slug === params.place);
  if (eventPlace) return { world: "events", placeId: eventPlace.slug, placeName: eventPlace.name, offerId, offerName: "הזמנת אירוע", price: "מחיר לפי תאריך והרכב" };

  const item = discoveryItems.find((entry) => entry.id === params.place);
  if (!item) {
    if (params.place) notFound();
    return { world: params.world || "vacation", placeId: "", placeName: "הזמנה באתר", offerId, offerName: "בחירת שירות", price: "מחיר יוצג לפני אישור" };
  }

  if (item.world === "spa") {
    const pack = getSpaDetails(item.id)?.packages?.find((entry) => entry.id === offerId);
    return {
      world: item.world,
      placeId: item.id,
      placeName: item.name,
      offerId,
      offerName: pack?.title || "חבילת ספא",
      offerAudience: pack?.audience,
      offerDuration: pack?.duration,
      offerIncludes: pack?.includes || [],
      price: pack?.price || item.priceLabel || "מחיר יוצג לפני אישור",
      placeImage: item.image,
    };
  }

  if (item.world === "providers") {
    const service = getProviderDetails(item.id)?.services.find((entry) => entry.id === offerId);
    return { world: item.world, placeId: item.id, placeName: item.name, offerId, offerName: service?.title || "שירות לבחירה", price: item.priceLabel || "מחיר יוצג לפני אישור", placeImage: item.image };
  }

  return { world: item.world, placeId: item.id, placeName: item.name, offerId, offerName: item.world === "hourly" ? "שהייה לפי שעה" : "הזמנת הפעילות", price: item.priceLabel || "מחיר יוצג לפני אישור", placeImage: item.image };
}

export default async function BookingPage({ searchParams }: Props) {
  const params = await searchParams;
  const booking = await resolveBooking(params);
  return <PageShell variant={booking.world as "vacation" | "events" | "spa" | "hourly" | "providers" | "activities"}>
    <BookingPageClient {...booking} action={params.action || "new"} initialFrom={params.from} initialTill={params.till} initialGuests={params.guests} />
  </PageShell>;
}
