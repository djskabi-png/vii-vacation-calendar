type LinkClick = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
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
  event.preventDefault();
  window.location.assign(href);
  return true;
}
