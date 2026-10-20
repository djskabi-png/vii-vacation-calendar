"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EventRail } from "./event-rail";
import { PreviewCardGallery } from "./preview-card-gallery";
import { useSiteLanguage } from "../i18n/locale-provider";
import { spaDealCopy } from "../i18n/spa-deal-copy";
import { localizedPath } from "../i18n/locale-routing";
import type { SpaDealAudience, SpaPackageDeal } from "../lib/spa-package-deals";
import "./spa-package-deals.css";
import { localizedSpaPackageTitle, spaDealPeople } from "../i18n/localized-spa-package";
import { latinBusinessAlias, localizedBusinessText } from "../i18n/localized-business-content";
import { validSpaDealDate } from "../lib/spa-package-deals";
import { eligibleDealDate, normalizeDealDate } from "../lib/deal-clock";
import { eventDealDate } from "../lib/event-deal-dates";
import { useDealClock } from "./use-deal-clock";
import { regionalAvailabilityRegion, regionalAvailabilityTitle } from "../lib/regional-availability";
import { spaSearchHref, spaSearchStateFromValues } from "../data/spa-search-landings";
import { regionalExpansionCopy } from "../i18n/regional-availability-copy";
import { discoveryJson } from "../lib/discovery-client-cache.ts";
import { discoveryCacheCopy } from "../i18n/discovery-cache-copy.ts";
import { orderDiscoveryRail } from "../lib/discovery-slider-order";
import { useDocumentSeed } from "./use-document-seed";
type DealResponse = { cache?:{status:string}; region?:string; expandedRegions?:Record<string,Partial<Record<SpaDealAudience,boolean>>>; checkedAt:string; days:string[]; offers:Record<string,Record<SpaDealAudience,SpaPackageDeal[]>> };
const audiences:SpaDealAudience[] = ["single","couple","group"];
export function SpaPackageDeals({sectionId="spa-package-deals",region}:{sectionId?:string;region?:string}) {
 const {language,translate} = useSiteLanguage();
 const clock = useDealClock();
 const documentSeed = useDocumentSeed();
 const text = spaDealCopy[language];
 const params = useSearchParams(); const pathname = usePathname(); const router = useRouter();
 const scope = regionalAvailabilityRegion(region ?? (/^\/(?:en\/|fr\/|ru\/)?spas(?:\/|$)/.test(pathname) ? params.get("location") : null));
 const regionLabel = scope?.label;
 const title = scope ? regionalAvailabilityTitle("spa",scope,language) : text.title;
 const [data,setData] = useState<DealResponse|null>(null);
 const [status,setStatus] = useState<"loading"|"ready"|"error">("loading");
 const [attempt,setAttempt] = useState(0);
 const requestedDate = params.get("spaDealDate") || "";
 const requestedAudience = params.get("spaDealFor") as SpaDealAudience;
 const [selection,setSelection] = useState({ date:requestedDate, audience:audiences.includes(requestedAudience)?requestedAudience:"single" as SpaDealAudience });
 useEffect(()=>{setSelection({date:requestedDate,audience:audiences.includes(requestedAudience)?requestedAudience:"single"});},[requestedDate,requestedAudience]);
 const audience = selection.audience;
 const days = clock ? data?.days.filter(day=>eligibleDealDate(day,clock.now)) || [] : [];
 const date = days.includes(selection.date) ? selection.date : days[0] || "";
 useEffect(()=>{
  if(!clock || !requestedDate || (eligibleDealDate(requestedDate,clock.now) && (!data || data.days.includes(requestedDate)))) return;
  const nextDate=days[0] || normalizeDealDate(requestedDate,clock.now);
  const query=new URLSearchParams(params.toString());query.set("spaDealDate",nextDate);
  router.replace(`${pathname}?${query.toString()}#${sectionId}`,{scroll:false});
 },[clock,data,requestedDate,params,pathname,router,sectionId,date]);
 useEffect(()=>{
  if(!clock) return;
  const controller = new AbortController(); setStatus("loading");
  discoveryJson<DealResponse>(regionLabel ? `/api/spa/deals?${new URLSearchParams({region:regionLabel})}` : "/api/spa/deals",clock.key,{signal:controller.signal})
   .then((body:DealResponse)=>{if(!Array.isArray(body.days)||!body.offers||!body.checkedAt||body.region!==regionLabel) throw new Error("invalid"); if(!controller.signal.aborted){setData(body);setStatus("ready");}})
   .catch(()=>{if(!controller.signal.aborted) setStatus("error");});
  return ()=>controller.abort();
 },[attempt,regionLabel,clock?.key]);
 useEffect(()=>{
  const refresh=()=>{if(data && Date.now()-Date.parse(data.checkedAt)>300_000) setAttempt(value=>value+1);};
  window.addEventListener("focus",refresh); return ()=>window.removeEventListener("focus",refresh);
 },[data]);
 function select(nextDate:string,nextAudience:SpaDealAudience){
  setSelection({date:nextDate,audience:nextAudience});
  const query=new URLSearchParams(params.toString());query.set("spaDealDate",nextDate);query.set("spaDealFor",nextAudience);
  router.replace(`${pathname}?${query.toString()}#${sectionId}`,{scroll:false});
 }
 const refreshing=status==="loading" && data!==null;
 const offers=data ? orderDiscoveryRail(data.offers[date]?.[audience] || [], { id: offer => `${offer.siteId}:${offer.packageId}`, seed: `${documentSeed}:spa:${date}:${audience}`, priority: offer => offer.price }) : [];
 const expandedRegion=!!scope && status==="ready" && data?.expandedRegions?.[date]?.[audience]===true;
 const linkDate=date || (clock && validSpaDealDate(selection.date)?normalizeDealDate(selection.date,clock.now):"");
 const allHref=scope ? `${spaSearchHref(spaSearchStateFromValues(scope.label,audience))}${linkDate?`?${new URLSearchParams({date:linkDate})}`:""}` : "/spas";
 const formatDate=(value:string)=>new Intl.DateTimeFormat(language==="he"?"he-IL":language,{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
 return <section id={sectionId} className="section shell spa-package-deals" aria-labelledby={`${sectionId}-title`} data-no-translate>
  <div className="section-head"><h2 id={`${sectionId}-title`}>{title}</h2><Link href={localizedPath(allHref,language)}>{text.all}</Link></div>
  <div className="spa-package-deals__surface">
  <div className="spa-package-deals__controls">
   <div className="spa-package-deals__days" role="group" aria-label={text.days}>{days.map(day=><button type="button" key={day} aria-pressed={date===day} onClick={()=>select(day,audience)}><strong>{day===eventDealDate(0,clock!.now)?text.today:day===eventDealDate(1,clock!.now)?text.tomorrow:new Intl.DateTimeFormat(language==="he"?"he-IL":language,{weekday:"short",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`))}</strong><small>{new Intl.DateTimeFormat(language==="he"?"he-IL":language,{day:"numeric",month:"numeric",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`))}</small></button>)}</div>
   <div className="spa-package-deals__audiences" role="group" aria-label={text.who}><span className="spa-package-deals__audiences-label">{text.who}</span><div className="spa-package-deals__audience-options">{audiences.map(value=><button type="button" key={value} disabled={!data||status!=="ready"} aria-pressed={audience===value} onClick={()=>select(date,value)}>{text.audiences[value]}</button>)}</div></div>
  </div>
  <div className={refreshing?"spa-package-deals__results is-refreshing":"spa-package-deals__results"} aria-busy={status==="loading"} aria-live="polite" inert={refreshing || undefined}>
   {status==="ready" && data?.cache?.status==="stale" && offers.length>0 ? <p className="regional-availability__expansion">{discoveryCacheCopy[language]}</p> : null}
   {status==="loading"&&!data?<div role="status" className="home-live-deals__loading"><p>{text.loading}</p><div className="home-live-deals__loading-cards" aria-hidden="true">{[0,1,2].map(index=><div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image"/><div className="home-live-deals__loading-lines"><span/><span/><span/></div></div>)}</div></div>:null}
   {status==="error"?<div role="alert" className={`event-rail-status${data?" event-rail-status--overlay":""}`}><p>{text.error}</p><button type="button" className="button secondary" onClick={()=>setAttempt(value=>value+1)}>{text.retry}</button></div>:null}
   {status==="ready"&&!offers.length?<p className="event-rail-status">{text.empty}</p>:null}
   {expandedRegion && offers.length > 0 ? <p className="regional-availability__expansion">{regionalExpansionCopy[language]}</p> : null}
   {offers.length?<><div className="spa-package-deals__context"><p>{text.requested}: {formatDate(date)}</p>{!expandedRegion ? <span>{text.order}</span> : null}</div><EventRail key={`${date}-${audience}`} title={title}>{offers.map(offer=>{
    const href=localizedPath(offer.href,language); const title=localizedSpaPackageTitle(offer,language,translate);
    const siteName=localizedBusinessText(offer.siteName,language,translate,latinBusinessAlias(offer.siteNameEN) || latinBusinessAlias(offer.siteName) || `Spa ${offer.siteId}`);
    const city=localizedBusinessText(offer.city,language,translate,"");
    return <article key={`${offer.siteId}-${offer.packageId}`} className="spa-deal-card" data-price={offer.price} data-site-id={offer.siteId} data-package-id={offer.packageId}>
     <PreviewCardGallery className="spa-deal-card__image" images={[offer.image]} href={href} name={title}/>
     <Link className="spa-deal-card__body" href={href} target="_blank" rel="noopener noreferrer"><small>{siteName}{city?` · ${city}`:""}</small><h3>{title}</h3><span className="spa-deal-card__meta">{offer.people ? spaDealPeople(offer.people,language) : text.audiences[audience]}{offer.durationMinutes?` · ${offer.durationMinutes} ${text.minutes}`:""}</span><div className="spa-deal-card__bottom"><strong><small>{text.from}</small> <bdi>{offer.price.toLocaleString(language==="he"?"he-IL":language)} ₪</bdi></strong><span>{text.details} <span aria-hidden="true">{language==="he"?"←":"→"}</span></span></div></Link>
    </article>;
   })}</EventRail></>:null}
  </div>
  </div>
 </section>;
}
