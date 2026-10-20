"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function resetHorizontalViewport() {
  const scrollingElement = document.scrollingElement as HTMLElement | null;
  if (scrollingElement?.scrollLeft) scrollingElement.scrollLeft = 0;
  if (document.documentElement.scrollLeft) document.documentElement.scrollLeft = 0;
  if (document.body.scrollLeft) document.body.scrollLeft = 0;
}

function resetHorizontalCollections() {
  document.querySelectorAll<HTMLElement>("[data-horizontal-rail]").forEach((rail) => {
    rail.scrollLeft = 0;
  });
}

function releaseStaleViewportLocks() {
  if (!window.matchMedia("(min-width: 821px)").matches) return;
  const body = document.body;
  if (body.hasAttribute("data-map-overlay-lock")) {
    body.style.position = "";
    body.style.top = "";
    body.style.insetInline = "";
    body.style.width = "";
    body.style.overflow = "";
    body.removeAttribute("data-map-overlay-lock");
  }
  document.documentElement.style.scrollBehavior = "";
}

export function ResponsiveViewportGuard() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useEffect(() => {
    const footer = document.querySelector(".site-footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => {
      document.body.toggleAttribute("data-public-footer-visible", entry.isIntersecting);
    });
    observer.observe(footer);
    return () => { observer.disconnect(); document.body.removeAttribute("data-public-footer-visible"); };
  }, [pathname]);

  useEffect(() => {
    const visible = new Set<HTMLElement>();
    const availabilityVisible = new Set<HTMLElement>();
    const update = () => document.body.toggleAttribute("data-map-results-visible", visible.size > 0 && availabilityVisible.size === 0);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const region = entry.target as HTMLElement;
        const target = region.matches(".regional-availability") ? availabilityVisible : visible;
        if (entry.isIntersecting) target.add(region); else target.delete(region);
      });
      update();
    }, { threshold: 0, rootMargin: "-12% 0px -12% 0px" });
    const observed = new Set<HTMLElement>();
    const attach = () => {
      observed.forEach((region) => {
        if (!region.isConnected) { observer.unobserve(region); observed.delete(region); visible.delete(region); availabilityVisible.delete(region); }
      });
      document.querySelectorAll<HTMLElement>(".mobile-map-fab").forEach((button) => {
        const region = button.closest<HTMLElement>(".results-list, .trail-explorer, .hourly-results, .attraction-explorer, .world-map-results, .event-list") || button.parentElement;
        if (region && !observed.has(region)) { observed.add(region); observer.observe(region); }
      });
      document.querySelectorAll<HTMLElement>(".regional-availability").forEach((region) => {
        if (!observed.has(region)) { observed.add(region); observer.observe(region); }
      });
      update();
    };
    attach();
    let attachFrame = 0;
    const scheduleAttach = () => {
      if (attachFrame) return;
      attachFrame = window.requestAnimationFrame(() => {
        attachFrame = 0;
        attach();
      });
    };
    const mutationObserver = new MutationObserver(scheduleAttach);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    return () => { window.cancelAnimationFrame(attachFrame); observer.disconnect(); mutationObserver.disconnect(); document.body.removeAttribute("data-map-results-visible"); };
  }, [pathname, searchKey]);

  useEffect(() => {
    let frame = window.requestAnimationFrame(resetHorizontalViewport);
    let timer = window.setTimeout(resetHorizontalViewport, 80);
    const reset = () => {
      releaseStaleViewportLocks();
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
    resetHorizontalCollections();
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
