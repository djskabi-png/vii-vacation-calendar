import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://djskabi-png.github.io/vii-vacation-calendar/"),
  title: "בחירת חופשה חכמה | VII",
  description: "בוחרים תאריכים מדויקים או גמישים, הרכב אורחים ומשך חופשה בממשק אחד פשוט ונוח.",
  openGraph: {
    title: "בחירת חופשה חכמה | VII",
    description: "בוחרים תאריכים מדויקים או גמישים, הרכב אורחים ומשך חופשה בממשק אחד פשוט ונוח.",
    images: [
      {
        url: "https://djskabi-png.github.io/vii-vacation-calendar/og.png",
        width: 1536,
        height: 1024,
        alt: "איור של לוח חופשה ובחירת טווח תאריכים",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "בחירת חופשה חכמה | VII",
    description: "בוחרים תאריכים מדויקים או גמישים, הרכב אורחים ומשך חופשה בממשק אחד פשוט ונוח.",
    images: ["https://djskabi-png.github.io/vii-vacation-calendar/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
