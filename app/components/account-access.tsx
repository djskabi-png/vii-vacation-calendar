"use client";

import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSiteLanguage } from "../i18n/locale-provider";
import { ACCOUNT_EVENT, readAccount, saveAccount, type AccountProvider, type LocalAccount } from "../lib/account";

type ContextValue = { account: LocalAccount | null; openLogin: () => void };
const AccountContext = createContext<ContextValue>({ account: null, openLogin: () => undefined });
const copy = {
  he: { login: "התחברות", account: "החשבון שלי", title: "מתחברים וממשיכים מהר יותר", body: "בחרו דרך התחברות, השלימו את הפרטים פעם אחת, והם ימולאו אוטומטית בטפסים באתר.", google: "המשך עם Google", facebook: "המשך עם Facebook", instagram: "המשך עם Instagram", details: "השלמת פרטי החשבון", name: "שם מלא", email: "דואר אלקטרוני", phone: "טלפון", save: "שמירה וכניסה", back: "בחירת דרך אחרת", close: "סגירת חלון ההתחברות", demo: "תצוגת פרונט בלבד. אין עדיין חיבור אמיתי לחשבונות החברתיים, והפרטים נשמרים רק בדפדפן הזה.", promptTitle: "רוצים למלא את הפרטים אוטומטית?", promptBody: "התחברו לפני מילוי הטופס ונשתמש בפרטים ששמרתם.", promptAction: "התחברות ומילוי אוטומטי", connected: "הפרטים מולאו מהחשבון שלכם." },
  en: { login: "Sign in", account: "My account", title: "Sign in and continue faster", body: "Choose a sign-in method, add your details once, and forms will be filled automatically.", google: "Continue with Google", facebook: "Continue with Facebook", instagram: "Continue with Instagram", details: "Complete your account details", name: "Full name", email: "Email", phone: "Phone", save: "Save and sign in", back: "Choose another method", close: "Close sign-in dialog", demo: "Frontend preview only. Social accounts are not connected yet, and details are stored only in this browser.", promptTitle: "Want to fill in your details automatically?", promptBody: "Sign in before completing the form and we will use your saved details.", promptAction: "Sign in and autofill", connected: "Details filled from your account." },
  ru: { login: "Войти", account: "Мой аккаунт", title: "Войдите, чтобы продолжить быстрее", body: "Выберите способ входа, сохраните данные один раз, и формы будут заполняться автоматически.", google: "Продолжить с Google", facebook: "Продолжить с Facebook", instagram: "Продолжить с Instagram", details: "Заполните данные аккаунта", name: "Имя и фамилия", email: "Электронная почта", phone: "Телефон", save: "Сохранить и войти", back: "Выбрать другой способ", close: "Закрыть окно входа", demo: "Только демонстрация интерфейса. Социальные аккаунты пока не подключены, данные хранятся только в этом браузере.", promptTitle: "Заполнить данные автоматически?", promptBody: "Войдите перед заполнением формы, и мы используем сохранённые данные.", promptAction: "Войти и заполнить", connected: "Данные заполнены из вашего аккаунта." },
  fr: { login: "Se connecter", account: "Mon compte", title: "Connectez-vous pour aller plus vite", body: "Choisissez une méthode, enregistrez vos coordonnées une fois, puis les formulaires seront préremplis.", google: "Continuer avec Google", facebook: "Continuer avec Facebook", instagram: "Continuer avec Instagram", details: "Compléter le profil", name: "Nom complet", email: "E-mail", phone: "Téléphone", save: "Enregistrer et se connecter", back: "Choisir une autre méthode", close: "Fermer la fenêtre de connexion", demo: "Aperçu de l'interface uniquement. Les comptes sociaux ne sont pas encore connectés et les données restent dans ce navigateur.", promptTitle: "Préremplir vos coordonnées ?", promptBody: "Connectez-vous avant de remplir le formulaire pour utiliser vos informations enregistrées.", promptAction: "Se connecter et préremplir", connected: "Coordonnées remplies depuis votre compte." },
};

export function AccountAccessProvider({ children }: { children: ReactNode }) {
  const { language } = useSiteLanguage();
  const labels = copy[language];
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AccountProvider | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => { const sync = () => setAccount(readAccount()); const timer = window.setTimeout(sync, 0); window.addEventListener(ACCOUNT_EVENT, sync); return () => { window.clearTimeout(timer); window.removeEventListener(ACCOUNT_EVENT, sync); }; }, []);
  const close = useCallback(() => { setOpen(false); setProvider(null); window.setTimeout(() => triggerRef.current?.focus(), 0); }, []);
  useEffect(() => { if (!open) return; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; closeRef.current?.focus(); const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; window.addEventListener("keydown", keydown); return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); }; }, [close, open]);
  function openLogin() { triggerRef.current = document.activeElement as HTMLElement | null; setOpen(true); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!provider) return; const data = new FormData(event.currentTarget); saveAccount({ name: String(data.get("name") || "").trim(), email: String(data.get("email") || "").trim(), phone: String(data.get("phone") || "").trim(), provider, createdAt: new Date().toISOString() }); close(); }
  return <AccountContext.Provider value={{ account, openLogin }}>
    {children}
    {open ? <div className="account-auth-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="account-auth-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} dir={language === "he" ? "rtl" : "ltr"}>
      <button ref={closeRef} className="dialog-close" type="button" onClick={close} aria-label={labels.close}>×</button>
      <div className="account-auth-dialog__brand"><span className="account-avatar" aria-hidden="true">VII</span><div><small>VII</small><h2 id={titleId}>{provider ? labels.details : labels.title}</h2></div></div><p>{labels.body}</p>
      {!provider ? <div className="social-auth-actions">{(["google", "facebook", "instagram"] as AccountProvider[]).map((item) => <button key={item} type="button" onClick={() => setProvider(item)}><span className={`social-auth-icon social-auth-icon--${item}`} aria-hidden="true">{item === "google" ? "G" : item === "facebook" ? "f" : "◎"}</span><strong>{labels[item]}</strong></button>)}</div> : <form className="account-auth-form" onSubmit={submit}><label>{labels.name}<input name="name" autoComplete="name" required minLength={2} /></label><label>{labels.email}<input name="email" type="email" autoComplete="email" required /></label><label>{labels.phone}<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required minLength={7} /></label><button className="button primary" type="submit">{labels.save}</button><button className="button subtle" type="button" onClick={() => setProvider(null)}>{labels.back}</button></form>}
      <small className="account-auth-dialog__notice">{labels.demo}</small>
    </section></div> : null}
  </AccountContext.Provider>;
}

export function useAccountAccess() { return useContext(AccountContext); }
function AccountUserIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-5 3.3-8 8-8s7.3 3 8 8" /></svg>; }
export function AccountHeaderButton() { const { language } = useSiteLanguage(); const { account, openLogin } = useAccountAccess(); return account ? <Link className="account-header-button account-header-button--connected" href="/account" aria-label={copy[language].account}><span className="account-header-avatar" aria-hidden="true">{account.name.trim().slice(0, 1).toUpperCase()}</span><span>{account.name.split(" ")[0]}</span></Link> : <button className="account-header-button" type="button" onClick={openLogin} aria-label={copy[language].login}><AccountUserIcon /><span>{copy[language].login}</span></button>; }
export function AccountFormPrompt({ compact = false }: { compact?: boolean }) { const { language } = useSiteLanguage(); const { account, openLogin } = useAccountAccess(); const labels = copy[language]; return account ? <div className="account-form-prompt account-form-prompt--connected" role="status"><span className="account-header-avatar" aria-hidden="true">{account.name.trim().slice(0, 1).toUpperCase()}</span><strong>{labels.connected}</strong></div> : <div className={`account-form-prompt ${compact ? "account-form-prompt--compact" : ""}`}><span><strong>{compact ? labels.promptAction : labels.promptTitle}</strong>{compact ? null : <small>{labels.promptBody}</small>}</span><button type="button" onClick={openLogin}>{compact ? labels.login : labels.promptAction}</button></div>; }
