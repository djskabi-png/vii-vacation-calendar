import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://djskabi-png.github.io/vii-vacation-calendar/"),
  title: "בחירת תאריכים לחופשה | VII",
  description: "יומן זמינות נוח ומהיר לבחירת תאריכי החופשה שלכם.",
  openGraph: {
    title: "בחירת תאריכים לחופשה | VII",
    description: "יומן זמינות נוח ומהיר לבחירת תאריכי החופשה שלכם.",
    images: [
      {
        url: "https://djskabi-png.github.io/vii-vacation-calendar/vii-calendar-social.png",
        width: 1732,
        height: 909,
        alt: "יומן בחירת תאריכים של VII",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "בחירת תאריכים לחופשה | VII",
    description: "יומן זמינות נוח ומהיר לבחירת תאריכי החופשה שלכם.",
    images: ["https://djskabi-png.github.io/vii-vacation-calendar/vii-calendar-social.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
