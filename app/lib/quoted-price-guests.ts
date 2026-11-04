import type { SiteLanguage } from "../i18n/locale-provider";

/**
 * A dated supplier total is calculated for the party sent in the quote request.
 * Supplier room basis occupancy is separate metadata and must not be presented
 * as the composition represented by that total.
 */
export function quotedPriceGuestCount(selectedGuests: number | undefined, hasQuotedPrice: boolean) {
  if (!hasQuotedPrice || !Number.isSafeInteger(selectedGuests) || Number(selectedGuests) < 1) return null;
  return Number(selectedGuests);
}

export function quotedPriceGuestLabel(language: SiteLanguage, selectedGuests: number | undefined, hasQuotedPrice: boolean) {
  const count = quotedPriceGuestCount(selectedGuests, hasQuotedPrice);
  if (count === null) return null;
  if (language === "he") return count === 1 ? "המחיר עבור אורח אחד" : `המחיר עבור ${count} אורחים`;
  if (language === "ru") return count === 1 ? "Цена для 1 гостя" : `Цена для ${count} гостей`;
  if (language === "fr") return count === 1 ? "Prix pour 1 personne" : `Prix pour ${count} personnes`;
  return count === 1 ? "Price for 1 guest" : `Price for ${count} guests`;
}

