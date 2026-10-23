import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("place WhatsApp actions save a complete lead before opening the conversation", async () => {
  const source = await read("app/components/whatsapp-lead-button.tsx");

  assert.match(source, /name="name"[^>]*required|required[^>]*name="name"/);
  assert.match(source, /name="phone"[^>]*required|required[^>]*name="phone"/);
  assert.match(source, /name="requested_date"/);
  assert.doesNotMatch(source, /<input[^>]*name="requested_date"[^>]*required|<input[^>]*required[^>]*name="requested_date"/);
  assert.doesNotMatch(source, /<input[^>]*name="requested_till"[^>]*required|<input[^>]*required[^>]*name="requested_till"/);
  assert.match(source, /name="guests"/);
  assert.doesNotMatch(source, /<input[^>]*name="guests"[^>]*required/);
  assert.doesNotMatch(source, /name="privacy"[^>]*required|required[^>]*name="privacy"/);
  assert.match(source, /privacyAccepted: true/);
  assert.match(source, /fetch\("\/api\/leads\/"/);
  assert.match(source, /purpose: "whatsapp_enquiry"/);
  assert.match(source, /sourceChannel: "detail_whatsapp"/);

  const successCheck = source.indexOf("if (!response.ok || !result.success)");
  const whatsappNavigation = source.indexOf("window.location.assign(`https://wa.me/");
  assert.ok(successCheck > -1 && whatsappNavigation > successCheck, "WhatsApp must open only after lead persistence succeeds");
});

test("the server owns the verified SMS notification request", async () => {
  const source = await read("app/api/leads/route.ts");

  assert.match(source, /missing_whatsapp_enquiry_context/);
  assert.match(source, /payload\.requestedDate && !\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\//);
  assert.match(source, /delete forwardedPayload\.notificationRequest/);
  assert.match(source, /channel: "sms"/);
  assert.match(source, /recipientSource: "verified_place_contact"/);
  assert.match(source, /template: "vii_whatsapp_lead"/);
  assert.match(source, /sourceBrand: "VII"/);
  assert.match(source, /if \(isWhatsAppEnquiry\) await saveWhatsAppLead\(payload, reference\)/);
});

test("completed WhatsApp popups are counted once and visible only to approved admins", async () => {
  const [storage, report, page] = await Promise.all([
    read("app/lib/whatsapp-lead-storage.ts"),
    read("app/api/admin/whatsapp-leads/route.ts"),
    read("app/admin/whatsapp-leads/page.tsx"),
  ]);
  assert.match(storage, /submission_id TEXT PRIMARY KEY/);
  assert.match(storage, /INSERT OR IGNORE INTO whatsapp_leads/);
  assert.match(report, /authorizedAdminSession\(request\)/);
  assert.match(report, /import \{ authorizedAdminSession \} from "\.\.\/\.\.\/\.\.\/lib\/admin-session\.ts"/);
  assert.match(report, /if \(!session\)/);
  assert.match(report, /SELECT COUNT\(\*\) AS count FROM whatsapp_leads/);
  assert.match(page, /המעבר אינו הוכחה שהלקוח שלח את ההודעה/);
  assert.match(storage, /handoff_started_at/);
  assert.match(page, /מעבר ל־WhatsApp/);
  assert.match(page, /\/api\/auth\/google\?returnTo=%2Fadmin%2Fwhatsapp-leads/);
});

test("all current business WhatsApp entry points use the shared tracked flow", async () => {
  const [business, provider] = await Promise.all([
    read("app/business/client-page.tsx"),
    read("app/discover/place/client-page.tsx"),
  ]);

  for (const source of [business, provider]) {
    assert.match(source, /WhatsAppLeadButton/);
    assert.doesNotMatch(source, /https:\/\/wa\.me/);
  }
  assert.match(business, /buttonClassName="property-whatsapp-action"/);
  assert.match(business, /world=\{activeWorld\}/);
  assert.doesNotMatch(provider, /ProviderWhatsAppDialog|whatsappService|onWhatsApp/);
});

test("the lead modal is keyboard and mobile safe", async () => {
  const [component, css] = await Promise.all([
    read("app/components/whatsapp-lead-button.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(component, /role="dialog"/);
  assert.match(component, /import \{ createPortal \} from "react-dom"/);
  assert.match(component, /open \? createPortal\(/);
  assert.match(component, /<\/div>, document\.body\)/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /aria-describedby=/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /event\.key !== "Tab"/);
  assert.match(component, /triggerRef\.current\?\.focus/);
  assert.match(css, /\.whatsapp-lead-dialog\s*\{[^}]*font-family:\s*Rubik,Heebo,Assistant,Arial,sans-serif/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.whatsapp-lead-dialog\s*\{[^}]*max-height:\s*calc\(100dvh - 18px\)/s);
  assert.match(css, /@media \(max-height: 650px\)[\s\S]*\.whatsapp-lead-dialog\s*\{[^}]*max-height:\s*100dvh/s);
});

test("the privacy policy opens separately without discarding the lead modal", async () => {
  const source = await read("app/components/whatsapp-lead-button.tsx");

  assert.match(source, /href="\/legal\/privacy" target="_blank" rel="noopener noreferrer"/);
  assert.match(source, /newTabLabel\[language\]/);
});
test("the tracked lead event is available to analytics without bypassing consent", async () => {
  const source = await read("app/lib/analytics.ts");
  assert.match(source, /event: "vii_whatsapp_lead_saved"/);
  assert.match(source, /vii:whatsapp-lead-saved/);
  assert.match(source, /vii-cookie-choice/);
  assert.match(source, /lead_reference/);
});
test("the shared lead modal is clean and progressively discloses optional details", async () => {
  const [component, css] = await Promise.all([
    read("app/components/whatsapp-lead-button.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(component, /function WhatsAppIcon\(\)/);
  assert.match(component, /whatsapp-lead-dialog__header/);
  assert.doesNotMatch(component, /whatsapp-lead-dialog__conversation|<AccountFormPrompt/);
  assert.match(component, /const localizedPlaceName = translate\(placeName\)/);
  assert.match(component, /className="whatsapp-lead-dialog__place">\{localizedPlaceName\}/);
  assert.match(component, /<details className="whatsapp-lead-dialog__optional">/);
  assert.doesNotMatch(component, /<details[^>]*\bopen[=> ]/);
  assert.match(component, /defaultValue=\{initialDate\}/);
  assert.match(component, /defaultValue=\{initialTill\}/);
  assert.match(component, /defaultValue=\{initialGuests\}/);
  assert.match(component, /defaultValue=\{account\?\.name/);
  assert.match(component, /defaultValue=\{account\?\.phone/);
  assert.match(component, /className=\{`\$\{buttonClassName\} whatsapp-lead-trigger`\}/);
  assert.match(component, /aria-busy=\{state === "submitting"\}/);
  assert.match(component, /whatsapp-lead-dialog__spinner/);
  assert.match(component, /element\.getClientRects\(\)\.length > 0/);
  assert.match(component, /element\.closest\("details:not\(\[open\]\)"\) \|\| element\.tagName === "SUMMARY"/);
  assert.match(component, /closeRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(component, /stateRef\.current === "submitting"/);
  assert.match(component, /errorRef\.current\?\.scrollIntoView\(\{ block: "nearest" \}\)/);
  assert.match(component, /onInvalidCapture=[\s\S]*optional\.open = true/);
  assert.match(component, /m6 6 12 12M18 6 6 18/);
  assert.match(css, /\.whatsapp-lead-dialog \.dialog-close\s*\{[^}]*width: 44px[^}]*height: 44px[^}]*padding: 0[^}]*display: grid[^}]*place-items: center/);
  assert.match(css, /\.whatsapp-lead-dialog\s*\{[^}]*width: min\(460px,100%\)/);
  assert.match(css, /prefers-reduced-motion: reduce[^}]*whatsapp-lead-dialog__spinner/);
});

test("isolated enquiry handler preserves optional context and never navigates on failure", async () => {
  const source = await read("app/components/whatsapp-lead-button.tsx");
  const handler = source.slice(source.indexOf("  async function submit("), source.indexOf("\n  return <>"))
    .replace("event: FormEvent<HTMLFormElement>", "event")
    .replace(/ as \{ success\?: boolean; reference\?: string \}/, "");
  const run = new Function("deps", `const {setState,state,submissionId,setSubmissionId,crypto,FormData,labels,world,placeId,placeName,serviceName,window,fetch,localizedPlaceName,trackWhatsAppLeadSaved,trackWhatsAppHandoff,businessPhone,whatsappNumber} = deps; ${handler}; return submit({preventDefault(){},currentTarget:{}});`);
  for (const mode of ["success", "error", "retry", "busy"]) {
    const calls = [], states = [], navigations = [];
    const payloads = [];
    const deps = {
      state: mode === "busy" ? "submitting" : "idle", submissionId: mode === "retry" ? "stable-id" : "", setSubmissionId: id => calls.push(`id:${id}`),
      crypto: { randomUUID: () => "new-id" }, setState: state => states.push(state),
      FormData: class { get(key) { return {name:"Test User",phone:"0500000000",requested_date:"2026-12-10",requested_till:"2026-12-12",guests:"6",company_site:""}[key]; } },
      labels: new Proxy({}, {get: (_, key) => key === "messageIntro" ? name => `Hello ${name}` : key}),
      world:"vacation",placeId:"test-only",placeName:"Fixture",localizedPlaceName:"Fixture",serviceName:"Selected unit",businessPhone:"0500000000",whatsappNumber: () => "972500000000",
      window:{location:{href:"https://example.test/fixture",assign:url => navigations.push(url)}},
      fetch: async (url, options) => { calls.push(url); payloads.push(JSON.parse(options.body)); return {ok:mode !== "error",json:async () => ({success:mode !== "error",reference:"fixture-ref"})}; },
      trackWhatsAppLeadSaved: () => calls.push("tracked"),
      trackWhatsAppHandoff: () => calls.push("handoff-tracked"),
    };
    await run(deps);
    if (mode === "busy") { assert.deepEqual(calls, []); assert.deepEqual(navigations, []); continue; }
    const payload = payloads[0];
    assert.equal(payload.requestedDate, "2026-12-10");
    assert.equal(payload.requestedTill, "2026-12-12");
    assert.equal(payload.guests, "6");
    assert.equal(payload.serviceName, "Selected unit");
    assert.equal(payload.privacyAccepted, true);
    assert.equal(payload.submissionId, mode === "retry" ? "stable-id" : "new-id");
    if (mode === "error") { assert.deepEqual(navigations, []); assert.equal(states.at(-1), "error"); assert.ok(!calls.includes("tracked")); }
    else { assert.equal(navigations.length, 1); assert.match(decodeURIComponent(navigations[0]), /2026-12-10[\s\S]*2026-12-12[\s\S]*6[\s\S]*Selected unit[\s\S]*fixture-ref/); assert.equal(payloads[1].reference, "fixture-ref"); assert.ok(calls.includes("tracked")); assert.ok(calls.includes("handoff-tracked")); }
  }
});

test("event result cards expose the same tracked phone and WhatsApp actions as vacation cards", async () => {
  const [eventsPage, eventCard, actions] = await Promise.all([
    read("app/events/search/page.tsx"),
    read("app/components/event-result-card.tsx"),
    read("app/components/card-contact-actions.tsx"),
  ]);
  const events = `${eventsPage}\n${eventCard}`;

  assert.match(events, /EventCardContactActions/);
  assert.match(events, /phone=\{place\.contact\?\.phone\}/);
  assert.match(events, /whatsapp=\{place\.contact\?\.whatsapp\}/);
  assert.match(actions, /<DirectPhoneLink[^\n]*tracking=\{\{ placeId, placeName, world, placement: world === "events" \? "event_card" : "discovery_card" \}\}/);
  assert.doesNotMatch(actions, /trackPhoneReveal|setPhoneVisible/);
  assert.match(actions, /<WhatsAppLeadButton world=\{world\}/);
  assert.match(actions, /const whatsappNumber = supplierContactNumber\(whatsapp\);/);
  assert.doesNotMatch(actions, /whatsapp \|\| phone/);
  assert.match(actions, /stay-card__contact--revealed/);
});

test("catalog refresh preserves only the explicit supplier WhatsApp field", async () => {
  const source = await read("scripts/build-sergey-public-catalog.mjs");
  assert.match(source, /raw\.contact\?\.whatsapp/);
  assert.match(source, /contact: \{ \.\.\.\(phone \? \{ phone \} : \{\}\), \.\.\.\(whatsapp \? \{ whatsapp \} : \{\}\) \}/);
  assert.doesNotMatch(source, /whatsapp\s*\|\|\s*phone/);
});

test("event detail keeps calling separate from supplier WhatsApp", async () => {
  const [source, css] = await Promise.all([
    read("app/events/place/client-page.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(source, /const ownerPhone = place\.contact\?\.phone/);
  assert.match(source, /<DirectPhoneLink phone=\{ownerPhone\}/);
  assert.match(source, /placement: "event_detail"/);
  assert.match(source, /ownerWhatsapp \? <WhatsAppLeadButton/);
  assert.doesNotMatch(source, /whatsapp:\s*supplierDetail\.whatsapp\s*\|\|\s*supplierDetail\.phone/);
  assert.match(css, /\.event-title \.property-title__actions--contact\s*\{[^}]*display: flex;[^}]*flex-wrap: wrap;/);
  assert.match(css, /\.event-title \.property-title__actions--contact \.property-phone-action\s*\{[^}]*white-space: nowrap;/);
});

test("vacation and event detail pages expose WhatsApp in their primary action area", async () => {
  const [business, vacationHub, eventPlace] = await Promise.all([
    read("app/business/client-page.tsx"),
    read("app/components/vacation-booking-hub.tsx"),
    read("app/events/place/client-page.tsx"),
  ]);

  assert.match(business, /ownerWhatsapp \? <WhatsAppLeadButton world=\{activeWorld\}/);
  assert.match(business, /phoneHref \? <DirectPhoneLink/);
  assert.doesNotMatch(business, /phoneRevealed|setPhoneRevealed/);
  assert.match(business, /<VacationBookingHub/);
  assert.match(vacationHub, /<WhatsAppLeadButton world="vacation"/);
  assert.match(vacationHub, /unavailable \|\| !hasDates/);
  assert.match(eventPlace, /const ownerWhatsapp = place\.contact\?\.whatsapp;/);
  assert.match(business, /const ownerWhatsapp = property\.contact\?\.whatsapp;/);
  assert.match(eventPlace, /ownerWhatsapp \? <WhatsAppLeadButton world="events"/);
  assert.match(eventPlace, /buttonClassName="property-whatsapp-action"/);
});
