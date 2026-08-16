import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("place WhatsApp actions save a complete lead before opening the conversation", async () => {
  const source = await read("app/components/whatsapp-lead-button.tsx");

  assert.match(source, /name="name"[^>]*required|required[^>]*name="name"/);
  assert.match(source, /name="phone"[^>]*required|required[^>]*name="phone"/);
  assert.match(source, /name="requested_date"[^>]*required|required[^>]*name="requested_date"/);
  assert.match(source, /name="guests"/);
  assert.doesNotMatch(source, /<input[^>]*name="guests"[^>]*required/);
  assert.match(source, /name="privacy"[^>]*required|required[^>]*name="privacy"/);
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
  assert.match(source, /delete forwardedPayload\.notificationRequest/);
  assert.match(source, /channel: "sms"/);
  assert.match(source, /recipientSource: "verified_place_contact"/);
  assert.match(source, /template: "vii_whatsapp_lead"/);
  assert.match(source, /sourceBrand: "VII"/);
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
test("the lead modal looks and behaves like the start of a WhatsApp conversation", async () => {
  const [component, css] = await Promise.all([
    read("app/components/whatsapp-lead-button.tsx"),
    read("app/globals.css"),
  ]);

  assert.match(component, /function WhatsAppIcon\(\)/);
  assert.match(component, /whatsapp-lead-dialog__appbar/);
  assert.match(component, /whatsapp-lead-dialog__conversation/);
  assert.match(component, /<AccountFormPrompt compact \/>/);
  assert.match(component, /const localizedPlaceName = translate\(placeName\)/);
  assert.match(component, /conversationWith\(localizedPlaceName\)/);
  assert.doesNotMatch(component, /labels\.previewStatus\}<\/small>/);
  assert.match(css, /\.account-form-prompt--compact/);
  assert.match(component, /labels\.conversationWith\(localizedPlaceName\)/);
  assert.match(component, /className=\{`\$\{buttonClassName\} whatsapp-lead-trigger`\}/);
  assert.match(component, /className="button primary booking-whatsapp"[^>]*><WhatsAppIcon \/>/);
  assert.match(css, /\.whatsapp-lead-dialog__appbar\s*\{[^}]*#075e54[^}]*#128c7e/);
  assert.match(css, /\.whatsapp-lead-dialog \.booking-whatsapp\s*\{[^}]*#25d366/);
  assert.match(css, /\.whatsapp-lead-dialog__conversation\s*\{[^}]*#efeae2/);
});

test("event result cards expose the same tracked phone and WhatsApp actions as vacation cards", async () => {
  const [events, actions] = await Promise.all([
    read("app/events/search/page.tsx"),
    read("app/components/event-card-contact-actions.tsx"),
  ]);

  assert.match(events, /EventCardContactActions/);
  assert.match(events, /phone=\{place\.contact\?\.phone\}/);
  assert.match(events, /whatsapp=\{place\.contact\?\.whatsapp\}/);
  assert.match(actions, /trackPhoneReveal\(\{ placeId, placeName, world: "events", placement: "event_card" \}\)/);
  assert.match(actions, /<WhatsAppLeadButton world="events"/);
  assert.match(actions, /whatsapp \|\| phone/);
  assert.match(actions, /stay-card__contact--revealed/);
});

test("vacation and event detail pages expose WhatsApp in their primary action area", async () => {
  const [business, vacationHub, eventPlace] = await Promise.all([
    read("app/business/client-page.tsx"),
    read("app/components/vacation-booking-hub.tsx"),
    read("app/events/place/client-page.tsx"),
  ]);

  assert.match(business, /ownerWhatsapp \? <WhatsAppLeadButton world=\{activeWorld\}/);
  assert.match(business, /phoneHref \? phoneRevealed/);
  assert.match(business, /<a className="property-phone-action property-phone-action--revealed" href=\{phoneHref\}/);
  assert.match(business, /<VacationBookingHub/);
  assert.match(vacationHub, /<WhatsAppLeadButton world="vacation"/);
  assert.match(vacationHub, /unavailable \|\| !hasDates/);
  assert.match(eventPlace, /const ownerWhatsapp = place\.contact\?\.whatsapp \|\| place\.contact\?\.phone/);
  assert.match(eventPlace, /ownerWhatsapp \? <WhatsAppLeadButton world="events"/);
  assert.match(eventPlace, /buttonClassName="property-whatsapp-action"/);
});
