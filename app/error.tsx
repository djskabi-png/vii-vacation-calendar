"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isReleaseAssetMismatch, recoverReleaseAssetMismatch } from "./lib/release-asset-recovery";
import { finishNavigationFeedback, recoverRouteBoundaryOnce } from "./lib/navigation-recovery";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [recovering, setRecovering] = useState(true);
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
        if (!await recoverReleaseAssetMismatch(error, "route")) stopRecovering();
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
  const language = typeof document === "undefined" ? "he" : document.documentElement.lang.split("-")[0];
  const labels = {
    he: ["לא הצלחנו לפתוח את העמוד", "אפשר לנסות שוב. אם התקלה חוזרת, חזרו לדף הבית.", "לנסות שוב", "לדף הבית", "פותחים את העמוד", "מבצעים התאוששות מהירה ושומרים על הבחירה שלכם"],
    en: ["We could not open the page", "Try again. If the problem returns, go back to the homepage.", "Try again", "Homepage", "Opening the page", "Recovering quickly while keeping your selection"],
    ru: ["Не удалось открыть страницу", "Попробуйте снова. Если проблема повторится, вернитесь на главную.", "Попробовать снова", "Главная", "Открываем страницу", "Быстро восстанавливаем загрузку и сохраняем ваш выбор"],
    fr: ["Impossible d’ouvrir la page", "Réessayez. Si le problème revient, retournez à l’accueil.", "Réessayer", "Accueil", "Ouverture de la page", "Récupération rapide tout en conservant votre sélection"],
  }[language as "he" | "en" | "ru" | "fr"] || ["לא הצלחנו לפתוח את העמוד", "אפשר לנסות שוב. אם התקלה חוזרת, חזרו לדף הבית.", "לנסות שוב", "לדף הבית", "פותחים את העמוד", "מבצעים התאוששות מהירה ושומרים על הבחירה שלכם"];
  if (recovering) return <main className="route-recovery-loading" id="main-content" aria-busy="true" aria-live="polite">
    <section><span className="route-recovery-loading__mark" aria-hidden="true"><i /><i /><i /></span><h1>{labels[4]}</h1><p>{labels[5]}</p></section>
    <div className="route-recovery-loading__skeleton" aria-hidden="true"><i /><i /><i /></div>
  </main>;
  return <main className="error-state-page" id="main-content">
    <section className="empty-state" role="alert">
      <h1>{labels[0]}</h1>
      <p>{labels[1]}</p>
      <div className="error-state-page__actions">
        <button className="button primary" type="button" onClick={() => assetLoadFailure ? location.reload() : reset()}>{labels[2]}</button>
        <Link className="button secondary" href="/">{labels[3]}</Link>
      </div>
    </section>
  </main>;
}
