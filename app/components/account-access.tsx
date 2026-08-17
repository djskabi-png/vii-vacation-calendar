"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useSiteLanguage } from "../i18n/locale-provider";
import { ACCOUNT_EVENT, readAccount, saveAccount, type LocalAccount } from "../lib/account";

type ContextValue = { account: LocalAccount | null; openLogin: () => void; logout: () => Promise<void> };
const AccountContext = createContext<ContextValue>({ account: null, openLogin: () => undefined, logout: async () => undefined });
const copy = {
  he: { login: "התחברות", account: "החשבון שלי", title: "מתחברים וממשיכים", body: "התחברו עם Google לזיהוי מהיר ולמילוי פרטים באתר.", google: "המשך עם Google", unavailable: "דרכי התחברות נוספות יתווספו בהמשך.", close: "סגירת חלון ההתחברות", promptTitle: "רוצים למלא את הפרטים אוטומטית?", promptBody: "התחברו לפני מילוי הטופס ונשתמש בפרטים ששמרתם.", promptAction: "התחברות ומילוי אוטומטי", connected: "הפרטים מולאו מהחשבון שלכם." },
  en: { login: "Sign in", account: "My account", title: "Sign in and continue faster", body: "Sign in with your Google account. Your name and email will identify you and prefill forms.", google: "Continue with Google", unavailable: "More sign-in methods will be added later.", close: "Close sign-in dialog", promptTitle: "Want to fill in your details automatically?", promptBody: "Sign in before completing the form and we will use your saved details.", promptAction: "Sign in and autofill", connected: "Details filled from your account." },
  ru: { login: "Войти", account: "Мой аккаунт", title: "Войдите, чтобы продолжить быстрее", body: "Войдите через Google. Имя и электронная почта будут использованы для идентификации и заполнения форм.", google: "Продолжить с Google", unavailable: "Другие способы входа появятся позже.", close: "Закрыть окно входа", promptTitle: "Заполнить данные автоматически?", promptBody: "Войдите перед заполнением формы, и мы используем сохранённые данные.", promptAction: "Войти и заполнить", connected: "Данные заполнены из вашего аккаунта." },
  fr: { login: "Se connecter", account: "Mon compte", title: "Connectez-vous pour aller plus vite", body: "Connectez-vous avec Google. Votre nom et votre adresse e-mail serviront à vous identifier et à préremplir les formulaires.", google: "Continuer avec Google", unavailable: "D’autres méthodes de connexion seront ajoutées prochainement.", close: "Fermer la fenêtre de connexion", promptTitle: "Préremplir vos coordonnées ?", promptBody: "Connectez-vous avant de remplir le formulaire pour utiliser vos informations enregistrées.", promptAction: "Se connecter et préremplir", connected: "Coordonnées remplies depuis votre compte." },
};

export function AccountAccessProvider({ children }: { children: ReactNode }) {
  const { language } = useSiteLanguage();
  const labels = copy[language];
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const sync = () => setAccount(readAccount());
    const load = async () => {
      try {
        const response = await fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" });
        const data = await response.json() as { account?: Omit<LocalAccount, "createdAt"> | null };
        if (data.account) saveAccount({ ...data.account, createdAt: new Date().toISOString() });
        else saveAccount(null);
      } catch { sync(); }
    };
    void load();
    window.addEventListener(ACCOUNT_EVENT, sync);
    return () => window.removeEventListener(ACCOUNT_EVENT, sync);
  }, []);
  const close = useCallback(() => { setOpen(false); window.setTimeout(() => triggerRef.current?.focus(), 0); }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", keydown); };
  }, [close, open]);
  function openLogin() { triggerRef.current = document.activeElement as HTMLElement | null; setOpen(true); }
  function startGoogleLogin() { window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); saveAccount(null); }
  return <AccountContext.Provider value={{ account, openLogin, logout }}>
    {children}
    {open ? <div className="account-auth-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="account-auth-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} dir={language === "he" ? "rtl" : "ltr"}>
      <button ref={closeRef} className="dialog-close" type="button" onClick={close} aria-label={labels.close}>×</button>
      <div className="account-auth-dialog__brand"><img src="/vii-logo.png" alt={language === "he" ? "וי פור ויקיישן" : "VII For Vacation"} title={language === "he" ? "וי פור ויקיישן" : "VII For Vacation"} /><h2 id={titleId}>{labels.title}</h2></div><p>{labels.body}</p>
      <div className="social-auth-actions"><button type="button" onClick={startGoogleLogin}><span className="social-auth-icon social-auth-icon--google" aria-hidden="true">G</span><strong>{labels.google}</strong></button></div>
    </section></div> : null}
  </AccountContext.Provider>;
}

export function useAccountAccess() { return useContext(AccountContext); }
function AccountUserIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-5 3.3-8 8-8s7.3 3 8 8" /></svg>; }
export function AccountHeaderButton() { const { language } = useSiteLanguage(); const { account, openLogin } = useAccountAccess(); return account ? <Link className="account-header-button account-header-button--connected" href="/account" aria-label={copy[language].account}><span className="account-header-avatar" aria-hidden="true">{account.name.trim().slice(0, 1).toUpperCase()}</span><span>{account.name.split(" ")[0]}</span></Link> : <button className="account-header-button" type="button" onClick={openLogin} aria-label={copy[language].login}><AccountUserIcon /><span>{copy[language].login}</span></button>; }
export function AccountFormPrompt({ compact = false }: { compact?: boolean }) { const { language } = useSiteLanguage(); const { account, openLogin } = useAccountAccess(); const labels = copy[language]; return account ? <div className="account-form-prompt account-form-prompt--connected" role="status"><span className="account-header-avatar" aria-hidden="true">{account.name.trim().slice(0, 1).toUpperCase()}</span><strong>{labels.connected}</strong></div> : <div className={`account-form-prompt ${compact ? "account-form-prompt--compact" : ""}`}><span><strong>{compact ? labels.promptAction : labels.promptTitle}</strong>{compact ? null : <small>{labels.promptBody}</small>}</span><button type="button" onClick={openLogin}>{compact ? labels.login : labels.promptAction}</button></div>; }
