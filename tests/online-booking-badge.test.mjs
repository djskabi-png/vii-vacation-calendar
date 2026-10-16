import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canShowOnlineBookingBadge } from '../app/lib/online-booking-eligibility.ts';

const good = { ready:true, onlineBooking:true, bookingSupported:true, availability:'available', price:600,
  from:'2026-10-17', till:'2026-10-18', selectedFrom:'2026-10-17', selectedTill:'2026-10-18' };
test('explicit online offer with price, inventory and supported route gets a stamp', () => assert.equal(canShowOnlineBookingBadge(good),true));
for (const [name, patch] of Object.entries({loading:{ready:false}, phoneOnly:{onlineBooking:false}, missingFlag:{onlineBooking:undefined}, inquiry:{bookingSupported:false}, unknown:{availability:'unknown'}, unavailable:{availability:'unavailable'}, zeroPrice:{price:0}, noPrice:{price:undefined}, negative:{price:-10}, infinity:{price:Infinity}, nan:{price:NaN}, demo:{illustrative:true}, noDates:{selectedFrom:undefined,selectedTill:undefined}, staleDate:{selectedFrom:'2026-10-20'}, staleEnd:{selectedTill:'2026-10-21'}, invalidDate:{from:'2026-02-30',selectedFrom:'2026-02-30'}, reversed:{from:'2026-10-19',selectedFrom:'2026-10-19'}})) {
  test(`stamp fails closed: ${name}`, () => assert.equal(canShowOnlineBookingBadge({...good,...patch}),false));
}
test('shared stamp is noninteractive, localized and has no network requests', () => {
  const badge = readFileSync(new URL('../app/components/online-booking-badge.tsx',import.meta.url),'utf8');
  for(const label of ['ניתן להזמין אונליין','Book online','Réservation en ligne','Онлайн-бронирование']) assert.ok(badge.includes(label));
  assert.match(badge,/if \(!eligible\) return null/);
  assert.doesNotMatch(badge,/fetch\(|<button|<a\s/);
  const card = readFileSync(new URL('../app/components/property-card.tsx',import.meta.url),'utf8');
  assert.match(card,/<OnlineBookingBadge eligible=\{onlineBookingEligible\} className="stay-card__booking-stamp"/);
  assert.match(card,/onlineBookingEligible \|\| resolvedAvailability\.onlineBooking === false/);
  const detail = readFileSync(new URL('../app/business/client-page.tsx',import.meta.url),'utf8');
  assert.match(detail,/bookingSupported: vacationOnlineReady/);
  const css=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
  assert.match(css,/\.stay-card__media > \.stay-card__booking-stamp \{[^}]*right: 14px; left: auto;/);
  assert.match(css,/\.stay-card__media > \.stay-card__booking-stamp \{[^}]*z-index: 6;/);
});
