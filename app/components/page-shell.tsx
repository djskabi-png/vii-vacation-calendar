import type { ReactNode } from "react";
import { CookieConsent } from "./cookie-consent";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "../site-header";
import { WorldSwitcher } from "./world-switcher";
import type { WorldId } from "../data/world-data";

export function PageShell({ children, variant = "vacation" }: { children: ReactNode; variant?: WorldId }) {
  return <div className="site-page"><a className="skip-link" href="#main-content">דילוג לתוכן</a><SiteHeader variant={variant} />{children}<SiteFooter /><WorldSwitcher active={variant} /><CookieConsent /></div>;
}
