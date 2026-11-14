"use client";
import { useEffect, useRef, useState } from "react";
import { useSectionActivation } from "./use-section-activation";
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
import { openPlaceInSameTabOnMobile } from "../lib/mobile-place-navigation";
import { eligibleDealDate, normalizeDealDate } from "../lib/deal-clock";
import { eventDealDate } from "../lib/event-deal-dates";
import { useDealClock } from "./use-deal-clock";
import { regionalAvailabilityRegion, regionalAvailabilityTitle } from "../lib/regional-availability";
import { spaSearchHref, spaSearchStateFromValues } from "../data/spa-search-landings";
import { regionalExpansionCopy } from "../i18n/regional-availability-copy";
import { spaWeekdayDate, spaWeekdayPath, spaWeekdaySlugs, type SpaWeekdaySlug } from "../lib/spa-weekday-pages";
import { discoveryJson } from "../lib/discovery-client-cache.ts";
import { orderDiscoveryItems, orderDiscoveryRail } from "../lib/discovery-slider-order";
import {usePublicPromotionWeights} from "./use-public-promotion-weights";
import {discoverySeedRank} from "../lib/discovery-slider-order";
import { useDocumentSeed } from "./use-document-seed";
import { scheduleSpaDealFollowup } from "../lib/spa-followup";
import { spaDealDays, supportedSpaDealDate, spaRailSelectionHref } from "../lib/spa-deal-window.ts";
import { spaAllPackagesLabel } from "../i18n/spa-deal-link-copy.ts";
type DealResponse = { cache?:{status:string}; availabilityStatus?:"verified"|"refreshing"; region?:string; expandedRegions?:Record<string,Partial<Record<SpaDealAudience,boolean>>>; checkedAt:string; days:string[]; offers:Record<string,Record<SpaDealAudience,SpaPackageDeal[]>> };
const audiences:SpaDealAudience[] = ["single","couple","group"];
export function SpaPackageDeals({sectionId="spa-package-deals",region,fixedDateOffset,fixedDate,fixedWeekday,sectionTitle,layout="rail",deferUntilNearViewport=false}:{sectionId?:string;region?:string;fixedDateOffset?:0|1;fixedDate?:string;fixedWeekday?:SpaWeekdaySlug;sectionTitle?:string;layout?:"rail"|"grid";deferUntilNearViewport?:boolean}) {
 const {language,translate} = useSiteLanguage();
 const active = useSectionActivation(`${sectionId}-title`,deferUntilNearViewport,"900px 0px");
 const clock = useDealClock();
 const documentSeed = useDocumentSeed(false);
 const promotionWeight=usePublicPromotionWeights("spa");
 const text = spaDealCopy[language];
 const params = useSearchParams(); const pathname = usePathname(); const router = useRouter();
 const scope = regionalAvailabilityRegion(region ?? (/^\/(?:en\/|fr\/|ru\/)?spas(?:\/|$)/.test(pathname) ? params.get("location") : null));
 const regionLabel = scope?.label;
 const title = sectionTitle || (scope ? regionalAvailabilityTitle("spa",scope,language) : text.title);
 const clockKey=clock?.key;
 const presetDate = clock && fixedDateOffset !== undefined ? eventDealDate(fixedDateOffset,clock.now) : "";
 const resolvedWeekdayDate = clock && fixedWeekday ? spaWeekdayDate(fixedWeekday,clock.now) : "";
 const requestedDate = resolvedWeekdayDate || fixedDate || presetDate || params.get("spaDealDate") || "";
 const fullDateRequest = layout === "grid" || Boolean(fixedDate || fixedWeekday || fixedDateOffset !== undefined);
 const requestDate = fullDateRequest ? requestedDate : "";
 const unsupportedDate = Boolean(clock && fullDateRequest && !supportedSpaDealDate(requestDate,clock.now,true));
 const requestKey = `${regionLabel || "all"}:${clockKey || "loading"}:${fullDateRequest ? requestDate : "rail"}`;
 const [result,setResult] = useState<{key:string;data:DealResponse|null;status:"loading"|"ready"|"error"}>({key:"",data:null,status:"loading"});
 const data = result.key === requestKey ? result.data : null;
 const status = result.key === requestKey ? result.status : "loading";
 const [unavailableMedia,setUnavailableMedia] = useState<Set<string>>(()=>new Set());
 const [attempt,setAttempt] = useState(0);
 const followupKeyRef = useRef(requestKey);
 const followupCountRef = useRef(0);
 useEffect(() => { if (followupKeyRef.current !== requestKey) { followupKeyRef.current = requestKey; followupCountRef.current = 0; } }, [requestKey]);
 const requestedAudience = params.get("spaDealFor") as SpaDealAudience;
 const requestedAudienceValue:SpaDealAudience = audiences.includes(requestedAudience) ? requestedAudience : "single";
 const [audience,setAudience] = useState<SpaDealAudience>(requestedAudienceValue);
 const [railDate,setRailDate] = useState(params.get("spaDealDate") || "");
 useEffect(()=>{setAudience(requestedAudienceValue);},[requestedAudienceValue,pathname]);
 const queryDate = params.get("spaDealDate") || "";
 useEffect(()=>{setRailDate(queryDate);},[queryDate,pathname]);
 const days = clock ? spaDealDays(clock.now).filter(day=>!data || data.days.includes(day)) : [];
 const date = resolvedWeekdayDate || fixedDate || presetDate || (days.includes(railDate) ? railDate : days[0] || "");
 const pendingDateRef = useRef(date);
 useEffect(()=>{ if (date) pendingDateRef.current = date; },[date]);
 useEffect(()=>{
  if(fixedDateOffset !== undefined || fixedDate || fixedWeekday || !clock || !requestedDate || (eligibleDealDate(requestedDate,clock.now) && (!data || data.days.includes(requestedDate)))) return;
  const nextDate=date || normalizeDealDate(requestedDate,clock.now);
  const query=new URLSearchParams(params.toString());query.set("spaDealDate",nextDate);
  if(layout === "rail") { setRailDate(nextDate); window.history.replaceState(window.history.state,"",`${pathname}?${query.toString()}#${sectionId}`); }
  else router.replace(`${pathname}?${query.toString()}#${sectionId}`,{scroll:false});
 },[clock,data,requestedDate,params,pathname,router,sectionId,date,fixedDateOffset,fixedDate,fixedWeekday,layout]);
 useEffect(()=>{
  if(!clockKey || !active || unsupportedDate) return;
  const controller = new AbortController();
  let followupTimer: number | undefined;
   discoveryJson<DealResponse>(`/api/spa/deals?${new URLSearchParams({clock:clockKey,rotation:String(discoverySeedRank(regionLabel||"all",documentSeed)%8),...(regionLabel?{region:regionLabel}:{}),...(fullDateRequest?{full:"1",date:requestDate}:{})})}`,`${clockKey}:${requestDate || "all"}`,{signal:controller.signal, timeoutMs:6_000, totalTimeoutMs:10_000, retries:1, cache:"no-store", persist:true, freshMs:120_000, staleMs:900_000,
   shouldCache:value=>(value as DealResponse|null)?.availabilityStatus==="verified"})
   .then((body:DealResponse)=>{if(!Array.isArray(body.days)||!body.offers||!body.checkedAt||body.region!==regionLabel) throw new Error("invalid"); if(!controller.signal.aborted){
    const followup = scheduleSpaDealFollowup(body.availabilityStatus, followupCountRef.current, ()=>{if(!controller.signal.aborted) setAttempt(value=>value+1);});
    setResult(current=>{if(body.availabilityStatus!=="refreshing")return{key:requestKey,data:body,status:"ready"};
     const previous=current.key===requestKey&&current.data?.availabilityStatus==="verified"?current.data:null;
     return{key:requestKey,data:previous,status:followup?"loading":previous?"ready":"error"};});
    if(followup){followupCountRef.current = followup.nextCount; followupTimer = followup.timer as number; }}})
   .catch(()=>{if(!controller.signal.aborted) setResult(current=>current.key===requestKey&&current.data?{...current,status:"ready"}:{key:requestKey,data:null,status:"error"});});
  return ()=>{controller.abort(); if(followupTimer !== undefined) window.clearTimeout(followupTimer);};
 },[active,attempt,regionLabel,clockKey,requestKey,requestDate,fullDateRequest,unsupportedDate,documentSeed]);
 useEffect(()=>{
  const refresh=()=>{if(data && Date.now()-Date.parse(data.checkedAt)>300_000){setResult(current=>({...current,status:"loading"}));setAttempt(value=>value+1);}};
  window.addEventListener("focus",refresh); return ()=>window.removeEventListener("focus",refresh);
 },[data]);
 function select(nextDate:string|undefined,nextAudience:SpaDealAudience){
  const targetDate = nextDate || pendingDateRef.current || date;
  if (targetDate) pendingDateRef.current = targetDate;
  setAudience(nextAudience);
  if (layout === "rail") {
   setRailDate(targetDate);
   window.history.replaceState(window.history.state,"",spaRailSelectionHref(pathname,new URLSearchParams(params.toString()),targetDate,nextAudience,sectionId));
   return;
  }
  if (fixedDateOffset===undefined && !scope) {
  const weekday = spaWeekdaySlugs[new Date(`${targetDate}T12:00:00Z`).getUTCDay()];
   const targetPath = localizedPath(spaWeekdayPath(weekday),language);
   if (targetPath === pathname) {
    const query = new URLSearchParams(params.toString());
    query.delete("spaDealDate");
    query.set("spaDealFor",nextAudience);
    window.history.pushState(null,"",`${targetPath}?${query.toString()}`);
    return;
   }
   router.push(`${targetPath}?spaDealFor=${encodeURIComponent(nextAudience)}`);
   return;
  }
  const query=new URLSearchParams(params.toString());query.set("spaDealDate",targetDate);query.set("spaDealFor",nextAudience);
  router.replace(`${pathname}?${query.toString()}#${sectionId}`,{scroll:false});
 }
 const requestPending=!unsupportedDate && (status==="loading" || Boolean(data && data.region!==regionLabel));
 const refreshing=requestPending && data!==null;
 const offers=data ? (layout === "grid" ? orderDiscoveryItems : orderDiscoveryRail)(data.offers[date]?.[audience] || [], { id: offer => `${offer.siteId}:${offer.packageId}`, seed: `${documentSeed}:spa:${date}:${audience}`, promotionWeight:offer=>promotionWeight(offer.siteId), priority: offer => offer.price }) : [];
 const visibleOffers=offers;
 const expandedRegion=!!scope && status==="ready" && data?.region===regionLabel && data?.expandedRegions?.[date]?.[audience]===true;
 const linkDate=date || (clock && validSpaDealDate(requestedDate)?normalizeDealDate(requestedDate,clock.now):"");
 const today = clock ? eventDealDate(0,clock.now) : "";
 const tomorrow = clock ? eventDealDate(1,clock.now) : "";
 const futureWeekday = date && date !== today && date !== tomorrow ? spaWeekdaySlugs[new Date(`${date}T12:00:00Z`).getUTCDay()] : "";
 const allBase=scope ? spaSearchHref(spaSearchStateFromValues(scope.label,audience)) : date === today ? "/spas/today" : date === tomorrow ? "/spas/tomorrow" : futureWeekday ? spaWeekdayPath(futureWeekday) : "/spas";
 const allQuery=new URLSearchParams({spaDealFor:audience,...(scope && linkDate?{date:linkDate}:{})});
 const allHref=`${allBase}?${allQuery}`;
 const allLabel = spaAllPackagesLabel(date,today,tomorrow,language,text.all);
 const formatDate=(value:string)=>new Intl.DateTimeFormat(language==="he"?"he-IL":language,{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
 return <section id={sectionId} className={`section shell spa-package-deals${layout==="grid"?" spa-package-deals--grid":""}`} aria-labelledby={`${sectionId}-title`} data-no-translate>
  <div className="section-head"><h2 id={`${sectionId}-title`}>{title}</h2>{layout==="rail"?<Link href={localizedPath(allHref,language)}>{allLabel}</Link>:null}</div>
  <div className="spa-package-deals__surface">
  <div className="spa-package-deals__controls">
   {fixedDateOffset===undefined?<div className="spa-package-deals__days" role="group" aria-label={text.days}>{days.map(day=><button type="button" key={day} aria-pressed={date===day} onClick={()=>select(day,audience)}><strong>{day===eventDealDate(0,clock!.now)?text.today:day===eventDealDate(1,clock!.now)?text.tomorrow:new Intl.DateTimeFormat(language==="he"?"he-IL":language,{weekday:"short",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`))}</strong><small>{new Intl.DateTimeFormat(language==="he"?"he-IL":language,{day:"numeric",month:"numeric",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`))}</small></button>)}</div>:null}
   <div className="spa-package-deals__audiences" role="group" aria-label={text.who}><span className="spa-package-deals__audiences-label">{text.who}</span><div className="spa-package-deals__audience-options">{audiences.map(value=><button type="button" key={value} disabled={!clock} aria-pressed={audience===value} onClick={()=>select(undefined,value)}>{text.audiences[value]}</button>)}</div></div>
  </div>
  <div className={refreshing?"spa-package-deals__results is-refreshing":"spa-package-deals__results"} aria-busy={requestPending} aria-live="polite" inert={refreshing || undefined}>
   {unsupportedDate?<p className="event-rail-status" role="status">{{he:"החבילות לתאריך הזה עדיין לא פורסמו",en:"Packages for this date have not been published yet",ru:"Пакеты на эту дату ещё не опубликованы",fr:"Les forfaits pour cette date ne sont pas encore publiés"}[language]}</p>:null}
   {!unsupportedDate&&status==="loading"&&!data?<div role="status" className="home-live-deals__loading"><p>{text.loading}</p><div className="home-live-deals__loading-cards" aria-hidden="true">{[0,1,2].map(index=><div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image"/><div className="home-live-deals__loading-lines"><span/><span/><span/></div></div>)}</div></div>:null}
   {!unsupportedDate&&status==="error"?<div role="alert" className={`event-rail-status${data?" event-rail-status--overlay":""}`}><p>{text.error}</p><button type="button" className="button secondary" onClick={()=>{followupCountRef.current=0;setResult({key:requestKey,data:null,status:"loading"});setAttempt(value=>value+1);}}>{text.retry}</button></div>:null}
   {!unsupportedDate&&status==="ready"&&!offers.length?<p className="event-rail-status">{text.empty}</p>:null}
   {expandedRegion && offers.length > 0 ? <p className="regional-availability__expansion">{regionalExpansionCopy[language]}</p> : null}
   {visibleOffers.length?<><div className="spa-package-deals__context"><p>{`${text.requested}: ${formatDate(date)}`}</p>{data?.availabilityStatus!=="refreshing"&&!expandedRegion ? <span>{text.order}</span> : null}</div><EventRail key={`${date}-${audience}`} title={title}>{visibleOffers.map((offer,index)=>{
    const href=localizedPath(offer.href,language); const title=localizedSpaPackageTitle(offer,language,translate);
    const siteName=localizedBusinessText(offer.siteName,language,translate,latinBusinessAlias(offer.siteNameEN) || latinBusinessAlias(offer.siteName) || `Spa ${offer.siteId}`);
    const city=localizedBusinessText(offer.city,language,translate,"");
    const mediaKey=`${offer.siteId}:${offer.packageId}:${offer.image}`;
    return <article key={`${offer.siteId}-${offer.packageId}`} className="spa-deal-card" data-price={offer.price} data-site-id={offer.siteId} data-package-id={offer.packageId}>
     {unavailableMedia.has(mediaKey) ? <Link className="spa-deal-card__image spa-deal-card__image--unavailable" href={href} target="_blank" rel="noopener noreferrer" aria-label={title} onClick={(event)=>openPlaceInSameTabOnMobile(event,href)}><span>{siteName}</span></Link> : <PreviewCardGallery className="spa-deal-card__image" images={[offer.image]} href={href} name={title} priority={active && index<2} onMediaUnavailable={()=>setUnavailableMedia(previous=>new Set(previous).add(mediaKey))}/>}
     <Link className="spa-deal-card__body" href={href} target="_blank" rel="noopener noreferrer" onClick={(event)=>openPlaceInSameTabOnMobile(event,href)}><small>{siteName}{city?` · ${city}`:""}</small><h3>{title}</h3><span className="spa-deal-card__meta">{offer.people ? spaDealPeople(offer.people,language) : text.audiences[audience]}{offer.durationMinutes?` · ${offer.durationMinutes} ${text.minutes}`:""}</span><div className="spa-deal-card__bottom"><strong><small>{text.from}</small> <bdi dir="ltr">₪&nbsp;{offer.price.toLocaleString(language==="he"?"he-IL":language)}</bdi></strong><span>{text.details} <span aria-hidden="true">{language==="he"?"←":"→"}</span></span></div></Link>
    </article>;
   })}</EventRail></>:null}
  </div>
  </div>
 </section>;
}
