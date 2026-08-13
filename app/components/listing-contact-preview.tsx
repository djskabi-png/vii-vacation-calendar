"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

const text: Record<SiteLanguage, { reveal: string; exampleNumber: string; whatsapp: string; close: string; preview: string; title: (name: string) => string; intro: string; bubble: string; note: string; done: string }> = {
  he: { reveal: "הצגת מספר", exampleNumber: "מספר לדוגמה", whatsapp: "פנייה בוואטסאפ", close: "סגירת חלון ההמחשה", preview: "תצוגת שיחה", title: (name) => `פנייה אל ${name}`, intro: "כך תיפתח פנייה בוואטסאפ לאחר חיבור פרטי העסק.", bubble: "שלום, אשמח לבדוק זמינות ולקבל פרטים נוספים.", note: "זוהי המחשת ממשק בלבד. לא נשמרו פרטים ולא נשלחה הודעה.", done: "הבנתי" },
  en: { reveal: "Show number", exampleNumber: "Example number", whatsapp: "WhatsApp enquiry", close: "Close preview dialog", preview: "Conversation preview", title: (name) => `Enquiry to ${name}`, intro: "This is how a WhatsApp enquiry will open after the business details are connected.", bubble: "Hello, I would like to check availability and receive more details.", note: "Interface preview only. No details were saved and no message was sent.", done: "Got it" },
  ru: { reveal: "Показать номер", exampleNumber: "Пример номера", whatsapp: "Запрос в WhatsApp", close: "Закрыть окно просмотра", preview: "Просмотр диалога", title: (name) => `Запрос в ${name}`, intro: "Так откроется запрос в WhatsApp после подключения данных объекта.", bubble: "Здравствуйте, хочу уточнить наличие мест и получить подробную информацию.", note: "Это только демонстрация интерфейса. Данные не сохранены, сообщение не отправлено.", done: "Понятно" },
  fr: { reveal: "Afficher le numéro", exampleNumber: "Numéro d’exemple", whatsapp: "Demande WhatsApp", close: "Fermer l’aperçu", preview: "Aperçu de la conversation", title: (name) => `Demande à ${name}`, intro: "Voici comment la demande WhatsApp s’ouvrira une fois les coordonnées connectées.", bubble: "Bonjour, je souhaite vérifier les disponibilités et recevoir plus de détails.", note: "Aperçu de l’interface uniquement. Aucune donnée n’a été enregistrée et aucun message n’a été envoyé.", done: "Compris" },
};

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16.4v3a2 2 0 0 1-2.2 2 19.7 19.7 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.7 19.7 0 0 1 1.1 3.7 2 2 0 0 1 3.1 1.5h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L7.1 9.5a16 16 0 0 0 7.4 7.4l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z" /></svg>;
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.4L3 20.4l1.3-4.7A8.5 8.5 0 1 1 20.5 11.7Z"/><path d="M8.2 7.7c.2-.4.4-.4.7-.4h.4c.2 0 .4.1.5.4l.8 1.9c.1.3 0 .5-.2.7l-.6.7c-.2.2-.2.4-.1.6.6 1.2 1.6 2.2 2.8 2.8.2.1.4.1.6-.1l.8-1c.2-.2.4-.3.7-.2l1.8.9c.3.1.4.3.4.5 0 .3-.1 1.4-.8 2-.6.5-1.4.8-2.3.6-1.2-.2-2.8-.8-4.5-2.3-2-1.8-3.3-4.1-3.4-5.5-.1-.8.2-1.6.6-2.1.4-.4.8-.5 1-.5"/></svg>;
}

export function ListingContactPreview({ placeName, className = "" }: { placeName: string; className?: string }) {
  const { language, translate } = useSiteLanguage();
  const labels = text[language];
  const localizedPlaceName = translate(placeName);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const titleId = useId();

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("button")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return <div className={`listing-contact-preview ${className}`}>
    <button className="listing-contact-preview__phone" type="button" aria-expanded={phoneVisible} onClick={() => setPhoneVisible(true)}><PhoneIcon /><span>{phoneVisible ? <><bdi dir="ltr">050-000-0000</bdi><small>{labels.exampleNumber}</small></> : labels.reveal}</span></button>
    <button ref={triggerRef} className="listing-contact-preview__whatsapp" type="button" onClick={() => setOpen(true)}><WhatsAppIcon /><span>{labels.whatsapp}</span></button>
    {open ? <div className="listing-contact-preview__layer" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section ref={dialogRef} className="listing-contact-preview__dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button className="dialog-close" type="button" onClick={close} aria-label={labels.close}>×</button>
        <span className="listing-contact-preview__brand"><WhatsAppIcon /></span>
        <small>{labels.preview}</small>
        <h2 id={titleId}>{labels.title(localizedPlaceName)}</h2>
        <p>{labels.intro}</p>
        <div className="listing-contact-preview__bubble">{labels.bubble}</div>
        <p className="listing-contact-preview__note">{labels.note}</p>
        <button className="button primary wide" type="button" onClick={close}>{labels.done}</button>
      </section>
    </div> : null}
  </div>;
}
