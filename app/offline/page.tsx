"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";

const copy = {
  he: ["אין כרגע חיבור", "אפשר לחזור לדף הבית או לנסות שוב כשהחיבור חוזר.", "חזרה לדף הבית"],
  en: ["You’re offline", "Return home or try again when your connection is restored.", "Back to home"],
  fr: ["Vous êtes hors ligne", "Revenez à l’accueil ou réessayez lorsque la connexion sera rétablie.", "Retour à l’accueil"],
  ru: ["Нет подключения", "Вернитесь на главную или повторите попытку после восстановления связи.", "На главную"],
} as const;

export default function OfflinePage() {
  const { language } = useSiteLanguage();
  const [title, message, action] = copy[language];
  return <main id="main-content" className="offline-page"><WifiOff size={42} aria-hidden="true" /><h1>{title}</h1><p>{message}</p><Link href={language === "he" ? "/" : `/${language}`}>{action}</Link></main>;
}
