import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://djskabi-png.github.io/vii-vacation-calendar/"),
  title: "חיפוש חופשה ויומן זמינות | VII",
  description: "המחשה אינטראקטיבית לחיפוש חופשה כללי וליומן זמינות בדף עסק, עם תאריכים, אורחים ומגבלות מתאימות לכל מצב.",
  openGraph: {
    title: "חיפוש חופשה ויומן זמינות | VII",
    description: "שני תרחישים בממשק אחד: חיפוש כללי בכל האתר ויומן זמינות מלא בדף עסק.",
    images: [
      {
        url: "https://djskabi-png.github.io/vii-vacation-calendar/og-v2.png",
        width: 1536,
        height: 1024,
        alt: "איור של חיפוש חופשה כללי ויומן זמינות במקום אירוח",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "חיפוש חופשה ויומן זמינות | VII",
    description: "חיפוש כללי בכל האתר ויומן זמינות מלא בדף עסק.",
    images: ["https://djskabi-png.github.io/vii-vacation-calendar/og-v2.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
