"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "../../components/page-shell";
import { discoveryItems } from "../../data/world-data";
import { useSiteLanguage } from "../../i18n/locale-provider";

export default function LegacyDiscoveryPlaceRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { language, translate } = useSiteLanguage();
  const id = searchParams.get("id") || "";
  const item = discoveryItems.find((entry) => entry.id === id);

  useEffect(() => {
    if (item) router.replace(`/discover/place/${encodeURIComponent(item.id)}`);
  }, [item, router]);

  if (!item) {
    return <PageShell><main id="main-content"><section className="not-found shell"><span>404</span><h1>{translate("העמוד שחיפשתם לא נמצא")}</h1><p>{translate("אפשר לחזור לדף הבית או להתחיל חיפוש חדש.")}</p><div><Link className="button primary" href="/">{translate("לדף הבית")}</Link><Link className="button subtle" href="/search">{translate("לחיפוש חופשה")}</Link></div></section></main></PageShell>;
  }

  const loading = {
    he: { title: `${translate("טוענים את המקומות שאהבתי")} ${item.name}`, text: translate("פותחים את המקומות שאהבתי...") },
    en: { title: `Opening ${translate(item.name)}`, text: "Taking you to the full page now." },
    ru: { title: `Открываем ${translate(item.name)}`, text: "Переходим на полную страницу." },
    fr: { title: `Ouverture de ${translate(item.name)}`, text: "Redirection vers la page complète." },
  }[language];
  return <PageShell><main id="main-content"><section className="favorites-loading" role="status" aria-live="polite"><span aria-hidden="true" /><h1>{loading.title}</h1><p>{loading.text}</p></section></main></PageShell>;
}
