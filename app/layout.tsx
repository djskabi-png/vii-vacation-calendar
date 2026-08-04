import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://djskabi-png.github.io/vii-vacation-calendar/"),
  title: "המחשת יומן חדש בדף הבית ובדף עסק | VII",
  description: "המחשה אינטראקטיבית של מנוע החיפוש בדף הבית ושל יומן הזמינות בדף העסק, בתוך העיצוב הקיים של וי פור ויקיישן.",
  openGraph: {
    title: "המחשת יומן חדש בדף הבית ובדף עסק | VII",
    description: "כך מנוע החיפוש והיומן החדש משתלבים בעיצוב הקיים של האתר.",
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
    title: "המחשת יומן חדש בדף הבית ובדף עסק | VII",
    description: "מנוע חיפוש כללי ויומן זמינות לעסק, מותאמים לאתר הקיים.",
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
