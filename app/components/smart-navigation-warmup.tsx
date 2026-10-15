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

  return null;
}
