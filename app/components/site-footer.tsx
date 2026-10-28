"use client";

import Link from "next/link";
import { CookiePreferencesButton } from "./cookie-consent";
import { LanguageSwitcher } from "../i18n/locale-provider";
import { AccessibilityWidget } from "./accessibility-widget";
import type { WorldId } from "../data/world-data";
import { footerContextFor, type FooterTopicId } from "../data/footer-context";
import { useEffect, useState } from "react";
import { useSiteLanguage } from "../i18n/locale-provider";
import type { ManagedLink } from "../lib/content-studio";
import { PwaInstallControl } from "./pwa-experience";
import { useWorldAvailability } from "./world-availability-provider";
import { localizedPath } from "../i18n/locale-routing";

const defaultWorldLinks: ManagedLink[] = [
  ["vacation", "נופש", "/search"], ["events", "אירועים", "/events"], ["corporate", "אירועי חברה ורווחה", "/corporate"],
  ["spa", "ספא", "/spas"], ["hourly", "חדרים לכמה שעות", "/hourly"], ["providers", "ספקים", "/providers"],
  ["trails", "מסלולי טיולים", "/trails"], ["attractions", "אטרקציות", "/attractions"],
].map(([id, label, href], index) => ({ id, label, href, group: "העולמות שלנו", order: index + 1, visible: true, newWindow: false }));

const defaultServiceLinks: ManagedLink[] = [
  ["account", "החשבון האישי שלי", "/account"], ["favorites", "המקומות שאהבתי", "/favorites"], ["gift-card", "גיפט קארד", "/gift-card"],
  ["corporate", "אירועי חברה ורווחה", "/corporate"], ["booking", "ניהול הזמנה", "/booking?action=manage"], ["questions", "שאלות ותשובות", "/questions"],
  ["guides", "מגזין ומדריכים", "/guides"], ["accessibility", "הצהרת נגישות", "/accessibility"], ["terms", "תקנון האתר", "/legal/terms"],
  ["privacy", "מדיניות פרטיות", "/legal/privacy"], ["cancellation", "ביטול ושינוי הזמנה", "/legal/cancellation"],
].map(([id, label, href], index) => ({ id, label, href, group: "מידע ושירות", order: index + 1, visible: true, newWindow: false }));

/* eslint-disable @next/next/no-img-element */

export function SiteFooter({ variant = "vacation", topic }: { variant?: WorldId; topic?: FooterTopicId }) {
  const contextual = footerContextFor(variant, topic);
  const { language, translate } = useSiteLanguage();
  const { enabled } = useWorldAvailability();
  const chromeKey = `${language}:${contextual.label}`;
  const defaultContextualLinks: ManagedLink[] = contextual.links.map((item, index) => ({ id: `default-${index}`, ...item, group: contextual.label, order: index + 1, visible: true, newWindow: false }));
  const [managedChrome, setManagedChrome] = useState<{ key: string; contextual?: ManagedLink[] | null; worlds?: ManagedLink[] | null; service?: ManagedLink[] | null } | null>(null);
  const contextualOverride = managedChrome?.key === chromeKey ? managedChrome.contextual?.filter((item) => item.visible && item.group === contextual.label) : null;
  const contextualLinks = (contextualOverride?.length ? contextualOverride : defaultContextualLinks)
    .filter((item) => !item.href.startsWith("/gift-card") || enabled("gift-card"));
  const worldLinks = (managedChrome?.key === chromeKey && managedChrome.worlds ? managedChrome.worlds.filter((item) => item.visible) : defaultWorldLinks).filter((item) => enabled(item.id));
  const usingDefaultServiceLinks = !(managedChrome?.key === chromeKey && managedChrome.service);
  const serviceLinks = (usingDefaultServiceLinks ? defaultServiceLinks : managedChrome!.service!.filter((item) => item.visible))
    .filter((item) => (item.id !== "gift-card" && !item.href.startsWith("/gift-card")) || enabled("gift-card"));
  const joinTarget = variant === "providers" ? "provider-pricing" : "expert-registration";
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/content/chrome?locale=${language}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null)
      .then((payload: { contextual?: ManagedLink[] | null; worlds?: ManagedLink[] | null; service?: ManagedLink[] | null } | null) => {
        if (payload) setManagedChrome({ key: chromeKey, ...payload });
      }).catch(() => undefined);
    return () => controller.abort();
  }, [chromeKey, language]);
  const links = (items: ManagedLink[]) => items.map((item) => <Link key={item.id} href={item.href} target={item.newWindow ? "_blank" : undefined} rel={item.newWindow ? "noopener noreferrer" : undefined}>{translate(item.label)}</Link>);
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <section className="footer-about">
          <Link href="/" aria-label="וי פור ויקיישן, דף הבית">
            <img src="/vii-logo.png" alt="וי פור ויקיישן" title="וי פור ויקיישן" />
          </Link>
          <p>נופש, אירועים, ספא, ספקים וחוויות, עם חיפוש אחד שמחבר את כל מה שצריך.</p>
          <Link className="footer-join-link" href={`/join/${variant}#${joinTarget}`}>פרסום והצטרפות בתחום זה</Link>
        </section>
        <nav aria-label={contextual.label}><strong>{translate(contextual.label)}</strong>{links(contextualLinks)}</nav>
        <nav aria-label="שירותים"><strong>{translate("העולמות שלנו")}</strong>{links(worldLinks)}</nav>
        <nav aria-label="מידע ושירות"><strong>{translate("מידע ושירות")}</strong>{usingDefaultServiceLinks ? <><Link href="/account">{translate("החשבון האישי שלי")}</Link><Link href="/favorites">{translate("המקומות שאהבתי")}</Link>{enabled("gift-card") ? <Link href={localizedPath("/gift-card", language)}>{translate("גיפט קארד")}</Link> : null}<Link href="/corporate">{translate("אירועי חברה ורווחה")}</Link><Link href="/booking?action=manage">{translate("ניהול הזמנה")}</Link><Link href="/questions">{translate("שאלות ותשובות")}</Link><Link href="/guides">{translate("מגזין ומדריכים")}</Link><Link href="/accessibility">{translate("הצהרת נגישות")}</Link><Link href="/legal/terms">{translate("תקנון האתר")}</Link><Link href="/legal/privacy">{translate("מדיניות פרטיות")}</Link><Link href="/legal/cancellation">{translate("ביטול ושינוי הזמנה")}</Link></> : links(serviceLinks)}<a href="https://www.spaplus.co.il/club/?src=vii" target="_blank" rel="noopener noreferrer">{translate("הצטרפות למועדון לקוחות")}</a></nav>
      </div>
      <div className="shell footer-bottom"><span>© וי פור ויקיישן</span><div><LanguageSwitcher compact /><AccessibilityWidget placement="footer" /><CookiePreferencesButton /><PwaInstallControl /><span>כל החופשה, במקום אחד</span></div></div>
    </footer>
  );
}
