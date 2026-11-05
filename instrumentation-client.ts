import { NAVIGATION_START_EVENT } from "./app/lib/navigation-recovery";

/** Supported router instrumentation covers links, router.push and browser back. */
export function onRouterTransitionStart(href: string, navigationType: "push" | "replace" | "traverse") {
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail: { href, navigationType } }));
}
