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
    const home = localizedPath("/", languageFromPathname(pathname));
    // The homepage is the primary escape route from every world. Start its
    // App Router request as soon as this page hydrates so an early logo click
    // does not beat an idle callback. Next deduplicates repeat prefetches.
    router.prefetch(home);
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
      const opensNewTab = anchor.target === "_blank";
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
    const onTouchStart = () => { /* A tap must never start a competing document fetch. */ };
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
