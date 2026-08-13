import type { Metadata } from "next";
import { PageShell } from "../components/page-shell";
import { properties, eventPlaces } from "../data/site-data";
import { discoveryItems } from "../data/world-data";
import { getSpaDetails } from "../data/spa-details";
import { getProviderDetails } from "../data/provider-details";
import BookingPageClient from "./client-page";

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
    illustrative?: string;
  }>;
};

function resolveBooking(params: Awaited<Props["searchParams"]>) {
  const offerId = params.package || params.service || params.offer || "";
  const property = properties.find((item) => item.slug === params.place);
  if (property) return {
    world: "vacation",
    placeId: property.slug,
    placeName: property.name,
    offerId,
    offerName: "הזמנת המקום",
    price: params.price ? `${Number(params.price).toLocaleString("he-IL")} ₪${params.illustrative === "1" ? ", מחיר לדוגמה" : ", בכפוף לאישור זמינות"}` : "מחיר סופי לאחר בחירת תאריך",
    onlineReady: Boolean(params.from && params.till && params.price && Number(params.price) > 0),
    phone: property.contact?.phone,
    illustrative: params.illustrative === "1" || property.demoOperations?.fictional === true,
    demoOwnerEmail: property.demoOperations?.ownerEmail,
    demoProperty: property.demoOperations?.fictional === true,
  };

  const eventPlace = eventPlaces.find((item) => item.slug === params.place);
  if (eventPlace) return { world: "events", placeId: eventPlace.slug, placeName: eventPlace.name, offerId, offerName: "הזמנת אירוע", price: "מחיר לפי תאריך והרכב" };

  const item = discoveryItems.find((entry) => entry.id === params.place);
  if (!item) return { world: params.world || "vacation", placeId: params.place || "", placeName: "הזמנה באתר", offerId, offerName: "בחירת שירות", price: "מחיר יוצג לפני אישור" };

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
    };
  }

  if (item.world === "providers") {
    const service = getProviderDetails(item.id)?.services.find((entry) => entry.id === offerId);
    return { world: item.world, placeId: item.id, placeName: item.name, offerId, offerName: service?.title || "שירות לבחירה", price: item.priceLabel || "מחיר יוצג לפני אישור" };
  }

  return { world: item.world, placeId: item.id, placeName: item.name, offerId, offerName: item.world === "hourly" ? "שהייה לפי שעה" : "הזמנת הפעילות", price: item.priceLabel || "מחיר יוצג לפני אישור" };
}

export default async function BookingPage({ searchParams }: Props) {
  const params = await searchParams;
  const booking = resolveBooking(params);
  return <PageShell variant={booking.world as "vacation" | "events" | "spa" | "hourly" | "providers" | "activities"}>
    <BookingPageClient {...booking} action={params.action || "new"} initialFrom={params.from} initialTill={params.till} initialGuests={params.guests} />
  </PageShell>;
}
