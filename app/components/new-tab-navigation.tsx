"use client";

import { useEffect } from "react";
import { isBusinessDepthRoute } from "../lib/new-tab-policy";

function shouldOpenInNewTab(anchor: HTMLAnchorElement) {
  if (anchor.hasAttribute("target") || anchor.hasAttribute("download")) return false;
  const rawHref = anchor.getAttribute("href") || "";
  if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|sms:|javascript:)/i.test(rawHref)) return false;

  const url = new URL(anchor.href, window.location.href);
  if (!/^https?:$/.test(url.protocol)) return false;
  if (url.origin !== window.location.origin) return true;
  if (anchor.closest("[data-keep-same-tab='true']")) return false;

  return isBusinessDepthRoute(url.pathname);
}

function normalizeBusinessDetailLink(anchor: HTMLAnchorElement) {
  const rawHref = anchor.getAttribute("href") || "";
  if (!rawHref || rawHref.startsWith("#")) return false;
  const url = new URL(anchor.href, window.location.href);
  const path = url.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
  if (url.origin !== window.location.origin || !isBusinessDepthRoute(path)) return false;
  if (anchor.hasAttribute("download")) return false;
  // React renders the approved desktop target in the shared markup. On
  // mobile the place click must remain an App Router transition. Keep the
  // observer from restoring target=_blank between the component onClick and
  // Next's own handler, otherwise the same tap starts Flight and then falls
  // through to a full document navigation.
  if (window.matchMedia("(max-width: 760px)").matches) {
    if (anchor.hasAttribute("target")) anchor.removeAttribute("target");
    return true;
  }
  if (anchor.target !== "_blank") anchor.target = "_blank";
  const rel = [...new Set([...(anchor.getAttribute("rel") || "").split(/\s+/).filter(Boolean), "noopener", "noreferrer"])].join(" ");
  if (anchor.rel !== rel) anchor.rel = rel;
  return true;
}

function applyNewTabPolicy(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    if (normalizeBusinessDetailLink(anchor)) return;
    if (!shouldOpenInNewTab(anchor)) return;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  });
}

export function NewTabNavigation() {
  useEffect(() => {
    let observer: MutationObserver | null = null;
    const hydrationDelay = process.env.NODE_ENV === "development" ? 1_800 : 800;
    const timer = window.setTimeout(() => {
      applyNewTabPolicy(document);
      observer = new MutationObserver((records) => {
        records.forEach((record) => {
          if (record.type === "attributes" && record.target instanceof HTMLAnchorElement) {
            normalizeBusinessDetailLink(record.target);
            return;
          }
          record.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            if (node.matches("a[href]") && normalizeBusinessDetailLink(node as HTMLAnchorElement)) return;
            if (node.matches("a[href]") && shouldOpenInNewTab(node as HTMLAnchorElement)) {
              const anchor = node as HTMLAnchorElement;
              anchor.target = "_blank";
              anchor.rel = "noopener noreferrer";
            }
            applyNewTabPolicy(node);
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["target", "rel"] });
    }, hydrationDelay);
    const normalizeMobileClick = (event: MouseEvent) => {
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (anchor) normalizeBusinessDetailLink(anchor);
    };
    document.addEventListener("click", normalizeMobileClick, true);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener("click", normalizeMobileClick, true);
    };
  }, []);

  return null;
}
