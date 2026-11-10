"use client";

import Link from "next/link";
import type { Property } from "../data/site-data";
import { vacationRegionHierarchy, type VacationRegion } from "../data/vacation-landings";
import { useSiteLanguage } from "../i18n/locale-provider";

export function VacationGeographyNav({ region, inventory }: { region: VacationRegion; inventory: Property[] }) {
  const { translate } = useSiteLanguage();
  const hierarchy = vacationRegionHierarchy(region, inventory);
  if (!hierarchy.subregions.length && !hierarchy.towns.length) return null;
  return <nav className="vacation-geography-nav" aria-label={translate("אזורים ויישובים בנופש")}>
    {hierarchy.subregions.length ? <details open>
      <summary>{translate("אזורים")} · {translate(region.label)}</summary>
      <div className="vacation-geography-nav__links">
        {hierarchy.subregions.map((item) => <Link key={`area-${item.label}`} href={item.path}><span>{translate(item.label)}</span><small>{item.count}</small></Link>)}
      </div>
    </details> : null}
    {hierarchy.towns.length ? <details open>
      <summary>{translate("יישובים באזור")}</summary>
      <div className="vacation-geography-nav__links">
        {hierarchy.towns.map((item) => <Link key={`town-${item.label}`} href={item.path}><span>{translate(item.label)}</span><small>{item.count}</small></Link>)}
      </div>
    </details> : null}
  </nav>;
}
