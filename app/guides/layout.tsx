import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "מגזין וי, רעיונות ומדריכים לחופשה",
  description: "כתבות עומק, מדריכי הזמנה, רעיונות לטיולים, ספא, אירועים וחופשות ברחבי הארץ.",
  alternates: { canonical: "/guides/" },
  openGraph: {
    title: "מגזין וי, החופשה הטובה מתחילה ברעיון טוב",
    description: "כתבות עומק ורעיונות שימושיים לחופשה הבאה.",
    images: [{ url: "/og-magazine.png", width: 1536, height: 1024, alt: "גרפיקה מערכתית של מגזין וי בגוני טורקיז" }],
  },
};

export default function GuidesLayout({ children }: { children: React.ReactNode }) { return children; }
