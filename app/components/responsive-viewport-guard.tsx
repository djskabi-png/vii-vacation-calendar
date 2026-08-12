"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function resetHorizontalViewport() {
  const scrollingElement = document.scrollingElement as HTMLElement | null;
  if (scrollingElement) scrollingElement.scrollLeft = 0;
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

export function ResponsiveViewportGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useEffect(() => {
    let frame = window.requestAnimationFrame(resetHorizontalViewport);
    let timer = window.setTimeout(resetHorizontalViewport, 80);
    const reset = () => {
      resetHorizontalViewport();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      frame = window.requestAnimationFrame(resetHorizontalViewport);
      timer = window.setTimeout(resetHorizontalViewport, 80);
    };

    resetHorizontalViewport();
    window.addEventListener("pageshow", reset);
    window.addEventListener("popstate", reset);
    window.addEventListener("resize", reset);
    window.addEventListener("orientationchange", reset);
    window.visualViewport?.addEventListener("resize", reset);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("popstate", reset);
      window.removeEventListener("resize", reset);
      window.removeEventListener("orientationchange", reset);
      window.visualViewport?.removeEventListener("resize", reset);
    };
  }, [pathname, searchKey]);

  return null;
}
