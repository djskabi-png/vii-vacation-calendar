import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "./i18n/locale-provider";
import { StructuredData } from "./components/structured-data";
import { organizationSchema, websiteSchema } from "./lib/seo";

export const metadata: Metadata = {
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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    types: { "application/rss+xml": "/feed.xml" },
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#087e8b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const localeBootstrap = `(function(){try{var p=location.pathname.match(/^\\/(en|ru|fr)(?:\\/|$)/);var l=p?p[1]:'he';localStorage.setItem('vii-site-language',l);document.documentElement.lang=l;document.documentElement.dir=l==='he'?'rtl':'ltr';document.documentElement.dataset.locale=l;if(l!=='he')document.documentElement.dataset.localePending='true';}catch(e){}})();`;
  return <html lang="he" dir="rtl" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: localeBootstrap }} /></head><body>
    <StructuredData data={organizationSchema()} />
    <StructuredData data={websiteSchema()} />
    <LocaleProvider>{children}</LocaleProvider>
  </body></html>;
}
