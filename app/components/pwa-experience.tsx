"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CircleCheck, Download, RefreshCw, WifiOff, X } from "lucide-react";
import { useSiteLanguage } from "../i18n/locale-provider";
import type { SiteLanguage } from "../i18n/locale-routing";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type PwaState = { installPrompt: InstallPrompt | null; installed: boolean; ios: boolean; update: ServiceWorker | null; offline: boolean };
const initialState: PwaState = { installPrompt: null, installed: false, ios: false, update: null, offline: false };
const copy: Record<SiteLanguage, { install: string; installed: string; update: string; offline: string; ios: string; browser: string; close: string }> = {
  he: { install: "התקנת האפליקציה", installed: "האפליקציה מותקנת", update: "עדכון האפליקציה", offline: "אין כרגע חיבור. אפשר להמשיך בעמודים שכבר נפתחו.", ios: "ב־iPhone וב־iPad: פתחו שיתוף ובחרו „הוספה למסך הבית”.", browser: "להתקנה, פתחו את תפריט הדפדפן ובחרו „התקנת האפליקציה” או „הוספה למסך הבית”.", close: "סגירה" },
  en: { install: "Install app", installed: "App installed", update: "Update app", offline: "You are offline. Pages you already opened remain available.", ios: "On iPhone and iPad, open Share and choose Add to Home Screen.", browser: "To install, open your browser menu and choose Install app or Add to Home Screen.", close: "Close" },
  fr: { install: "Installer l’application", installed: "Application installée", update: "Mettre à jour", offline: "Vous êtes hors ligne. Les pages déjà ouvertes restent disponibles.", ios: "Sur iPhone et iPad, ouvrez Partager puis Ajouter à l’écran d’accueil.", browser: "Pour l’installer, ouvrez le menu du navigateur puis choisissez Installer l’application ou Ajouter à l’écran d’accueil.", close: "Fermer" },
  ru: { install: "Установить приложение", installed: "Приложение установлено", update: "Обновить приложение", offline: "Нет подключения. Ранее открытые страницы остаются доступными.", ios: "На iPhone и iPad откройте «Поделиться» и выберите «На экран Домой».", browser: "Для установки откройте меню браузера и выберите «Установить приложение» или «На экран Домой».", close: "Закрыть" },
};

let snapshot = initialState;
const listeners = new Set<(state: PwaState) => void>();
function publish(next: Partial<PwaState>) { snapshot = { ...snapshot, ...next }; listeners.forEach((listener) => listener(snapshot)); }
function usePwaState() {
  return useSyncExternalStore(
    (notify) => { const listener = () => notify(); listeners.add(listener); return () => listeners.delete(listener); },
    () => snapshot,
    () => initialState,
  );
}

export function PwaExperience() {
  const { language } = useSiteLanguage();
  const state = usePwaState();
  useEffect(() => {
    const installed = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    publish({ installed, ios: /iphone|ipad|ipod/i.test(navigator.userAgent), offline: !navigator.onLine });
    const online = () => publish({ offline: false });
    const offline = () => publish({ offline: true });
    const beforeInstall = (event: Event) => { event.preventDefault(); publish({ installPrompt: event as InstallPrompt }); };
    const installedEvent = () => publish({ installed: true, installPrompt: null });
    addEventListener("online", online); addEventListener("offline", offline);
    addEventListener("beforeinstallprompt", beforeInstall); addEventListener("appinstalled", installedEvent);
    if (!("serviceWorker" in navigator) || (location.protocol !== "https:" && location.hostname !== "localhost")) {
      return () => {
        removeEventListener("online", online); removeEventListener("offline", offline);
        removeEventListener("beforeinstallprompt", beforeInstall); removeEventListener("appinstalled", installedEvent);
      };
    }
    let refreshing = false;
    const controlled = () => { if (!refreshing) { refreshing = true; location.reload(); } };
    navigator.serviceWorker.addEventListener("controllerchange", controlled);
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      if (registration.waiting) publish({ update: registration.waiting });
      registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", () => {
        if (registration.installing?.state === "installed" && navigator.serviceWorker.controller) publish({ update: registration.installing });
      }));
    }).catch(() => undefined);
    return () => {
      removeEventListener("online", online); removeEventListener("offline", offline);
      removeEventListener("beforeinstallprompt", beforeInstall); removeEventListener("appinstalled", installedEvent);
      navigator.serviceWorker.removeEventListener("controllerchange", controlled);
    };
  }, []);
  if (!state.offline) return null;
  return <div className="pwa-status" role="status"><WifiOff size={18} aria-hidden="true" /><span>{copy[language].offline}</span></div>;
}

export function PwaInstallControl() {
  const { language } = useSiteLanguage();
  const state = usePwaState();
  const [installHelp, setInstallHelp] = useState(false);
  const label = state.update ? copy[language].update : state.installed ? copy[language].installed : copy[language].install;
  const act = async () => {
    if (state.update) { state.update.postMessage({ type: "SKIP_WAITING" }); return; }
    if (state.installed) return;
    if (state.installPrompt) { await state.installPrompt.prompt(); const choice = await state.installPrompt.userChoice; if (choice.outcome === "accepted") publish({ installPrompt: null }); return; }
    setInstallHelp(true);
  };
  const Icon = state.update ? RefreshCw : state.installed ? CircleCheck : Download;
  return <><button type="button" className={`footer-pwa-button${state.installed && !state.update ? " is-installed" : ""}`} onClick={() => void act()} disabled={state.installed && !state.update}><Icon size={16} aria-hidden="true" />{label}</button>{installHelp ? <div className="pwa-install-help" role="dialog" aria-modal="true" aria-label={label}><p>{state.ios ? copy[language].ios : copy[language].browser}</p><button type="button" onClick={() => setInstallHelp(false)} aria-label={copy[language].close}><X size={18} aria-hidden="true" /></button></div> : null}</>;
}
