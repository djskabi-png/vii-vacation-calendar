import Link from "next/link";
import { StructuredData } from "./structured-data";
import type { InactiveBusiness } from "../lib/inactive-business-archive.ts";
import styles from "./inactive-business-page.module.css";

const worlds = {
  vacations: { label: "נופש", href: "/vacations" },
  events: { label: "אירועים", href: "/events" },
  rooms: { label: "חדרים לפי שעה", href: "/hourly" },
  spa: { label: "ספא", href: "/spas" },
} as const;

function absolutePublicUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://vii.spaplus.co${value.startsWith("/") ? value : `/${value}`}`;
}

export function inactiveBusinessMetadata(place: InactiveBusiness) {
  const title = `${place.name} - המקום ירד מפרסום`;
  const description = `${place.name} אינו נמצא כרגע בפרסום פעיל באתר. פרטי קשר והזמנה אינם מוצגים, וניתן לעבור למקומות פעילים דומים.`;
  return {
    title,
    description,
    alternates: { canonical: place.canonicalPath },
    openGraph: { type: "website" as const, url: place.canonicalPath, title, description,
      ...(place.image ? { images: [{ url: place.image, alt: place.name }] } : {}) },
    twitter: { card: "summary_large_image" as const, title, description,
      ...(place.image ? { images: [place.image] } : {}) },
    robots: { index: true, follow: true },
  };
}

export default function InactiveBusinessPage({ place }: { place: InactiveBusiness }) {
  const world = worlds[place.world];
  const location = [place.location, place.area].filter(Boolean).join(" · ");
  return <main className={styles.page}>
    <StructuredData data={{
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: place.name,
      description: `${place.name} אינו נמצא כרגע בפרסום פעיל באתר.`,
      url: `https://vii.spaplus.co${place.canonicalPath}`,
      ...(place.image ? { primaryImageOfPage: { "@type": "ImageObject", url: absolutePublicUrl(place.image) } } : {}),
      ...(place.updatedAt ? { dateModified: place.updatedAt } : {}),
    }} />
    <div className={styles.shell}>
      <nav className={styles.crumbs} aria-label="פירורי לחם">
        <Link href="/">ראשי</Link><span aria-hidden="true">/</span><Link href={world.href}>{world.label}</Link>
      </nav>
      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.status}>ירד מפרסום</span>
          <h1>{place.name}</h1>
          {location ? <p className={styles.location}>{location}</p> : null}
          <p className={styles.notice}>המקום אינו נמצא כרגע בפרסום פעיל באתר. פרטי הטלפון, הוואטסאפ, ההזמנה והזמינות הוסרו עד לחזרה לפרסום.</p>
        </div>
        <div className={styles.gallery} aria-label={`תמונות שמורות של ${place.name}`}>
          {place.images.length ? place.images.slice(0, 3).map((image, index) =>
            <img key={image} src={image} alt={`${place.name} - תמונה ${index + 1}`} title={place.name} loading={index ? "lazy" : "eager"} />)
            : <div className={styles.placeholder}>התמונות נשמרו במערכת ואינן זמינות להצגה כרגע</div>}
        </div>
      </section>
      {place.images.length > 3 ? <details className={styles.fullGallery}>
        <summary>הצגת כל {place.images.length} התמונות</summary>
        <div className={styles.fullGalleryGrid} aria-label={`הגלריה המלאה של ${place.name}`}>
          {place.images.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${place.name} - תמונה ${index + 1}`} title={place.name} loading="lazy" decoding="async" />)}
        </div>
      </details> : null}
      <section className={styles.about}>
        <h2>מידע על המקום</h2>
        <p>{place.description}</p>
        <div className={styles.actions}><Link href={world.href}>למקומות פעילים בתחום {world.label}</Link></div>
      </section>
    </div>
  </main>;
}
