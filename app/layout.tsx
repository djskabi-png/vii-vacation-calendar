import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "./i18n/locale-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://vii.spaplus.co/"),
  title: { default: "וי פור ויקיישן | מוצאים את החופשה שמתאימה לכם", template: "%s | וי פור ויקיישן" },
  description: "חיפוש נופש, וילות, סוויטות ומקומות לאירועים ברחבי הארץ, עם מידע ברור ותהליך בחירה נוח.",
  openGraph: { title: "וי פור ויקיישן", description: "מוצאים את החופשה שמתאימה לכם", images: [{ url: "/og-v2.png", width: 1536, height: 1024, alt: "וי פור ויקיישן" }] },
  icons: { icon: [{ url: "/vii-logo.png", type: "image/png" }], shortcut: "/vii-logo.png", apple: "/vii-logo.png" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#087e8b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl" suppressHydrationWarning><body><LocaleProvider>{children}</LocaleProvider></body></html>;
}
