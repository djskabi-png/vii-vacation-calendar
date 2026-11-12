/** Start optional work once a section approaches view or receives real input. */
export function observeSectionActivation(element: Element, activate: () => void,
  Observer: typeof IntersectionObserver | undefined = globalThis.IntersectionObserver,
  rootMargin = "400px 0px") {
  let stopped = false;
  let observer: IntersectionObserver | undefined;
  const stop = () => { observer?.disconnect(); element.removeEventListener("focusin", start); element.removeEventListener("pointerdown", start); };
  const start = () => { if (stopped) return; stopped = true; stop(); activate(); };
  if (!Observer) { start(); return stop; }
  observer = new Observer(entries => { if (entries.some(entry => entry.isIntersecting)) start(); }, { rootMargin });
  observer.observe(element);
  element.addEventListener("focusin", start, { once: true });
  element.addEventListener("pointerdown", start, { once: true });
  return () => { stopped = true; stop(); };
}
