"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ListingMap } from "../../components/listing-map";
import { PageShell } from "../../components/page-shell";
import { DiscoveryCard } from "../../components/discovery-card";
import { ListingAccessibility } from "../../components/listing-accessibility";
import { eventPlaceHref, eventPlaces } from "../../data/site-data";
import { providerProfiles } from "../../data/world-data";
import { MasuExperience } from "../../components/masu-experience";
import { CalendarIcon, PinIcon } from "../../site-header";
import { GalleryExperience } from "../../components/gallery-experience";
import { GuestReviewStudio } from "../../components/guest-review-studio";
import { BreadcrumbTrail } from "../../components/breadcrumb-trail";
import { DetailStickyDock, type DetailSectionLink } from "../../components/detail-sticky-dock";
import { ModernSelect } from "../../components/modern-select";
import { FavoriteButton } from "../../components/favorite-button";
import { WhatsAppLeadButton } from "../../components/whatsapp-lead-button";
import { ShareButton } from "../../components/share-dialog";

export default function EventPlacePage({ initialSlug }: { initialSlug: string }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStart, setGalleryStart] = useState(0);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [reference, setReference] = useState("");
  const [submissionId, setSubmissionId] = useState("");
  const place = useMemo(() => eventPlaces.find((item) => item.slug === initialSlug) || eventPlaces[0], [initialSlug]);
  const ownerWhatsapp = place.contact?.whatsapp || place.contact?.phone;
  const sectionLinks = useMemo<DetailSectionLink[]>(() => [
    { href: "#event-about", label: "על המקום" },
    { href: "#event-features", label: "מתקנים" },
    { href: "#accessibility", label: "נגישות" },
    { href: "#event-map", label: "מיקום" },
    { href: "#reviews", label: "חוות דעת" },
    { href: "#event-booking", label: "הזמנה" },
  ], []);
  const eventProviders = useMemo(() => {
    const masu = providerProfiles.find((item) => item.id === "masu-home-wellness");
    const otherProviders = providerProfiles.filter((item) => item.id !== "masu-home-wellness");
    const start = place.slug.length % otherProviders.length;
    return [masu, ...otherProviders.slice(start), ...otherProviders.slice(0, start)].filter((item): item is (typeof providerProfiles)[number] => Boolean(item)).slice(0, 3);
  }, [place.slug]);

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitState === "submitting" || submitState === "success") return;
    setSubmitState("submitting");
    const form = event.currentTarget;
    const values = new FormData(form);
    const id = submissionId || crypto.randomUUID();
    if (!submissionId) setSubmissionId(id);
    try {
      const response = await fetch("/api/leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: id,
          purpose: "booking",
          world: "events",
          name: values.get("name"),
          phone: values.get("phone"),
          organization: place.name,
          location: `${place.location}, ${place.area}`,
          message: `בקשת התאמה ל${place.name}. תאריך: ${values.get("date")}. משתתפים: ${values.get("guests")}. סוג אירוע: ${values.get("eventType")}.`,
          honey: values.get("company_site"),
          privacyAccepted: values.get("privacy") === "on",
          sourcePage: window.location.href,
        }),
      });
      const result = await response.json() as { success?: boolean; reference?: string };
      if (!response.ok || !result.success) throw new Error("submission failed");
      setReference(result.reference || "");
      setSubmitState("success");
    } catch {
      setSubmitState("error");
    }
  }

  return (
    <PageShell variant="events">
      <main id="main-content" className="event-place-page">
        <BreadcrumbTrail items={[{ name: "ראשי", path: "/" }, { name: "אירועים", path: "/events" }, { name: "מקומות לאירועים", path: "/events/search" }, { name: place.name }]} />
        <section className="shell property-title event-title"><div><span className="eyebrow">{place.type}</span><h1>{place.name}</h1><p><PinIcon />{place.location}, {place.area}</p></div><div className="property-title__side"><div className="property-title__actions"><FavoriteButton compact={false} id={place.slug} world="events" name={place.name} location={`${place.location}, ${place.area}`} image={place.image} href={eventPlaceHref(place)} meta={`${place.type} · עד ${place.guests} אורחים`} /><ShareButton title={place.name} kind="event" />{ownerWhatsapp ? <WhatsAppLeadButton world="events" placeId={place.slug} placeName={place.name} businessPhone={ownerWhatsapp} serviceName={place.type} buttonClassName="property-whatsapp-action" /> : null}</div><a className="button primary" href="#event-booking">הזמנה אונליין</a></div></section>
        <section className="shell property-gallery">{place.images.map((image, index) => <button key={image} type="button" onClick={() => { setGalleryStart(index); setGalleryOpen(true); }} aria-label={`פתיחת תמונה ${index + 1} של ${place.name}`}><img src={image} alt={`${place.name}, תמונה ${index + 1}`} />{index === 4 && <span>לגלריה המלאה</span>}</button>)}</section>

        <DetailStickyDock name={place.name} location={`${place.location}, ${place.area}`} sections={sectionLinks} onlineHref="#event-booking" onlineLabel="בדיקת תאריך לאירוע" />

        <div className="shell event-place-layout">
          <div>
            <section className="property-facts"><div><b>{place.guests}</b><span>אורחים לכל היותר</span></div><div><b>{place.units || 1}</b><span>{(place.units || 1) > 1 ? "מתחמים" : "מתחם"}</span></div><div><b>{place.eventTypes.length}</b><span>סוגי אירועים</span></div><div><b>{place.features.length}</b><span>מאפיינים מרכזיים</span></div></section>
            <section id="event-about"><span className="eyebrow">כל מה שחשוב לדעת</span><h2>על המקום</h2><p>{place.description}</p><div className="feature-chips audience-chips">{place.eventTypes.map((item) => <span key={item}>{item}</span>)}</div></section>
            <section id="event-features"><h2>מתקנים ואפשרויות</h2><div className="feature-list">{place.features.map((feature) => <span key={feature}>✓ {feature}</span>)}</div></section>
            <section><h2>למי המקום מתאים</h2><div className="event-suitable-grid">{place.audiences.map((audience) => <article key={audience}><span>✓</span><b>{audience}</b></article>)}</div></section>
            <ListingAccessibility slug={place.slug} />
            <section id="event-map" className="location-card"><div><span className="eyebrow">המיקום</span><h2>{place.location}</h2><p>{place.area}</p><span className="location-card__inline-note">מגדילים, מקטינים ומזיזים את המפה כאן בעמוד.</span></div><ListingMap listings={[place]} mode="events" single autoLoad /></section>
            <section className="policies-section"><h2>חשוב לדעת</h2><div><article><b>קיבולת</b><p>עד {place.guests} אורחים לפי פרטי המקום.</p></article><article><b>זמינות</b><p>הזמינות הסופית נבדקת מול צוות המקום לאחר שליחת הבקשה.</p></article><article><b>מחיר</b><p>המחיר תלוי בתאריך, במספר המשתתפים ובאופי האירוע.</p></article><article><b>בקשת התאמה</b><p>הטופס מועבר למערכת הלידים עם פרטי המקום והאירוע שבחרתם.</p></article></div></section>
            <GuestReviewStudio placeName={place.name} subjectId={place.slug} />
          </div>

          <aside id="event-booking" className="booking-card event-inquiry"><CalendarIcon /><span className="eyebrow">הזמנה אונליין</span><h2>מזמינים את האירוע</h2>{submitState === "success" ? <div className="inquiry-success" role="status"><b>ההזמנה נקלטה</b><p>הפרטים נשמרו במערכת. אישור סופי יישלח לאחר בדיקת זמינות ומחיר.</p>{reference ? <strong dir="ltr">{reference}</strong> : null}</div> : <form onSubmit={submitInquiry}><label>תאריך מבוקש<input name="date" type="date" required /></label><label>כמות משתתפים<input name="guests" type="number" min="1" max={place.guests} placeholder="הקלידו כמות" required /></label><ModernSelect name="eventType" label="סוג האירוע" defaultValue={place.eventTypes[0]} options={place.eventTypes.map((item) => ({ value: item, label: item }))} /><label>שם מלא<input name="name" type="text" autoComplete="name" minLength={2} required /></label><label>טלפון<input name="phone" type="tel" inputMode="tel" autoComplete="tel" minLength={7} required /></label><label className="form-honey" aria-hidden="true">אתר החברה<input name="company_site" tabIndex={-1} autoComplete="off" /></label><label className="consent legal-consent"><input name="privacy" type="checkbox" required /><span>קראתי והסכמתי ל<Link href="/legal/terms">תקנון האתר</Link> ול<Link href="/legal/privacy">מדיניות הפרטיות</Link>, ואני מאשר או מאשרת טיפול בפרטים לצורך ההזמנה.</span></label><button className="button primary wide" type="submit" disabled={submitState === "submitting"}>{submitState === "submitting" ? "שולחים..." : "שליחת ההזמנה"}</button>{submitState === "error" ? <p className="form-error" role="alert">השליחה לא הושלמה. הפרטים נשארו בטופס ואפשר לנסות שוב.</p> : null}<small>אין חיוב לפני אישור זמינות, מחיר ותנאי האירוע.</small></form>}</aside>
        </div>

        <section className="section property-complements">
          <div className="shell">
            <div className="section-head"><div><span className="eyebrow">מרכיבים את כל האירוע</span><h2>ספקים שיכולים להשלים את החגיגה</h2></div><Link href="/providers">לכל הספקים</Link></div>
            <p className="property-complements__note">הפרטים מבוססים על מידע ציבורי. ספק שלא אומת כשותף פעיל מסומן כך בעמוד שלו, והזמינות מאושרת לפני הזמנה.</p>
            <div className="discovery-grid discovery-grid--compact">{eventProviders.map((item) => <DiscoveryCard key={item.id} item={item} />)}</div>
          </div>
        </section>

        <div className="section shell"><MasuExperience context="event" /></div>

        <section className="section section-tint"><div className="shell"><div className="section-head"><h2>מקומות נוספים לאירוע</h2></div><div className="event-more-grid">{eventPlaces.filter((item) => item.slug !== place.slug).slice(0, 3).map((item) => <Link key={item.slug} href={eventPlaceHref(item)}><img src={item.image} alt={item.name} /><div><b>{item.name}</b><span>{item.location} · עד {item.guests} אורחים</span></div></Link>)}</div></div></section>
      </main>

      <GalleryExperience key={`${place.slug}-${galleryOpen ? galleryStart : "closed"}`} property={place} open={galleryOpen} initialIndex={galleryStart} onClose={() => setGalleryOpen(false)} />
    </PageShell>
  );
}
