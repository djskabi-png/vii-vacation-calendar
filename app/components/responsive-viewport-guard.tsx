"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function resetHorizontalViewport() {
  const scrollingElement = document.scrollingElement as HTMLElement | null;
  if (scrollingElement?.scrollLeft) scrollingElement.scrollLeft = 0;
  if (document.documentElement.scrollLeft) document.documentElement.scrollLeft = 0;
  if (document.body.scrollLeft) document.body.scrollLeft = 0;
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
    const lockHorizontalScroll = () => {
      const scrollingElement = document.scrollingElement as HTMLElement | null;
      if (!scrollingElement?.scrollLeft && !document.documentElement.scrollLeft && !document.body.scrollLeft) return;
      reset();
    };

    resetHorizontalViewport();
    window.addEventListener("pageshow", reset);
    window.addEventListener("popstate", reset);
    window.addEventListener("scroll", lockHorizontalScroll, { passive: true });
    window.addEventListener("resize", reset);
    window.addEventListener("orientationchange", reset);
    window.addEventListener("touchend", reset, { passive: true });
    window.visualViewport?.addEventListener("resize", reset);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("popstate", reset);
      window.removeEventListener("scroll", lockHorizontalScroll);
      window.removeEventListener("resize", reset);
      window.removeEventListener("orientationchange", reset);
      window.removeEventListener("touchend", reset);
      window.visualViewport?.removeEventListener("resize", reset);
    };
  }, [pathname, searchKey]);

  return null;
}
