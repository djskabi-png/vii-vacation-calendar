"use client";

import { useSiteLanguage } from "../i18n/locale-provider";

export function CatalogStartingPrice({ amount }: { amount: number }) {
  const { language } = useSiteLanguage();
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const label = { he: "החל מ־", en: "From", fr: "À partir de", ru: "От" }[language];
  return <span className="catalog-starting-price"><small>{label}</small>{" "}<bdi dir="ltr">{amount.toLocaleString(language)} ₪</bdi></span>;
}
