"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSiteLanguage } from "../i18n/locale-provider";

export const ACTION_FEEDBACK_EVENT = "vii-action-feedback";

const feedbackCopy = {
  he: { submit: "שומרים את הפרטים..." },
  en: { submit: "Saving your details..." },
  ru: { submit: "Сохраняем данные..." },
  fr: { submit: "Enregistrement des informations..." },
};

export function GlobalActionFeedback() {
  const { language } = useSiteLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [message, setMessage] = useState<string | null>(null);
  const copy = feedbackCopy[language];

  useEffect(() => {
    let clearTimer = 0;
    let delayTimer = 0;
    const show = (text: string, duration = 1400) => {
      setMessage(text);
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setMessage(null), duration);
    };
    const showIfStillWaiting = (text: string, delay = 500) => {
      window.clearTimeout(delayTimer);
      delayTimer = window.setTimeout(() => show(text, 9000), delay);
    };
    const reset = () => {
      window.clearTimeout(clearTimer);
      window.clearTimeout(delayTimer);
      setMessage(null);
    };
    const press = (element: HTMLElement) => {
      element.classList.remove("is-action-pressed");
      window.requestAnimationFrame(() => {
        if (!element.isConnected) return;
        element.classList.add("is-action-pressed");
        window.setTimeout(() => element.classList.remove("is-action-pressed"), 260);
      });
    };
    const onClick = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>("a, button, [role='button']");
      if (!element || element.getAttribute("aria-disabled") === "true" || (element instanceof HTMLButtonElement && element.disabled)) return;
      press(element);

      if (element instanceof HTMLAnchorElement && element.dataset.globalFeedback === "true") {
        showIfStillWaiting(element.dataset.loadingLabel || "פותחים את התוצאות...", 320);
      } else if (element.dataset.feedbackLabel && element.dataset.feedbackSilent !== "true") {
        show(element.dataset.feedbackLabel);
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const submitter = event.submitter as HTMLElement | null;
      if (form.dataset.globalFeedback !== "true" && submitter?.dataset.globalFeedback !== "true") return;
      showIfStillWaiting(submitter?.dataset.loadingLabel || form.dataset.loadingLabel || copy.submit);
    };
    const onFeedback = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; duration?: number }>).detail;
      if (detail?.message) show(detail.message, detail.duration || 1800);
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pageshow", reset);
    window.addEventListener("popstate", reset);
    window.addEventListener(ACTION_FEEDBACK_EVENT, onFeedback);
    return () => {
      window.clearTimeout(clearTimer);
      window.clearTimeout(delayTimer);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("popstate", reset);
      window.removeEventListener(ACTION_FEEDBACK_EVENT, onFeedback);
    };
  }, [copy]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => setMessage(null), 0);
    return () => window.clearTimeout(resetTimer);
  }, [pathname, searchKey]);

  return <div className={`global-action-feedback ${message ? "is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" />{message && <strong>{message}</strong>}</div>;
}
