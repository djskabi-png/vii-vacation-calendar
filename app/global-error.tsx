"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isReleaseAssetMismatch, recoverReleaseAssetMismatch } from "./lib/release-asset-recovery";
import { finishNavigationFeedback, recoverRouteBoundaryOnce } from "./lib/navigation-recovery";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(true);
  const language = typeof document === "undefined" ? "he" : document.documentElement.lang.split("-")[0];
  const assetLoadFailure = isReleaseAssetMismatch(error);
  useEffect(() => {
    let active = true;
    let fallbackTimer = 0;
    const stopRecovering = () => {
      if (!active) return;
      finishNavigationFeedback();
      setRecovering(false);
    };
    const recover = async () => {
      if (assetLoadFailure) {
        if (!await recoverReleaseAssetMismatch(error, "global")) stopRecovering();
        return;
      }
      const started = recoverRouteBoundaryOnce({
        currentHref: window.location.href,
        now: Date.now(),
        storage: window.sessionStorage,
        schedule: callback => window.requestAnimationFrame(callback),
        reset,
      });
      if (!started) { stopRecovering(); return; }
      fallbackTimer = window.setTimeout(stopRecovering, 3_500);
    };
    void recover();
    return () => { active = false; window.clearTimeout(fallbackTimer); };
  }, [assetLoadFailure, error, reset]);
  const labels = {
    he: ["לא הצלחנו להשלים את הטעינה", "אפשר לנסות שוב. אם התקלה נמשכת, חזרו לדף הבית.", "לנסות שוב", "לדף הבית", "מחזירים את האתר לפעולה", "עוד רגע אפשר להמשיך מאותה נקודה"],
    en: ["We could not complete loading", "Try again. If the problem continues, return to the homepage.", "Try again", "Homepage", "Restoring the site", "You can continue from the same place shortly"],
    ru: ["Не удалось завершить загрузку", "Попробуйте снова. Если проблема не исчезнет, вернитесь на главную страницу.", "Попробовать снова", "Главная", "Восстанавливаем сайт", "Скоро можно будет продолжить с того же места"],
    fr: ["Le chargement n’a pas pu être terminé", "Réessayez. Si le problème persiste, revenez à l’accueil.", "Réessayer", "Accueil", "Rétablissement du site", "Vous pourrez bientôt reprendre au même endroit"],
  }[language as "he" | "en" | "ru" | "fr"] || ["לא הצלחנו להשלים את הטעינה", "אפשר לנסות שוב. אם התקלה נמשכת, חזרו לדף הבית.", "לנסות שוב", "לדף הבית", "מחזירים את האתר לפעולה", "עוד רגע אפשר להמשיך מאותה נקודה"];
  const direction = language === "he" ? "rtl" : "ltr";
  if (recovering) return <html lang={language} dir={direction}><body style={{ margin: 0 }}><main className="route-recovery-loading" id="main-content" aria-busy="true" aria-live="polite">
    <section><span className="route-recovery-loading__mark" aria-hidden="true"><i /><i /><i /></span><h1>{labels[4]}</h1><p>{labels[5]}</p></section>
    <div className="route-recovery-loading__skeleton" aria-hidden="true"><i /><i /><i /></div>
  </main></body></html>;
  return <html lang={language} dir={direction}><body><main className="error-state-page" id="main-content">
    <section className="empty-state" role="alert">
      <h1>{labels[0]}</h1>
      <p>{labels[1]}</p>
      <div className="error-state-page__actions">
        <button className="button primary" type="button" onClick={() => assetLoadFailure ? window.location.reload() : reset()}>{labels[2]}</button>
        <Link className="button secondary" href="/">{labels[3]}</Link>
      </div>
    </section>
  </main></body></html>;
}
