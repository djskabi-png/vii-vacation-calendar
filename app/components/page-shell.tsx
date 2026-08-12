import type { ReactNode } from "react";
import { CookieConsent } from "./cookie-consent";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "../site-header";
import type { WorldId } from "../data/world-data";
import { SmartConcierge } from "./smart-concierge";
import { GlobalActionFeedback } from "./global-action-feedback";
import type { FooterTopicId } from "../data/footer-context";
import { NewTabNavigation } from "./new-tab-navigation";

export function PageShell({ children, variant = "vacation", showWorldSwitcher = true, footerTopic }: { children: ReactNode; variant?: WorldId; showWorldSwitcher?: boolean; footerTopic?: FooterTopicId }) {
  return <div className="site-page"><NewTabNavigation /><a className="skip-link" href="#main-content">דילוג לתוכן</a><GlobalActionFeedback /><SiteHeader variant={variant} showWorldSwitcher={showWorldSwitcher} />{children}<SiteFooter variant={variant} topic={footerTopic} /><SmartConcierge /><CookieConsent /></div>;
}
