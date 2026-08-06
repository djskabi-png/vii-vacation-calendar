"use client";

import { useEffect, useState } from "react";

export function GlobalActionFeedback() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let clearTimer = 0;
    const show = (text: string) => {
      setMessage(text);
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setMessage(null), 9000);
    };
    const reset = () => {
      window.clearTimeout(clearTimer);
      setMessage(null);
    };
    const press = (element: HTMLElement) => {
      element.classList.remove("is-action-pressed");
      void element.offsetWidth;
      element.classList.add("is-action-pressed");
      window.setTimeout(() => element.classList.remove("is-action-pressed"), 360);
    };
    const onClick = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>("a, button, [role='button']");
      if (!element || element.getAttribute("aria-disabled") === "true" || (element instanceof HTMLButtonElement && element.disabled)) return;
      press(element);

      if (element instanceof HTMLAnchorElement) {
        const href = element.getAttribute("href");
        if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || element.target === "_blank") return;
        const destination = new URL(element.href, window.location.href);
        if (destination.origin === window.location.origin && destination.href !== window.location.href) show("טוענים את העמוד...");
      } else if (element instanceof HTMLButtonElement && element.type === "submit") {
        show(element.dataset.loadingLabel || "מבצעים את הפעולה...");
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const submitter = event.submitter as HTMLElement | null;
      show(submitter?.dataset.loadingLabel || form.dataset.loadingLabel || "מבצעים את הפעולה...");
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pageshow", reset);
    window.addEventListener("popstate", reset);
    return () => {
      window.clearTimeout(clearTimer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("popstate", reset);
    };
  }, []);

  return <div className={`global-action-feedback ${message ? "is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" />{message && <strong>{message}</strong>}</div>;
}
