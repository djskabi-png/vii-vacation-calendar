import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./results-view.css";
import "./mobile-stability.css";
import "./app-experience.css";
import "./site-polish.css";
import "./mobile-polish.css";
import "./preview-card-consistency.css";
import "./slider-card-compact.css";
import "./direct-phone-link.css";
import { LocaleProvider } from "./i18n/locale-provider";
import { StructuredData } from "./components/structured-data";
import { organizationSchema, websiteSchema } from "./lib/seo";
import { headers } from "next/headers";
import { AccountAccessProvider } from "./components/account-access";

const baseMetadata: Metadata = {
  metadataBase: new URL("https://vii.spaplus.co/"),
  title: { default: "וי פור ויקיישן | מוצאים את החופשה שמתאימה לכם", template: "%s | וי פור ויקיישן" },
  description: "חיפוש נופש, וילות, סוויטות ומקומות לאירועים ברחבי הארץ, עם מידע ברור ותהליך בחירה נוח.",
  applicationName: "וי פור ויקיישן",
  authors: [{ name: "וי פור ויקיישן", url: "https://vii.spaplus.co/" }],
  creator: "וי פור ויקיישן",
  publisher: "וי פור ויקיישן",
  category: "travel",
  keywords: ["נופש בישראל", "וילות נופש", "סוויטות", "מקומות לאירועים", "ספא", "מסלולי טיול"],
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "וי פור ויקיישן",
    title: "וי פור ויקיישן",
    description: "מוצאים את החופשה שמתאימה לכם",
    images: [{ url: "/og-v2.png", width: 1536, height: 1024, alt: "וי פור ויקיישן" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "וי פור ויקיישן",
    description: "נופש, אירועים, ספא וחוויות בישראל במקום אחד.",
    images: ["/og-v2.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/vii-logo.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/vii-logo.png",
  },
  formatDetection: { email: false, address: false, telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VII",
  },
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
};

const adminFontCriticalCss = `
@font-face {
  font-family: "VII Heebo";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/heebo/heebo-hebrew-v28.woff2") format("woff2");
  unicode-range: U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F;
}
@font-face {
  font-family: "VII Heebo";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("/fonts/heebo/heebo-latin-v28.woff2") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
body[data-vii-surface="admin"],
body[data-vii-surface="admin"] :where(*:not(code):not(pre):not(kbd)) {
  font-family: "VII Heebo", Arial, sans-serif !important;
}
`;

function stripLocale(pathname: string) {
  const stripped = pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "");
  return stripped || "/";
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-vii-pathname") || "/";
  const basePath = stripLocale(pathname);
  return {
    ...baseMetadata,
    alternates: {
      ...baseMetadata.alternates,
      canonical: pathname,
      languages: {
        "he-IL": basePath,
        en: `/en${basePath === "/" ? "" : basePath}`,
        ru: `/ru${basePath === "/" ? "" : basePath}`,
        fr: `/fr${basePath === "/" ? "" : basePath}`,
        "x-default": basePath,
      },
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#087e8b",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const locale = (requestHeaders.get("x-vii-locale") || "he") as "he" | "en" | "ru" | "fr";
  const pathname = requestHeaders.get("x-vii-pathname") || "/";
  const normalizedPathname = stripLocale(pathname);
  const isAdmin = normalizedPathname === "/admin" || normalizedPathname.startsWith("/admin/");
  const direction = locale === "he" ? "rtl" : "ltr";
  const localeBootstrap = `(function(){var d=document.documentElement;try{var p=location.pathname.match(/^\\/(en|ru|fr)(?:\\/|$)/);var l=p?p[1]:'he';d.lang=l;d.dir=l==='he'?'rtl':'ltr';d.dataset.locale=l;if(l==='he')d.removeAttribute('data-locale-pending');try{localStorage.setItem('vii-site-language',l);}catch(_){}}catch(e){d.removeAttribute('data-locale-pending');}})();`;
  return <html lang={locale} dir={direction} data-locale-pending={locale === "he" ? undefined : ""} suppressHydrationWarning><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />{isAdmin ? <><link rel="preload" href="/fonts/heebo/heebo-hebrew-v28.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /><link rel="preload" href="/fonts/heebo/heebo-latin-v28.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /><style id="vii-admin-font-critical" dangerouslySetInnerHTML={{ __html: adminFontCriticalCss }} /></> : null}<script dangerouslySetInnerHTML={{ __html: localeBootstrap }} /></head><body data-vii-surface={isAdmin ? "admin" : "public"}>
    <StructuredData data={organizationSchema()} />
    <StructuredData data={websiteSchema()} />
    <LocaleProvider initialLanguage={locale}><AccountAccessProvider>{children}</AccountAccessProvider></LocaleProvider>
  </body></html>;
}
