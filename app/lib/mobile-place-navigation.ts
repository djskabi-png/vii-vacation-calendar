type LinkClick = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  currentTarget?: { removeAttribute(name: string): void };
  preventDefault(): void;
};

/** Keep the approved desktop new-tab behavior while making a normal mobile
 * place tap behave like a native in-app navigation. Modified clicks remain
 * untouched so the visitor can still deliberately request another tab. */
export function openPlaceInSameTabOnMobile(event: LinkClick, href: string) {
  if (
    event.defaultPrevented
    || event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
    || typeof window === "undefined"
    || !window.matchMedia("(max-width: 760px)").matches
  ) return false;
  // Next's Link decides between a browser navigation and a client transition
  // after the supplied onClick returns. Removing only the desktop target on a
  // normal mobile tap keeps the Link transition, route loading UI and prefetched
  // data instead of paying for a full document reload. Non-Link callers retain
  // the safe location fallback.
  if (event.currentTarget) event.currentTarget.removeAttribute("target");
  else {
    event.preventDefault();
    window.location.assign(href);
  }
  return true;
}
