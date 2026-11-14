"use client";

import { useEffect, useState } from "react";
import { ErrorRecoverySurface } from "./components/error-recovery-surface";
import { isReleaseAssetMismatch, recoverReleaseAssetMismatch } from "./lib/release-asset-recovery";
import { finishNavigationFeedback, recoverRouteBoundaryOnce, recoverStalledNavigation } from "./lib/navigation-recovery";

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
    const tryDocumentRecovery = () => {
      finishNavigationFeedback();
      const started = recoverStalledNavigation(window.location.href, {
        currentHref: window.location.href,
        now: Date.now(),
        storage: window.sessionStorage,
        replace: value => window.location.replace(value),
      });
      if (!started) stopRecovering();
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
      if (!started) { tryDocumentRecovery(); return; }
      fallbackTimer = window.setTimeout(tryDocumentRecovery, 1_800);
    };
    void recover();
    return () => { active = false; window.clearTimeout(fallbackTimer); };
  }, [assetLoadFailure, error, reset]);
  const labels = {
    he: { title: recovering ? "מחזירים את האתר לפעולה" : "הטעינה לא הושלמה", body: recovering ? "מבצעים ניסיון התאוששות קצר ושומרים על הכתובת והבחירות שלכם." : "החיבור לא הושלם. אפשר לנסות שוב בלי לאבד את הכתובת שבחרתם.", status: recovering ? "מתחברים מחדש" : "הטעינה נעצרה", retry: "לנסות שוב", home: "לדף הבית", preserved: "הכתובת והבחירות שלכם נשמרות" },
    en: { title: recovering ? "Restoring the site" : "Loading did not complete", body: recovering ? "Running a short recovery while preserving your address and selections." : "The connection did not complete. Try again without losing the address you selected.", status: recovering ? "Reconnecting" : "Loading stopped", retry: "Try again", home: "Homepage", preserved: "Your address and selections are preserved" },
    ru: { title: recovering ? "Восстанавливаем сайт" : "Загрузка не завершилась", body: recovering ? "Выполняем короткое восстановление, сохраняя адрес и выбранные параметры." : "Подключение не завершилось. Повторите попытку без потери выбранного адреса.", status: recovering ? "Подключаемся снова" : "Загрузка остановлена", retry: "Попробовать снова", home: "Главная", preserved: "Адрес и выбранные параметры сохранены" },
    fr: { title: recovering ? "Rétablissement du site" : "Le chargement n’a pas abouti", body: recovering ? "Nous lançons une courte récupération tout en conservant votre adresse et vos choix." : "La connexion n’a pas abouti. Réessayez sans perdre l’adresse sélectionnée.", status: recovering ? "Reconnexion" : "Chargement interrompu", retry: "Réessayer", home: "Accueil", preserved: "Votre adresse et vos choix sont conservés" },
  }[language as "he" | "en" | "ru" | "fr"] || { title: recovering ? "מחזירים את האתר לפעולה" : "הטעינה לא הושלמה", body: recovering ? "מבצעים ניסיון התאוששות קצר ושומרים על הכתובת והבחירות שלכם." : "החיבור לא הושלם. אפשר לנסות שוב בלי לאבד את הכתובת שבחרתם.", status: recovering ? "מתחברים מחדש" : "הטעינה נעצרה", retry: "לנסות שוב", home: "לדף הבית", preserved: "הכתובת והבחירות שלכם נשמרות" };
  const direction = language === "he" ? "rtl" : "ltr";
  return <html lang={language} dir={direction}><body style={{ margin: 0 }}><ErrorRecoverySurface labels={labels} recovering={recovering} onRetry={() => window.location.reload()} /></body></html>;
}
