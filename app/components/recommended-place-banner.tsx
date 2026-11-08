"use client";
import Link from "next/link";
import type { PublicPromotionWorld } from "../lib/public-promotion-policy";
import { usePublicPromotionFlags } from "./use-public-promotion-weights";
import { useSiteLanguage } from "../i18n/locale-provider";
import { ResponsiveCardImage } from "./responsive-card-image";
import "./recommended-place-banner.css";

export type RecommendedPlaceItem = { id: string; href: string; name: string; image?: string; location?: string };

/** Items come from the exact filtered result set, before nearby expansion. */
export function RecommendedPlacesBanner({ world, items }: { world: PublicPromotionWorld; items: readonly RecommendedPlaceItem[] }) {
  const {language, translate} = useSiteLanguage();
  const flags = usePublicPromotionFlags(world);
  const seen = new Set<string>();
  const featured = items.filter(item => {
    if (seen.has(item.id) || !flags(item.id)?.featured) return false;
    seen.add(item.id);
    return true;
  });
  if (!featured.length) return null;
  const title = {he:"מקומות מומלצים בחיפוש שלכם",en:"Featured places for your search",fr:"Établissements à découvrir pour votre recherche",ru:"Рекомендуемые места по вашему запросу"}[language];
  return <aside className="recommended-places" aria-label={title} data-promotion-world={world}>
    <h2>{title}</h2>
    <div className="recommended-places__rail">
      {featured.map(item => <Link className="recommended-places__place" href={item.href} target="_blank" rel="noopener noreferrer" key={item.id} data-promotion-supplier-id={item.id}>
        {item.image ? <ResponsiveCardImage src={item.image} alt={translate(item.name)} width={240} height={144} sizes="240px" loading="lazy" decoding="async" /> : null}
        <span><strong>{translate(item.name)}</strong>{item.location ? <small>{translate(item.location)}</small> : null}</span>
      </Link>)}
    </div>
  </aside>;
}
