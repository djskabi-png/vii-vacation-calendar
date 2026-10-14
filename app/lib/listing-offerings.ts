import type { BusinessOffering, Listing } from "../data/site-data";

export function getListingOfferings(listing: Listing): BusinessOffering[] {
  return listing.offerings?.length ? listing.offerings : [{
    world: "vacation",
    label: "נופש ולינה",
    summary: "בוחרים תאריכי הגעה ועזיבה והרכב אורחים.",
    bookingMode: "availability-check",
    maxGuests: listing.guests,
  }];
}
