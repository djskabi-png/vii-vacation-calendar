"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAVIGATION_END_EVENT, NAVIGATION_START_EVENT, NAVIGATION_RECOVERY_DELAY_MS, recoverStalledNavigation } from "../lib/navigation-recovery";
import { useSiteLanguage } from "../i18n/locale-provider";
import { catalogNavigationFetch } from '../lib/catalog-navigation-fetch';
import { hasFreshPublishedSearchCatalog } from '../lib/published-catalog-client-cache';

declare const __VII_CACHE_BUILD_ID__: string;

export function NavigationProgress() {
  useEffect(() => {
    const previous = window.fetch;
    const wrapped = catalogNavigationFetch(
      previous.bind(window),
      window.location.origin,
      () => hasFreshPublishedSearchCatalog('vacations'),
      {
        clientBuild: typeof __VII_CACHE_BUILD_ID__ === 'string' ? __VII_CACHE_BUILD_ID__ : 'local',
        storage: window.sessionStorage,
        replace: href => window.location.replace(href),
      },
    );
    window.fetch = wrapped;
    return () => { if (window.fetch === wrapped) window.fetch = previous; };
  }, []);
  const { language } = useSiteLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHref = useRef<string | null>(null);
  const committedRoute = useRef(`${pathname}?${searchParams.toString()}`);

  useEffect(() => {
    document.documentElement.dataset.navigationProgressReady = "true";
    const committed = `${pathname}?${searchParams.toString()}`;
    const previousCommitted = committedRoute.current;
    committedRoute.current = committed;
    const pending = pendingHref.current ? new URL(pendingHref.current, window.location.href) : null;
    // A canonical redirect or server-side query normalization can commit a
    // valid destination whose serialized URL differs from the clicked href.
    // Any real route commit after begin must finish the visual feedback.
    if (!pending || committed !== previousCommitted || `${pending.pathname}?${pending.searchParams.toString()}` === committed) {
      delete document.documentElement.dataset.navigationPending;
      setActive(false);
      if (timer.current) clearTimeout(timer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      timer.current = null;
      feedbackTimer.current = null;
      pendingHref.current = null;
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const begin = (href: string) => {
      const next = new URL(href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (`${next.pathname}?${next.searchParams.toString()}` === committedRoute.current) {
        if (timer.current) clearTimeout(timer.current);
        if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
        timer.current = null;
        feedbackTimer.current = null;
        delete document.documentElement.dataset.navigationPending;
        pendingHref.current = null;
        setActive(false);
        return;
      }
      pendingHref.current = next.href;
      document.documentElement.dataset.navigationPending = "true";
      setActive(true);
      if (timer.current) clearTimeout(timer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      // Feedback must never become a permanent blur. Recovery remains armed
      // independently below, but the current page is always usable.
      feedbackTimer.current = setTimeout(() => {
        delete document.documentElement.dataset.navigationPending;
        setActive(false);
      }, 4_000);
      timer.current = setTimeout(() => {
        if (pendingHref.current !== next.href) return;
        try {
          recoverStalledNavigation(next.href, { currentHref: window.location.href, now: Date.now(), storage: window.sessionStorage, replace: value => window.location.replace(value) });
        } catch { /* Browser storage policy can disable automatic recovery. */ }
      }, NAVIGATION_RECOVERY_DELAY_MS);
    };
    const transition = (event: Event) => begin((event as CustomEvent<{ href: string }>).detail.href);
    const finish = () => {
      delete document.documentElement.dataset.navigationPending;
      setActive(false);
      pendingHref.current = null;
      if (timer.current) clearTimeout(timer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      timer.current = null;
      feedbackTimer.current = null;
    };
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download")) return;
      // Place links intentionally keep target=_blank for desktop. Their mobile
      // handler removes that target during the same click so they can use the
      // client router. Begin feedback during capture, before that handler runs.
      if (link.target === "_blank" && !window.matchMedia("(max-width: 760px)").matches) return;
      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      begin(next.href);
    };
    document.addEventListener("click", start, true);
    window.addEventListener(NAVIGATION_START_EVENT, transition);
    window.addEventListener(NAVIGATION_END_EVENT, finish);
    return () => {
      document.removeEventListener("click", start, true);
      window.removeEventListener(NAVIGATION_START_EVENT, transition);
      window.removeEventListener(NAVIGATION_END_EVENT, finish);
      if (timer.current) clearTimeout(timer.current);
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      delete document.documentElement.dataset.navigationPending;
      delete document.documentElement.dataset.navigationProgressReady;
    };
  }, []);

  const copy = {
    he: ["פותחים את העמוד", "עוד רגע התוכן מוכן"],
    en: ["Opening the page", "Your content will be ready shortly"],
    ru: ["Открываем страницу", "Контент скоро будет готов"],
    fr: ["Ouverture de la page", "Votre contenu sera bientôt prêt"],
  }[language];

  return <div className={active ? "navigation-progress is-active" : "navigation-progress"} role="status" aria-live="polite" aria-hidden={!active} aria-busy={active || undefined}>
    <span className="navigation-progress__bar" aria-hidden="true" />
    <span className="navigation-progress__panel" dir={language === "he" ? "rtl" : "ltr"}>
      <span className="navigation-progress__mark" aria-hidden="true"><i /><i /><i /></span>
      <span className="navigation-progress__label"><strong>{copy[0]}</strong><small>{copy[1]}</small></span>
    </span>
  </div>;
}
