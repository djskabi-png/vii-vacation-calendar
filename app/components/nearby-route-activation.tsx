"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";
import { requestNearbyOrigin } from "./use-nearby-sort";

export function NearbyRouteActivation({ regionalOnly = false }: { regionalOnly?: boolean }) {
  const { translate } = useSiteLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function activate() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      await requestNearbyOrigin();
      const next = new URLSearchParams(params.toString()); next.set("sort", "nearest");
      router.replace(`${pathname}?${next}`, { scroll: false });
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <section className="shell nearby-page-action" aria-label={translate("חיפוש לפי המיקום שלי")}>
    <div><strong>{translate("מה נמצא קרוב אליכם?")}</strong><p>{translate(regionalOnly ? "בחרו אזור בחיפוש או אשרו מיקום להשוואה לפי אזורי הטיול." : "בחרו אזור בחיפוש או אשרו מיקום כדי להציג את המקומות מהקרוב לרחוק.")}</p>
      {error && <p role="status">{translate("לא התקבל מיקום. אפשר לנסות שוב או לבחור אזור בחיפוש.")}</p>}</div>
    <button className="button primary" type="button" onClick={activate} disabled={busy} aria-busy={busy}><MapPin aria-hidden="true" />{translate(busy ? "מאתרים מיקום…" : "מצאו קרוב אליי")}</button>
  </section>;
}
