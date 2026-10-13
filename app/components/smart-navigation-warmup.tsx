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
    const warm = () => router.prefetch(home);
    const browser = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (browser.requestIdleCallback) {
      const id = browser.requestIdleCallback(warm, { timeout: 1200 });
      return () => browser.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(warm, 500);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  return null;
}
