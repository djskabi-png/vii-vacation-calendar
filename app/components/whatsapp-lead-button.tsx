"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";
import { trackWhatsAppLeadSaved } from "../lib/analytics";
import { AccountFormPrompt, useAccountAccess } from "./account-access";

type Copy = {
  button: string;
  appName: string;
  conversationWith: (placeName: string) => string;
  previewMessage: string;
  previewStatus: string;
  eyebrow: string;
  title: string;
  description: string;
  name: string;
  phone: string;
  date: string;
  guests: string;
  guestsHint: string;
  privacyPrefix: string;
  privacyLink: string;
  submit: string;
  submitting: string;
  close: string;
  errorTitle: string;
  errorBody: string;
  messageIntro: (placeName: string) => string;
  messageName: string;
  messagePhone: string;
  messageDate: string;
  messageGuests: string;
  messageService: string;
  messageReference: string;
  messageOutro: string;
};

const copy: Record<SiteLanguage, Copy> = {
  he: {
    button: "\u05e4\u05e0\u05d9\u05d9\u05d4 \u05d1\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
    appName: "\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4",
    conversationWith: (placeName) => `\u05e9\u05d9\u05d7\u05d4 \u05e2\u05dd ${placeName}`,
    previewMessage: "\u05e9\u05dc\u05d5\u05dd, \u05d0\u05e9\u05de\u05d7 \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d6\u05de\u05d9\u05e0\u05d5\u05ea \u05d5\u05dc\u05e9\u05de\u05d5\u05e2 \u05e4\u05e8\u05d8\u05d9\u05dd.",
    previewStatus: "\u05d4\u05d4\u05d5\u05d3\u05e2\u05d4 \u05ea\u05d9\u05e4\u05ea\u05d7 \u05d0\u05d7\u05e8\u05d9 \u05e9\u05de\u05d9\u05e8\u05ea \u05d4\u05e4\u05e8\u05d8\u05d9\u05dd",
    eyebrow: "\u05e4\u05e0\u05d9\u05d9\u05d4 \u05de\u05ea\u05d5\u05e2\u05d3\u05ea \u05dc\u05de\u05e7\u05d5\u05dd",
    title: "\u05e4\u05e8\u05d8\u05d9\u05dd \u05dc\u05e4\u05ea\u05d9\u05d7\u05ea \u05e9\u05d9\u05d7\u05d4",
    description: "\u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05e0\u05e9\u05de\u05e8\u05d9\u05dd \u05dc\u05e4\u05e0\u05d9 \u05d4\u05de\u05e2\u05d1\u05e8 \u05dc\u05d5\u05d5\u05d0\u05d8\u05e1\u05d0\u05e4, \u05db\u05d3\u05d9 \u05e9\u05d4\u05de\u05e7\u05d5\u05dd \u05d5\u05d0\u05e0\u05d7\u05e0\u05d5 \u05e0\u05d5\u05db\u05dc \u05dc\u05e2\u05e7\u05d5\u05d1 \u05d0\u05d7\u05e8\u05d9 \u05d4\u05e4\u05e0\u05d9\u05d9\u05d4.",
    name: "\u05e9\u05dd \u05de\u05dc\u05d0",
    phone: "\u05d8\u05dc\u05e4\u05d5\u05df",
    date: "\u05ea\u05d0\u05e8\u05d9\u05da \u05de\u05d1\u05d5\u05e7\u05e9",
    guests: "\u05db\u05de\u05d5\u05ea \u05d0\u05d5\u05e8\u05d7\u05d9\u05dd, \u05dc\u05d0 \u05d7\u05d5\u05d1\u05d4",
    guestsHint: "\u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05e9\u05d0\u05d9\u05e8 \u05e8\u05d9\u05e7",
    privacyPrefix: "\u05d0\u05e0\u05d9 \u05de\u05d0\u05e9\u05e8\u05ea \u05d0\u05d5 \u05de\u05d0\u05e9\u05e8 \u05e9\u05d9\u05de\u05d5\u05e9 \u05d1\u05e4\u05e8\u05d8\u05d9\u05dd \u05dc\u05e6\u05d5\u05e8\u05da \u05d4\u05d8\u05d9\u05e4\u05d5\u05dc \u05d1\u05e4\u05e0\u05d9\u05d9\u05d4 \u05dc\u05e4\u05d9",
    privacyLink: "\u05de\u05d3\u05d9\u05e0\u05d9\u05d5\u05ea \u05d4\u05e4\u05e8\u05d8\u05d9\u05d5\u05ea",
    submit: "\u05e9\u05de\u05d9\u05e8\u05ea \u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05d5\u05e4\u05ea\u05d9\u05d7\u05ea \u05e9\u05d9\u05d7\u05d4",
    submitting: "\u05e9\u05d5\u05de\u05e8\u05d9\u05dd \u05d0\u05ea \u05d4\u05e4\u05e0\u05d9\u05d9\u05d4...",
    close: "\u05e1\u05d2\u05d9\u05e8\u05ea \u05d7\u05dc\u05d5\u05df \u05d4\u05e4\u05e0\u05d9\u05d9\u05d4",
    errorTitle: "\u05d4\u05e4\u05e8\u05d8\u05d9\u05dd \u05e2\u05d3\u05d9\u05d9\u05df \u05dc\u05d0 \u05e0\u05e9\u05de\u05e8\u05d5",
    errorBody: "\u05dc\u05d0 \u05e4\u05ea\u05d7\u05e0\u05d5 \u05e9\u05d9\u05d7\u05d4. \u05d1\u05d3\u05e7\u05d5 \u05d0\u05ea \u05d4\u05d7\u05d9\u05d1\u05d5\u05e8 \u05d5\u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1.",
    messageIntro: (placeName) => `\u05e9\u05dc\u05d5\u05dd ${placeName}, \u05d4\u05d2\u05e2\u05ea\u05d9 \u05d3\u05e8\u05da \u05d0\u05ea\u05e8 VII \u05d5\u05d0\u05e9\u05de\u05d7 \u05dc\u05d1\u05d3\u05d5\u05e7 \u05d6\u05de\u05d9\u05e0\u05d5\u05ea.`,
    messageName: "\u05e9\u05dd \u05de\u05dc\u05d0",
    messagePhone: "\u05d8\u05dc\u05e4\u05d5\u05df",
    messageDate: "\u05ea\u05d0\u05e8\u05d9\u05da \u05de\u05d1\u05d5\u05e7\u05e9",
    messageGuests: "\u05db\u05de\u05d5\u05ea \u05d0\u05d5\u05e8\u05d7\u05d9\u05dd",
    messageService: "\u05e9\u05d9\u05e8\u05d5\u05ea \u05de\u05d1\u05d5\u05e7\u05e9",
    messageReference: "\u05de\u05d6\u05d4\u05d4 \u05e4\u05e0\u05d9\u05d9\u05d4",
    messageOutro: "\u05d0\u05e9\u05de\u05d7 \u05dc\u05e7\u05d1\u05dc \u05e4\u05e8\u05d8\u05d9\u05dd.",
  },
  en: {
    appName: "WhatsApp", conversationWith: (placeName) => `Chat with ${placeName}`, previewMessage: "Hello, I would like to check availability and receive more details.", previewStatus: "The message will open after your details are saved",
    button: "WhatsApp enquiry", eyebrow: "A tracked enquiry to the business", title: "Details to start the chat", description: "We save the enquiry before opening WhatsApp so the business and our team can follow it up.", name: "Full name", phone: "Phone", date: "Requested date", guests: "Number of guests, optional", guestsHint: "You can leave this blank", privacyPrefix: "I agree to the use of my details to handle this enquiry under the", privacyLink: "privacy policy", submit: "Save details and open chat", submitting: "Saving your enquiry...", close: "Close enquiry dialog", errorTitle: "Your details have not been saved yet", errorBody: "We did not open WhatsApp. Check your connection and try again.", messageIntro: (placeName) => `Hello ${placeName}, I came through the VII website and would like to check availability.`, messageName: "Full name", messagePhone: "Phone", messageDate: "Requested date", messageGuests: "Guests", messageService: "Requested service", messageReference: "Enquiry reference", messageOutro: "I would be happy to receive more information.",
  },
  ru: {
    appName: "WhatsApp", conversationWith: (placeName) => `Чат с ${placeName}`, previewMessage: "Здравствуйте, хочу уточнить наличие мест и получить подробности.", previewStatus: "Сообщение откроется после сохранения данных",
    button: "Запрос в WhatsApp", eyebrow: "Отслеживаемый запрос объекту", title: "Заполните данные и начните разговор", description: "Мы сохраняем запрос до перехода в WhatsApp, чтобы объект и наша команда могли его обработать.", name: "Имя и фамилия", phone: "Телефон", date: "Желаемая дата", guests: "Количество гостей, необязательно", guestsHint: "Поле можно оставить пустым", privacyPrefix: "Я согласен на использование моих данных для обработки запроса в соответствии с", privacyLink: "политикой конфиденциальности", submit: "Сохранить данные и открыть чат", submitting: "Сохраняем запрос...", close: "Закрыть окно запроса", errorTitle: "Данные пока не сохранены", errorBody: "WhatsApp не был открыт. Проверьте соединение и попробуйте снова.", messageIntro: (placeName) => `Здравствуйте, ${placeName}. Я пришёл с сайта VII и хочу уточнить наличие мест.`, messageName: "Имя", messagePhone: "Телефон", messageDate: "Желаемая дата", messageGuests: "Гости", messageService: "Услуга", messageReference: "Номер запроса", messageOutro: "Буду рад получить подробную информацию.",
  },
  fr: {
    appName: "WhatsApp", conversationWith: (placeName) => `Discussion avec ${placeName}`, previewMessage: "Bonjour, je souhaite vérifier les disponibilités et recevoir plus de détails.", previewStatus: "Le message sera ouvert après enregistrement de vos coordonnées",
    button: "Demande par WhatsApp", eyebrow: "Une demande suivie auprès de l'établissement", title: "Renseignez vos coordonnées et démarrez la conversation", description: "Nous enregistrons la demande avant d'ouvrir WhatsApp afin que l'établissement et notre équipe puissent la suivre.", name: "Nom complet", phone: "Téléphone", date: "Date souhaitée", guests: "Nombre de personnes, facultatif", guestsHint: "Vous pouvez laisser ce champ vide", privacyPrefix: "J'accepte l'utilisation de mes données pour traiter cette demande conformément à la", privacyLink: "politique de confidentialité", submit: "Enregistrer les coordonnées et ouvrir la discussion", submitting: "Enregistrement de la demande...", close: "Fermer la fenêtre de demande", errorTitle: "Vos informations ne sont pas encore enregistrées", errorBody: "WhatsApp n'a pas été ouvert. Vérifiez votre connexion et réessayez.", messageIntro: (placeName) => `Bonjour ${placeName}, je viens du site VII et je souhaite vérifier les disponibilités.`, messageName: "Nom complet", messagePhone: "Téléphone", messageDate: "Date souhaitée", messageGuests: "Personnes", messageService: "Service souhaité", messageReference: "Référence de la demande", messageOutro: "Je souhaite recevoir plus d'informations.",
  },
};

const newTabLabel: Record<SiteLanguage, string> = {
  he: "\u05e0\u05e4\u05ea\u05d7 \u05d1\u05dc\u05e9\u05d5\u05e0\u05d9\u05ea \u05d7\u05d3\u05e9\u05d4",
  en: "opens in a new tab",
  ru: "откроется в новой вкладке",
  fr: "s’ouvre dans un nouvel onglet",
};

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.4l1.3-4.7A8.5 8.5 0 1 1 20.5 11.7Z"/><path d="M8.2 7.7c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.8 1.9c.1.3 0 .5-.2.7l-.6.7c-.2.2-.2.4-.1.6.6 1.2 1.6 2.2 2.8 2.8.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .3-.1 1.4-.8 2-.6.5-1.4.8-2.3.6-1.2-.2-2.8-.8-4.5-2.3-2-1.8-3.3-4.1-3.4-5.5-.1-.8.2-1.6.6-2.1.4-.4.8-.5 1-.5"/></svg>;
}
function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  return digits;
}

export type WhatsAppLeadButtonProps = {
  world: string;
  placeId: string;
  placeName: string;
  businessPhone: string;
  serviceName?: string;
  initialDate?: string;
  initialGuests?: number | string;
  buttonLabel?: string;
  buttonClassName?: string;
};

export function WhatsAppLeadButton({ world, placeId, placeName, businessPhone, serviceName = "", initialDate = "", initialGuests = "", buttonLabel, buttonClassName = "button primary" }: WhatsAppLeadButtonProps) {
  const { language, translate } = useSiteLanguage();
  const labels = copy[language];
  const localizedPlaceName = translate(placeName);
  const { account } = useAccountAccess();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [submissionId, setSubmissionId] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const closeDialog = useCallback(() => {
    if (state === "submitting") return;
    setOpen(false);
    setState("idle");
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [state]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href]") || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => firstInputRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDialog, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "submitting") return;
    setState("submitting");
    const values = new FormData(event.currentTarget);
    const id = submissionId || crypto.randomUUID();
    if (!submissionId) setSubmissionId(id);
    const name = String(values.get("name") || "").trim();
    const visitorPhone = String(values.get("phone") || "").trim();
    const requestedDate = String(values.get("requested_date") || "").trim();
    const guests = String(values.get("guests") || "").trim();
    const message = [
      `${labels.messageName}: ${name}`,
      `${labels.messagePhone}: ${visitorPhone}`,
      `${labels.messageDate}: ${requestedDate}`,
      guests ? `${labels.messageGuests}: ${guests}` : "",
      serviceName ? `${labels.messageService}: ${serviceName}` : "",
    ].filter(Boolean).join("\n");

    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          purpose: "whatsapp_enquiry",
          world,
          placeId,
          placeName,
          serviceName: serviceName || undefined,
          name,
          phone: visitorPhone,
          requestedDate,
          guests: guests || undefined,
          message,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
          sourceChannel: "detail_whatsapp",
        }),
      });
      const result = await response.json() as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("lead_not_saved");
      const reference = result.reference || id;
      const whatsappMessage = [
        labels.messageIntro(localizedPlaceName),
        `${labels.messageName}: ${name}`,
        `${labels.messagePhone}: ${visitorPhone}`,
        `${labels.messageDate}: ${requestedDate}`,
        guests ? `${labels.messageGuests}: ${guests}` : "",
        serviceName ? `${labels.messageService}: ${serviceName}` : "",
        `${labels.messageReference}: ${reference}`,
        labels.messageOutro,
      ].filter(Boolean).join("\n");
      trackWhatsAppLeadSaved({ placeId, placeName, world, reference });
      window.location.assign(`https://wa.me/${whatsappNumber(businessPhone)}?text=${encodeURIComponent(whatsappMessage)}`);
    } catch {
      setState("error");
    }
  }

  return <>
    <button ref={triggerRef} className={`${buttonClassName} whatsapp-lead-trigger`} type="button" onClick={() => setOpen(true)}><WhatsAppIcon /><span>{buttonLabel || labels.button}</span></button>
    {open ? <div className="whatsapp-lead-layer" onMouseDown={(event) => event.target === event.currentTarget && closeDialog()}>
      <section ref={dialogRef} className="whatsapp-lead-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} dir={language === "he" ? "rtl" : "ltr"}>
        <header className="whatsapp-lead-dialog__appbar">
          <div className="whatsapp-lead-dialog__brand"><span aria-hidden="true"><WhatsAppIcon /></span><div><strong>{labels.appName}</strong><small>{labels.eyebrow}</small></div></div>
          <button className="dialog-close" type="button" onClick={closeDialog} aria-label={labels.close}>×</button>
        </header>
        <div className="whatsapp-lead-dialog__conversation" aria-label={labels.conversationWith(localizedPlaceName)}>
          <span className="whatsapp-lead-dialog__avatar" aria-hidden="true"><WhatsAppIcon /></span>
          <div className="whatsapp-lead-dialog__bubble"><strong>{localizedPlaceName}</strong><p>{labels.previewMessage}</p></div>
        </div>
        <div className="whatsapp-lead-dialog__intro"><h2 id={titleId}>{labels.title}</h2><p id={descriptionId} className="sr-only">{labels.description}</p></div>
        <form onSubmit={submit}>
          <div className="whatsapp-lead-dialog__fields">
            <div className="form-wide"><AccountFormPrompt compact /></div>
            <label>{labels.name}<input key={`name-${account?.email || "guest"}`} ref={firstInputRef} required name="name" autoComplete="name" minLength={2} defaultValue={account?.name || ""} /></label>
            <label>{labels.phone}<input key={`phone-${account?.email || "guest"}`} required name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} maxLength={20} pattern="[0-9+() -]{7,20}" defaultValue={account?.phone || ""} /></label>
            <label>{labels.date}<input required name="requested_date" type="date" defaultValue={initialDate} /></label>
            <label>{labels.guests}<input name="guests" type="number" inputMode="numeric" min="1" defaultValue={initialGuests} placeholder={labels.guestsHint} /></label>
            <label className="form-honey" aria-hidden="true">Company site<input name="company_site" tabIndex={-1} autoComplete="off" /></label>
            <label className="whatsapp-lead-dialog__privacy"><input required name="privacy" type="checkbox" /><span>{labels.privacyPrefix} <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer">{labels.privacyLink}<span className="sr-only"> ({newTabLabel[language]})</span></Link>.</span></label>
          </div>
          <footer>
            <button className="button primary booking-whatsapp" type="submit" disabled={state === "submitting"}><WhatsAppIcon /><span>{state === "submitting" ? labels.submitting : labels.submit}</span></button>
          </footer>
          {state === "error" ? <div className="whatsapp-lead-dialog__error" role="alert"><strong>{labels.errorTitle}</strong><span>{labels.errorBody}</span></div> : null}
        </form>
      </section>
    </div> : null}
  </>;
}
