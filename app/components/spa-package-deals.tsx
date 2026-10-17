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
import { millisecondsToNextIsraelDay } from "../lib/spa-package-deals";
type DealResponse = { checkedAt:string; days:string[]; offers:Record<string,Record<SpaDealAudience,SpaPackageDeal[]>> };
const audiences:SpaDealAudience[] = ["single","couple","group"];
export function SpaPackageDeals({sectionId="spa-package-deals"}:{sectionId?:string}) {
 const {language,translate} = useSiteLanguage();
 const text = spaDealCopy[language];
 const params = useSearchParams(); const pathname = usePathname(); const router = useRouter();
 const [data,setData] = useState<DealResponse|null>(null);
 const [status,setStatus] = useState<"loading"|"ready"|"error">("loading");
 const [attempt,setAttempt] = useState(0);
 const requestedDate = params.get("spaDealDate") || "";
 const requestedAudience = params.get("spaDealFor") as SpaDealAudience;
 const [selection,setSelection] = useState({ date:requestedDate, audience:audiences.includes(requestedAudience)?requestedAudience:"single" as SpaDealAudience });
 useEffect(()=>{setSelection({date:requestedDate,audience:audiences.includes(requestedAudience)?requestedAudience:"single"});},[requestedDate,requestedAudience]);
 const audience = selection.audience;
 const date = data?.days.includes(selection.date) ? selection.date : data?.days[0] || "";
 useEffect(()=>{
  if(!data) return;
  const timer=window.setTimeout(()=>setAttempt(value=>value+1),millisecondsToNextIsraelDay());
  return ()=>window.clearTimeout(timer);
 },[data]);
 useEffect(()=>{
  if(!data || !requestedDate || data.days.includes(requestedDate)) return;
  const query=new URLSearchParams(params.toString());query.set("spaDealDate",data.days[0]);
  router.replace(`${pathname}?${query.toString()}#${sectionId}`,{scroll:false});
 },[data,requestedDate,params,pathname,router,sectionId]);
 useEffect(()=>{
  const controller = new AbortController(); setStatus("loading"); setData(null);
  fetch("/api/spa/deals",{signal:controller.signal,cache:"no-store"})
   .then(response=>{if(!response.ok) throw new Error("unavailable"); return response.json();})
   .then((body:DealResponse)=>{if(!Array.isArray(body.days)||!body.offers||!body.checkedAt) throw new Error("invalid"); if(!controller.signal.aborted){setData(body);setStatus("ready");}})
   .catch(()=>{if(!controller.signal.aborted) setStatus("error");});
  return ()=>controller.abort();
 },[attempt]);
 useEffect(()=>{
  const refresh=()=>{if(data && Date.now()-Date.parse(data.checkedAt)>300_000) setAttempt(value=>value+1);};
  window.addEventListener("focus",refresh); return ()=>window.removeEventListener("focus",refresh);
 },[data]);
 function select(nextDate:string,nextAudience:SpaDealAudience){
  setSelection({date:nextDate,audience:nextAudience});
  const query=new URLSearchParams(params.toString());query.set("spaDealDate",nextDate);query.set("spaDealFor",nextAudience);
  router.replace(`${pathname}?${query.toString()}#${sectionId}`,{scroll:false});
 }
 const offers=status==="ready" ? data?.offers[date]?.[audience] || [] : [];
 const formatDate=(value:string)=>new Intl.DateTimeFormat(language==="he"?"he-IL":language,{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
 return <section id={sectionId} className="section shell spa-package-deals" aria-labelledby={`${sectionId}-title`} data-no-translate>
  <div className="section-head"><h2 id={`${sectionId}-title`}>{text.title}</h2><Link href="/spas">{text.all}</Link></div>
  <div className="spa-package-deals__controls">
   <div className="spa-package-deals__days" role="group" aria-label={text.days}>{data?.days.map((day,index)=><button type="button" key={day} aria-pressed={date===day} onClick={()=>select(day,audience)}><strong>{index===0?text.today:index===1?text.tomorrow:new Intl.DateTimeFormat(language==="he"?"he-IL":language,{weekday:"short",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`))}</strong><small>{new Intl.DateTimeFormat(language==="he"?"he-IL":language,{day:"numeric",month:"numeric",timeZone:"UTC"}).format(new Date(`${day}T12:00:00Z`))}</small></button>)}</div>
   <div className="spa-package-deals__audiences" role="group" aria-label={text.who}>{audiences.map(value=><button type="button" key={value} disabled={!data||status!=="ready"} aria-pressed={audience===value} onClick={()=>select(date,value)}>{text.audiences[value]}</button>)}</div>
  </div>
  <div aria-busy={status==="loading"} aria-live="polite">
   {status==="loading"?<div role="status" className="home-live-deals__loading"><p>{text.loading}</p><div className="home-live-deals__loading-cards" aria-hidden="true">{[0,1,2].map(index=><div className="home-live-deals__loading-card" key={index}><div className="home-live-deals__loading-image"/><div className="home-live-deals__loading-lines"><span/><span/><span/></div></div>)}</div></div>:null}
   {status==="error"?<div role="alert" className="event-rail-status"><p>{text.error}</p><button type="button" className="button secondary" onClick={()=>setAttempt(value=>value+1)}>{text.retry}</button></div>:null}
   {status==="ready"&&!offers.length?<p className="event-rail-status">{text.empty}</p>:null}
   {offers.length?<><div className="spa-package-deals__context"><p>{text.requested}: {formatDate(date)}</p><span>{text.order}</span></div><EventRail key={`${date}-${audience}`} title={text.title}>{offers.map(offer=>{
    const href=localizedPath(offer.href,language); const title=localizedSpaPackageTitle(offer,language,translate);
    const siteName=localizedBusinessText(offer.siteName,language,translate,latinBusinessAlias(offer.siteNameEN) || latinBusinessAlias(offer.siteName) || `Spa ${offer.siteId}`);
    const city=localizedBusinessText(offer.city,language,translate,"");
    return <article key={`${offer.siteId}-${offer.packageId}`} className="spa-deal-card" data-price={offer.price} data-site-id={offer.siteId} data-package-id={offer.packageId}>
     <PreviewCardGallery className="spa-deal-card__image" images={[offer.image]} href={href} name={title}/>
     <Link className="spa-deal-card__body" href={href} target="_blank" rel="noopener noreferrer"><small>{siteName}{city?` · ${city}`:""}</small><h3>{title}</h3><span className="spa-deal-card__meta">{offer.people ? spaDealPeople(offer.people,language) : text.audiences[audience]}{offer.durationMinutes?` · ${offer.durationMinutes} ${text.minutes}`:""}</span><div className="spa-deal-card__bottom"><strong><small>{text.from}</small> <bdi>{offer.price.toLocaleString(language==="he"?"he-IL":language)} ₪</bdi></strong><span>{text.details} <span aria-hidden="true">{language==="he"?"←":"→"}</span></span></div></Link>
    </article>;
   })}</EventRail><p className="spa-package-deals__note">{text.note}</p></>:null}
  </div>
 </section>;
}
