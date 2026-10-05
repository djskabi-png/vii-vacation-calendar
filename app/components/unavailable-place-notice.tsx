"use client";

import { useSearchParams } from "next/navigation";
import { unavailableLegacyPlace } from "../data/supplier-legacy-links";
import { useSiteLanguage } from "../i18n/locale-provider";

export function UnavailablePlaceNotice({ world }: { world: "vacations" | "events" }) {
  const params = useSearchParams();
  const { translate } = useSiteLanguage();
  const place = unavailableLegacyPlace(params.get("unavailable") || undefined, world);
  if (!place) return null;
  return <div className="shell" role="status"><p><strong>{place.name}</strong><br />{translate("המקום אינו זמין בקטלוג הנוכחי. אפשר לחפש מקומות אחרים באזור.")}</p></div>;
}
