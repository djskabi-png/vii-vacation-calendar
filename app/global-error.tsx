"use client";

import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const language = typeof document === "undefined" ? "he" : document.documentElement.lang.split("-")[0];
  const labels = {
    he: ["לא הצלחנו להשלים את הטעינה", "אפשר לנסות שוב. אם התקלה נמשכת, חזרו לדף הבית.", "לנסות שוב", "לדף הבית"],
    en: ["We could not complete loading", "Try again. If the problem continues, return to the homepage.", "Try again", "Homepage"],
    ru: ["Не удалось завершить загрузку", "Попробуйте снова. Если проблема не исчезнет, вернитесь на главную страницу.", "Попробовать снова", "Главная"],
    fr: ["Le chargement n’a pas pu être terminé", "Réessayez. Si le problème persiste, revenez à l’accueil.", "Réessayer", "Accueil"],
  }[language as "he" | "en" | "ru" | "fr"] || ["לא הצלחנו להשלים את הטעינה", "אפשר לנסות שוב. אם התקלה נמשכת, חזרו לדף הבית.", "לנסות שוב", "לדף הבית"];
  return <html lang="he" dir="rtl"><body><main className="error-state-page" id="main-content">
    <section className="empty-state" role="alert">
      <h1>{labels[0]}</h1>
      <p>{labels[1]}</p>
      <div className="error-state-page__actions">
        <button className="button primary" type="button" onClick={reset}>{labels[2]}</button>
        <Link className="button secondary" href="/">{labels[3]}</Link>
      </div>
    </section>
  </main></body></html>;
}
