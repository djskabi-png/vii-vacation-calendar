import type { ReactNode } from "react";
import { CookieConsent } from "./cookie-consent";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "../site-header";

export function PageShell({ children, variant = "vacation" }: { children: ReactNode; variant?: "vacation" | "events" }) {
  return <div className="site-page"><a className="skip-link" href="#main-content">דילוג לתוכן</a><SiteHeader variant={variant} />{children}<SiteFooter /><CookieConsent /></div>;
}
