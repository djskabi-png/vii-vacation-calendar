"use client";

import { useEffect } from "react";

const depthRoutes = [
  /^\/business(?:\/|$)/,
  /^\/events\/place(?:\/|$)/,
  /^\/discover\/place(?:\/|$)/,
  /^\/guides\/[^/]+(?:\/|$)/,
  /^\/trails\/[^/]+(?:\/|$)/,
];

function shouldOpenInNewTab(anchor: HTMLAnchorElement) {
  if (anchor.hasAttribute("target") || anchor.hasAttribute("download")) return false;
  const rawHref = anchor.getAttribute("href") || "";
  if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|sms:|javascript:)/i.test(rawHref)) return false;

  const url = new URL(anchor.href, window.location.href);
  if (!/^https?:$/.test(url.protocol)) return false;
  if (url.origin !== window.location.origin) return true;
  if (anchor.closest("[data-keep-same-tab='true']")) return false;

  const localizedPath = url.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
  return depthRoutes.some((pattern) => pattern.test(localizedPath));
}

function applyNewTabPolicy(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    if (!shouldOpenInNewTab(anchor)) return;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  });
}

export function NewTabNavigation() {
  useEffect(() => {
    applyNewTabPolicy(document);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches("a[href]") && shouldOpenInNewTab(node as HTMLAnchorElement)) {
          const anchor = node as HTMLAnchorElement;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
        }
        applyNewTabPolicy(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
