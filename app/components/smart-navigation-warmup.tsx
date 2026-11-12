"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { languageFromPathname, localizedPath, stripLanguagePrefix } from "../i18n/locale-routing";
import { isBusinessDepthRoute } from "../lib/new-tab-policy";
import { createNavigationIntentWarmup, warmNavigationDocument } from "../lib/navigation-intent-warmup";

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

export function SmartNavigationWarmup() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const basePath = stripLanguagePrefix(pathname);
    if (basePath === "/" || /^\/(?:admin|account|favorites|booking)(?:\/|$)/.test(basePath)) return;
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return;
    const language = languageFromPathname(pathname);
    const home = localizedPath("/", language);
    // The homepage is the primary escape route from every world. Start its
    // App Router request as soon as this page hydrates so an early logo click
    // does not beat an idle callback. Next deduplicates repeat prefetches.
    router.prefetch(home);
    // The four primary worlds are the highest-frequency cross-site journeys.
    // Warm their RSC payloads once after hydration so touch navigation does
    // not pay a multi-second cold-route penalty after the user's tap.
    for (const route of ["/events", "/spas", "/hourly"]) {
      const destination = localizedPath(route, language);
      if (stripLanguagePrefix(destination) !== basePath) router.prefetch(destination);
    }
  }, [pathname, router]);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") return;
    const warmup = createNavigationIntentWarmup({
      prefetch: (destination) => router.prefetch(destination),
      document: warmNavigationDocument,
    });
    const dwell = new Map<string, number>();
    const warmAnchor = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) return;
      const destination = localizedPath(href, languageFromPathname(window.location.pathname));
      const basePath = stripLanguagePrefix(new URL(destination, window.location.origin).pathname);
      if (/^\/(?:admin|account|favorites|booking)(?:\/|$)/.test(basePath)) return;
      // Detail routes that intentionally open in a new tab cannot reuse the
      // current tab's App Router cache. Warm only the document for those
      // destinations, rather than rendering both HTML and Flight on one hover.
      if (dwell.has(destination)) return;
      // Place links deliberately retain target=_blank on desktop. On mobile
      // the click handler removes that target and Next performs an in-app
      // transition, so warming a full HTML document here would race the RSC
      // transition and make the origin do the same place work twice.
      const mobileSameTab = window.matchMedia("(max-width: 760px)").matches && isBusinessDepthRoute(basePath);
      const opensNewTab = anchor.target === "_blank" && !mobileSameTab;
      dwell.set(destination, window.setTimeout(() => {
        dwell.delete(destination);
        warmup.warm(destination, opensNewTab || isBusinessDepthRoute(basePath));
      }, 160));
    };
    const cancelAnchor = (target: EventTarget | null, relatedTarget: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;
      if (relatedTarget instanceof Node && anchor.contains(relatedTarget)) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      const destination = localizedPath(href, languageFromPathname(window.location.pathname));
      const timer = dwell.get(destination);
      if (timer !== undefined) { window.clearTimeout(timer); dwell.delete(destination); }
    };
    const onPointerOver = (event: PointerEvent) => warmAnchor(event.target);
    const onFocusIn = (event: FocusEvent) => warmAnchor(event.target);
    const onTouchStart = (event: TouchEvent) => {
      if (!(event.target instanceof Element) || !window.matchMedia("(max-width: 760px)").matches) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) return;
      const destination = localizedPath(href, languageFromPathname(window.location.pathname));
      const basePath = stripLanguagePrefix(new URL(destination, window.location.origin).pathname);
      if (!isBusinessDepthRoute(basePath)) return;
      // A synthetic pointerover may have armed desktop document speculation.
      // Cancel it before the tap. Do not start a second Flight request here:
      // the Link already owns viewport prefetch and the imminent navigation,
      // and a touchstart prefetch can race that navigation instead of being
      // reusable when the origin is cold.
      const timer = dwell.get(destination);
      if (timer !== undefined) { window.clearTimeout(timer); dwell.delete(destination); }
    };
    const onPointerOut = (event: PointerEvent) => cancelAnchor(event.target, event.relatedTarget);
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (link?.href) warmup.cancel(localizedPath(link.getAttribute("href") || link.href, languageFromPathname(window.location.pathname)));
    };
    document.addEventListener("pointerover", onPointerOver, { passive: true, capture: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true, capture: true });
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    document.addEventListener("click", onClick, true);
    return () => {
      warmup.dispose();
      dwell.forEach(timer => window.clearTimeout(timer));
      dwell.clear();
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);

  return null;
}
