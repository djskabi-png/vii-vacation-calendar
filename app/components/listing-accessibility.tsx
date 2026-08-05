import Link from "next/link";
import { accessibilityLabels, getPlaceAccessibility } from "../data/accessibility-data";

export function ListingAccessibility({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const information = getPlaceAccessibility(slug);
  if (compact) return <span className={`place-accessibility-badge place-accessibility-badge--${information.status}`}>{accessibilityLabels[information.status]}</span>;

  return <section className={`place-accessibility place-accessibility--${information.status}`} id="accessibility">
    <div className="place-accessibility__icon" aria-hidden="true">♿</div>
    <div><span className="eyebrow">נגישות במקום</span><h2>האם המקום נגיש?</h2><strong>{accessibilityLabels[information.status]}</strong><p>{information.summary}</p>{information.arrangements.length > 0 && <ul>{information.arrangements.map((arrangement) => <li key={arrangement}>{arrangement}</li>)}</ul>}<small>{information.sourceLabel}{information.verifiedAt ? `, עודכן ${information.verifiedAt}` : ""}</small><p className="place-accessibility__warning">לפני הזמנה מומלץ לאמת ישירות מול המקום את ההתאמות הנדרשות לכם, כולל חניה, דרך נגישה, פתחים, חדר רחצה, מעלית וגישה למתקנים.</p><Link href="/accessibility/">מידע על נגישות האתר והסדרי השירות</Link></div>
  </section>;
}
