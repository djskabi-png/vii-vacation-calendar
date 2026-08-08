import type { ReactNode } from "react";
import { CookieConsent } from "./cookie-consent";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "../site-header";
import { WorldSwitcher } from "./world-switcher";
import type { WorldId } from "../data/world-data";
import { SmartConcierge } from "./smart-concierge";
import { GlobalActionFeedback } from "./global-action-feedback";
import type { FooterTopicId } from "../data/footer-context";

export function PageShell({ children, variant = "vacation", showWorldSwitcher = true, footerTopic }: { children: ReactNode; variant?: WorldId; showWorldSwitcher?: boolean; footerTopic?: FooterTopicId }) {
  return <div className="site-page"><a className="skip-link" href="#main-content">דילוג לתוכן</a><GlobalActionFeedback /><SiteHeader variant={variant} />{children}<SiteFooter variant={variant} topic={footerTopic} />{showWorldSwitcher ? <WorldSwitcher active={variant} /> : null}<SmartConcierge /><CookieConsent /></div>;
}
