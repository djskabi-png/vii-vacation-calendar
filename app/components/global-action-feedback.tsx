"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteLanguage } from "../i18n/locale-provider";

export const ACTION_FEEDBACK_EVENT = "vii-action-feedback";

const feedbackCopy = {
  he: { page: "טוענים את העמוד...", action: "הפעולה בוצעה", submit: "מבצעים את הפעולה...", choice: "הבחירה עודכנה" },
  en: { page: "Loading the page...", action: "Done", submit: "Completing the action...", choice: "Selection updated" },
  ru: { page: "Загружаем страницу...", action: "Готово", submit: "Выполняем действие...", choice: "Выбор обновлён" },
  fr: { page: "Chargement de la page...", action: "Terminé", submit: "Action en cours...", choice: "Sélection mise à jour" },
};

export function GlobalActionFeedback() {
  const { language } = useSiteLanguage();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);
  const copy = feedbackCopy[language];

  useEffect(() => {
    let clearTimer = 0;
    const show = (text: string, duration = 1400) => {
      setMessage(text);
      window.clearTimeout(clearTimer);
      clearTimer = window.setTimeout(() => setMessage(null), duration);
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
        if (destination.origin === window.location.origin && destination.href !== window.location.href) show(element.dataset.loadingLabel || copy.page, 9000);
      } else if (element instanceof HTMLButtonElement && element.type === "submit") {
        show(element.dataset.loadingLabel || copy.submit, 9000);
      } else if (element.dataset.feedbackSilent !== "true" && !element.closest(".universal-favorite")) {
        show(element.dataset.feedbackLabel || (element.hasAttribute("aria-pressed") || element.getAttribute("role") === "tab" ? copy.choice : copy.action));
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      const submitter = event.submitter as HTMLElement | null;
      show(submitter?.dataset.loadingLabel || form.dataset.loadingLabel || copy.submit, 9000);
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
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", reset);
      window.removeEventListener("popstate", reset);
      window.removeEventListener(ACTION_FEEDBACK_EVENT, onFeedback);
    };
  }, [copy]);

  useEffect(() => setMessage(null), [pathname]);

  return <div className={`global-action-feedback ${message ? "is-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true"><span aria-hidden="true" />{message && <strong>{message}</strong>}</div>;
}
