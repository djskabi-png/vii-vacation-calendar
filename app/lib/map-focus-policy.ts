/** Leaflet focuses its canvas after pointer and control actions. Keep that
 * native focus inside the widget without scrolling the surrounding document. */
export function keepMapFocusInViewport(element: Pick<HTMLElement, "focus">) {
  const original = element.focus;
  const focus: typeof element.focus = (options) => original.call(element, { ...options, preventScroll: true });
  element.focus = focus;
  return () => { if (element.focus === focus) element.focus = original; };
}
