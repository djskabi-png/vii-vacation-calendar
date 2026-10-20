"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { languageFromPathname, localizedPath, stripLanguagePrefix } from "../i18n/locale-routing";

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
    const warmed = new Set<string>();
    const warmAnchor = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//") || href.startsWith("/api/")) return;
      const destination = localizedPath(href, languageFromPathname(window.location.pathname));
      const basePath = stripLanguagePrefix(new URL(destination, window.location.origin).pathname);
      if (/^\/(?:admin|account|favorites|booking)(?:\/|$)/.test(basePath) || warmed.has(destination)) return;
      warmed.add(destination);
      router.prefetch(destination);
      if (warmed.size > 24) warmed.delete(warmed.values().next().value!);
    };
    const onPointerOver = (event: PointerEvent) => warmAnchor(event.target);
    const onFocusIn = (event: FocusEvent) => warmAnchor(event.target);
    const onTouchStart = (event: TouchEvent) => warmAnchor(event.target);
    document.addEventListener("pointerover", onPointerOver, { passive: true, capture: true });
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("touchstart", onTouchStart, true);
    };
  }, [router]);

  return null;
}
