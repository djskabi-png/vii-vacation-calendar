"use client";

import Link from "next/link";
import { useEffect } from "react";

const RECOVERY_KEY = "vii:release-asset-recovery";
const RECOVERY_WINDOW_MS = 60_000;

function isReleaseAssetMismatch(error: Error) {
  return /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch RSC payload/i.test(error.message);
}

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (!isReleaseAssetMismatch(error)) return;
    const lastRecovery = Number(sessionStorage.getItem(RECOVERY_KEY) || 0);
    if (Number.isFinite(lastRecovery) && Date.now() - lastRecovery <= RECOVERY_WINDOW_MS) return;
    sessionStorage.setItem(RECOVERY_KEY, String(Date.now()));
    void caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("vii-public-")).map((key) => caches.delete(key))))
      .finally(() => location.reload());
  }, [error]);
  const language = typeof document === "undefined" ? "he" : document.documentElement.lang.split("-")[0];
  const labels = {
    he: ["העמוד לא נטען במלואו", "המידע נשמר. אפשר לנסות לטעון שוב או לחזור לדף הבית.", "לטעון שוב", "לדף הבית"],
    en: ["The page did not load completely", "Your information is preserved. Try loading again or return to the homepage.", "Load again", "Homepage"],
    ru: ["Страница загрузилась не полностью", "Данные сохранены. Попробуйте загрузить снова или вернитесь на главную страницу.", "Загрузить снова", "Главная"],
    fr: ["La page ne s’est pas chargée complètement", "Vos informations sont conservées. Rechargez la page ou revenez à l’accueil.", "Recharger", "Accueil"],
  }[language as "he" | "en" | "ru" | "fr"] || ["העמוד לא נטען במלואו", "המידע נשמר. אפשר לנסות לטעון שוב או לחזור לדף הבית.", "לטעון שוב", "לדף הבית"];
  return <main className="error-state-page" id="main-content">
    <section className="empty-state" role="alert">
      <h1>{labels[0]}</h1>
      <p>{labels[1]}</p>
      <div className="error-state-page__actions">
        <button className="button primary" type="button" onClick={reset}>{labels[2]}</button>
        <Link className="button secondary" href="/">{labels[3]}</Link>
      </div>
    </section>
  </main>;
}
