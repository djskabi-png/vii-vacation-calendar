"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSiteLanguage, type SiteLanguage } from "../i18n/locale-provider";

type ShareKind = "place" | "event" | "article";

type ShareCopy = {
  trigger: string;
  eyebrow: string;
  heading: string;
  description: string;
  preview: string;
  copy: string;
  copied: string;
  whatsapp: string;
  facebook: string;
  email: string;
  close: string;
  message: (title: string, kind: ShareKind) => string;
};

const copy: Record<SiteLanguage, ShareCopy> = {
  he: {
    trigger: "שיתוף",
    eyebrow: "משתפים מהאתר",
    heading: "שולחים למי שתרצו",
    description: "בחרו דרך שיתוף, והקישור לעמוד יצורף אוטומטית.",
    preview: "העמוד שבחרתם",
    copy: "העתקת קישור",
    copied: "הקישור הועתק",
    whatsapp: "וואטסאפ",
    facebook: "פייסבוק",
    email: "דואר אלקטרוני",
    close: "סגירת חלון השיתוף",
    message: (title, kind) => kind === "article" ? `כתבה שכדאי לקרוא: ${title}` : kind === "event" ? `מצאתי מקום לאירוע: ${title}` : `מצאתי מקום ב־Vii: ${title}`,
  },
  en: {
    trigger: "Share",
    eyebrow: "Share from VII",
    heading: "Send it your way",
    description: "Choose how to share and we will include the page link.",
    preview: "Selected page",
    copy: "Copy link",
    copied: "Link copied",
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    email: "Email",
    close: "Close sharing window",
    message: (title, kind) => kind === "article" ? `Worth reading: ${title}` : kind === "event" ? `I found an event venue: ${title}` : `I found this place on VII: ${title}`,
  },
  ru: {
    trigger: "Поделиться",
    eyebrow: "Поделиться с VII",
    heading: "Отправьте удобным способом",
    description: "Выберите способ, и ссылка на страницу добавится автоматически.",
    preview: "Выбранная страница",
    copy: "Копировать ссылку",
    copied: "Ссылка скопирована",
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    email: "Эл. почта",
    close: "Закрыть окно отправки",
    message: (title, kind) => kind === "article" ? `Стоит прочитать: ${title}` : kind === "event" ? `Я нашёл площадку для мероприятия: ${title}` : `Я нашёл это место на VII: ${title}`,
  },
  fr: {
    trigger: "Partager",
    eyebrow: "Partager depuis VII",
    heading: "Envoyez-le simplement",
    description: "Choisissez un moyen de partage, le lien sera ajouté automatiquement.",
    preview: "Page sélectionnée",
    copy: "Copier le lien",
    copied: "Lien copié",
    whatsapp: "WhatsApp",
    facebook: "Facebook",
    email: "E-mail",
    close: "Fermer la fenêtre de partage",
    message: (title, kind) => kind === "article" ? `À lire : ${title}` : kind === "event" ? `J'ai trouvé un lieu pour un événement : ${title}` : `J'ai trouvé ce lieu sur VII : ${title}`,
  },
};

function ShareIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></svg>;
}

function LinkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.2-1.2" /></svg>;
}

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 11.7a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.4-4.4a8.4 8.4 0 1 1 15.6-4.4Z" /><path d="M8.2 7.8c.3-.5.6-.5.9-.5h.4l1.1 2.4c.1.3 0 .6-.2.8l-.7.8c.9 1.8 2.2 3.1 4 3.9l.8-.9c.2-.2.5-.3.8-.1l2.3 1.1c.3.2.4.4.3.8-.3 1.2-1.4 2-2.7 2-3.8-.1-8.5-4.3-8.7-8.1 0-.9.5-1.7 1.7-2.2Z" /></svg>;
}

function FacebookIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h3l.5-3H14V8.2c0-.9.3-1.7 1.8-1.7H18V3.8c-.4 0-1.7-.2-3-.2-3 0-5 1.8-5 5.1V10H7v3h3v8" /></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></svg>;
}

export function ShareButton({ title, kind = "place" }: { title: string; kind?: ShareKind }) {
  const { language, translate } = useSiteLanguage();
  const labels = copy[language];
  const translatedTitle = translate(title);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        window.setTimeout(() => triggerRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>("button, a[href]")].filter((item) => !item.hasAttribute("disabled"));
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
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const show = () => {
    setUrl(window.location.href);
    setCopied(false);
    setOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const field = document.createElement("textarea");
      field.value = url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
  };

  const message = labels.message(translatedTitle, kind);
  const encodedMessage = encodeURIComponent(`${message}\n${url}`);
  const encodedUrl = encodeURIComponent(url);

  return <>
    <button ref={triggerRef} className="share-trigger" type="button" onClick={show}><ShareIcon /><span>{labels.trigger}</span></button>
    {mounted && open ? createPortal(
      <div className="share-dialog-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
        <section ref={dialogRef} className="share-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} dir={language === "he" ? "rtl" : "ltr"}>
          <header>
            <div className="share-dialog__heading"><span className="share-dialog__brand"><ShareIcon /></span><div><small>{labels.eyebrow}</small><h2 id={titleId}>{labels.heading}</h2></div></div>
            <button ref={closeRef} className="share-dialog__close" type="button" aria-label={labels.close} onClick={close}>×</button>
          </header>
          <p id={descriptionId} className="share-dialog__description">{labels.description}</p>
          <div className="share-dialog__preview">
            <span aria-hidden="true">V</span>
            <div><small>{labels.preview}</small><strong>{translatedTitle}</strong><bdi>{url.replace(/^https?:\/\//, "")}</bdi></div>
          </div>
          <div className="share-dialog__options">
            <button className={copied ? "share-option share-option--copied" : "share-option"} type="button" onClick={() => void copyLink()}><span><LinkIcon /></span><strong>{copied ? labels.copied : labels.copy}</strong></button>
            <a className="share-option share-option--whatsapp" href={`https://wa.me/?text=${encodedMessage}`} target="_blank" rel="noopener noreferrer"><span><WhatsAppIcon /></span><strong>{labels.whatsapp}</strong></a>
            <a className="share-option share-option--facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer"><span><FacebookIcon /></span><strong>{labels.facebook}</strong></a>
            <a className="share-option share-option--email" href={`mailto:?subject=${encodeURIComponent(translatedTitle)}&body=${encodedMessage}`}><span><MailIcon /></span><strong>{labels.email}</strong></a>
          </div>
          <span className="share-dialog__status" role="status" aria-live="polite">{copied ? labels.copied : ""}</span>
        </section>
      </div>,
      document.body,
    ) : null}
  </>;
}
