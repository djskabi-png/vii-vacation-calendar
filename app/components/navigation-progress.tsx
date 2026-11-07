"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { NAVIGATION_START_EVENT, NAVIGATION_RECOVERY_DELAY_MS, recoverStalledNavigation } from "../lib/navigation-recovery";
import { useSiteLanguage } from "../i18n/locale-provider";

export function NavigationProgress() {
  const { translate } = useSiteLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHref = useRef<string | null>(null);
  const committedRoute = useRef(`${pathname}?${searchParams.toString()}`);

  useEffect(() => {
    document.documentElement.dataset.navigationProgressReady = "true";
    const committed = `${pathname}?${searchParams.toString()}`;
    committedRoute.current = committed;
    const pending = pendingHref.current ? new URL(pendingHref.current, window.location.href) : null;
    if (!pending || `${pending.pathname}?${pending.searchParams.toString()}` === committed) {
      setActive(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pendingHref.current = null;
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const begin = (href: string) => {
      const next = new URL(href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (`${next.pathname}?${next.searchParams.toString()}` === committedRoute.current) {
        if (timer.current) clearTimeout(timer.current);
        pendingHref.current = null;
        setActive(false);
        return;
      }
      pendingHref.current = next.href;
      setActive(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (pendingHref.current !== next.href) return;
        try {
          recoverStalledNavigation(next.href, { currentHref: window.location.href, now: Date.now(), storage: window.sessionStorage, replace: value => window.location.replace(value) });
        } catch { /* Browser storage policy can disable automatic recovery. */ }
      }, NAVIGATION_RECOVERY_DELAY_MS);
    };
    const transition = (event: Event) => begin((event as CustomEvent<{ href: string }>).detail.href);
    const start = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;
      begin(next.href);
    };
    document.addEventListener("click", start, true);
    window.addEventListener(NAVIGATION_START_EVENT, transition);
    return () => {
      document.removeEventListener("click", start, true);
      window.removeEventListener(NAVIGATION_START_EVENT, transition);
      if (timer.current) clearTimeout(timer.current);
      delete document.documentElement.dataset.navigationProgressReady;
    };
  }, []);

  return <div className={active ? "navigation-progress is-active" : "navigation-progress"} role="status" aria-live="polite" aria-hidden={!active}>
    <span className="navigation-progress__label">{translate("טוענים את העמוד")}</span><i />
  </div>;
}
