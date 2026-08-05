import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://new.vii.co.il/"),
  title: { default: "וי פור ויקיישן | מוצאים את החופשה שמתאימה לכם", template: "%s | וי פור ויקיישן" },
  description: "חיפוש נופש, וילות, סוויטות ומקומות לאירועים ברחבי הארץ, עם מידע ברור ותהליך בחירה נוח.",
  openGraph: { title: "וי פור ויקיישן", description: "מוצאים את החופשה שמתאימה לכם", images: [{ url: "/og-v2.png", width: 1536, height: 1024, alt: "וי פור ויקיישן" }] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#087e8b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="he" dir="rtl"><body>{children}</body></html>;
}
