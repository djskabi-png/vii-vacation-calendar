import type { ReactNode } from "react";
import { CookieConsent } from "./cookie-consent";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "../site-header";
import type { WorldId } from "../data/world-data";
import { GlobalActionFeedback } from "./global-action-feedback";
import type { FooterTopicId } from "../data/footer-context";
import { NewTabNavigation } from "./new-tab-navigation";
import { ResponsiveViewportGuard } from "./responsive-viewport-guard";
import { BackToTop } from "./back-to-top";
import { SmartNavigationWarmup } from "./smart-navigation-warmup";

export function PageShell({ children, variant = "vacation", footerTopic }: { children: ReactNode; variant?: WorldId; footerTopic?: FooterTopicId }) {
  return <div className="site-page"><NewTabNavigation /><ResponsiveViewportGuard /><SmartNavigationWarmup /><a className="skip-link" href="#main-content">דילוג לתוכן</a><GlobalActionFeedback /><SiteHeader variant={variant} /><CookieConsent />{children}<SiteFooter variant={variant} topic={footerTopic} /><BackToTop /></div>;
}
