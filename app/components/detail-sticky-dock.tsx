import Link from "next/link";

export type DetailSectionLink = {
  href: `#${string}`;
  label: string;
};

type DetailStickyDockProps = {
  name: string;
  location: string;
  sections: DetailSectionLink[];
  onlineHref?: string;
  onlineLabel?: string;
  phone?: string;
};

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export function DetailStickyDock({
  name,
  location,
  sections,
  onlineHref,
  onlineLabel = "הזמנה אונליין",
  phone,
}: DetailStickyDockProps) {
  const phoneHref = phone ? `tel:${cleanPhone(phone)}` : undefined;

  return (
    <div className="detail-sticky-wrap">
      <div className="shell detail-sticky-dock">
        <div className="detail-sticky-dock__identity">
          <strong>{name}</strong>
          <span>{location}</span>
        </div>

        <nav className="detail-sticky-dock__sections" aria-label="ניווט בתוך עמוד המקום">
          {sections.map((section) => <a key={section.href} href={section.href}>{section.label}</a>)}
        </nav>

        <div className="detail-sticky-dock__actions">
          {phoneHref ? <a className="detail-sticky-dock__phone" href={phoneHref} aria-label={`חיוג להזמנה אצל ${name}`}><span aria-hidden="true">☎</span><b>חיוג</b></a> : null}
          {onlineHref ? onlineHref.startsWith("#")
            ? <a className="button primary detail-sticky-dock__primary" href={onlineHref}>{onlineLabel}</a>
            : <Link className="button primary detail-sticky-dock__primary" href={onlineHref}>{onlineLabel}</Link>
          : null}
        </div>
      </div>
    </div>
  );
}
