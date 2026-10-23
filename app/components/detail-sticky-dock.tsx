import Link from "next/link";
import { DirectPhoneLink } from "./direct-phone-link";

export type DetailSectionLink = {
  href: `#${string}`;
  label: string;
};

type DetailStickyDockProps = {
  name: string;
  sections: DetailSectionLink[];
  onlineHref?: string;
  onlineLabel?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  outOfTenLabel?: string;
  reviewsLabel?: string;
  numberLocale?: string;
};

type DetailReviewSummaryProps = Pick<DetailStickyDockProps,
  "rating" | "reviewCount" | "outOfTenLabel" | "reviewsLabel" | "numberLocale"
> & {
  className?: string;
};

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export function DetailReviewSummary({
  rating,
  reviewCount,
  outOfTenLabel = "מתוך 10",
  reviewsLabel = "חוות דעת",
  numberLocale = "he-IL",
  className = "",
}: DetailReviewSummaryProps) {
  const hasReviewSummary = typeof rating === "number"
    && Number.isFinite(rating)
    && rating > 0
    && typeof reviewCount === "number"
    && Number.isFinite(reviewCount)
    && reviewCount > 0;

  if (!hasReviewSummary) return null;

  const formattedRating = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 }).format(rating);
  const formattedReviewCount = new Intl.NumberFormat(numberLocale).format(reviewCount);

  return <a href="#reviews" className={`detail-sticky-dock__review-summary ${className}`.trim()} aria-label={`${formattedRating} ${outOfTenLabel}, ${formattedReviewCount} ${reviewsLabel}`}>
    <span className="detail-sticky-dock__rating"><b>{formattedRating}</b><span className="detail-sticky-dock__stars" aria-hidden="true">★★★★★</span></span>
    <span className="detail-sticky-dock__review-count"><b>{formattedReviewCount}</b><span>{reviewsLabel}</span></span>
  </a>;
}

export function DetailStickyDock({
  name,
  sections,
  onlineHref,
  onlineLabel = "הזמנה אונליין",
  phone,
  rating,
  reviewCount,
  outOfTenLabel = "מתוך 10",
  reviewsLabel = "חוות דעת",
  numberLocale = "he-IL",
}: DetailStickyDockProps) {
  const phoneHref = phone ? `tel:${cleanPhone(phone)}` : undefined;
  const hasReviewSummary = typeof rating === "number"
    && Number.isFinite(rating)
    && rating > 0
    && typeof reviewCount === "number"
    && Number.isFinite(reviewCount)
    && reviewCount > 0;

  return (
    <div className="detail-sticky-wrap">
      <div className={`shell detail-sticky-dock${hasReviewSummary ? "" : " detail-sticky-dock--no-review-summary"}`}>
        <DetailReviewSummary rating={rating} reviewCount={reviewCount} outOfTenLabel={outOfTenLabel} reviewsLabel={reviewsLabel} numberLocale={numberLocale} />

        <nav className="detail-sticky-dock__sections" aria-label="ניווט בתוך עמוד המקום">
          {sections.map((section) => <a key={section.href} href={section.href}>{section.label}</a>)}
        </nav>

        <div className="detail-sticky-dock__actions">
          {phoneHref ? <DirectPhoneLink className="detail-sticky-dock__phone" phone={phone} placeName={name} /> : null}
          {onlineHref ? onlineHref.startsWith("#")
            ? <a className="button primary detail-sticky-dock__primary" href={onlineHref}>{onlineLabel}</a>
            : <Link className="button primary detail-sticky-dock__primary" href={onlineHref}>{onlineLabel}</Link>
          : null}
        </div>
      </div>
    </div>
  );
}
