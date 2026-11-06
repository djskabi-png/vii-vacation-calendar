import test from "node:test";
import assert from "node:assert/strict";
import { listingMapPlaces, discoveryMapPlaces } from "../app/lib/map/map-place.ts";

const translate = (value) => value;
const fallback = { place: "מקום", location: "ישראל", area: "ישראל" };
const units = { bedrooms: "חדרי שינה", units: "יחידות", guests: "אורחים", upTo: "עד" };

test("vacation and spa adapters preserve identity and reject unknown coordinates", () => {
  const listing = { slug: "villa-1", name: "Villa", location: "North", area: "North", type: "וילה", guests: 4, image: "/a.jpg", lat: 32.8, lng: 35.1, price: 900 };
  const places = listingMapPlaces([listing], "he", translate, fallback, "vacation", undefined, undefined, units);
  assert.equal(places[0].id, "villa-1");
  assert.equal(places[0].precision, "exact");
  assert.equal(listingMapPlaces([{ ...listing, slug: "missing", lat: undefined, lng: undefined }], "he", translate, fallback, "vacation", undefined, undefined, units).length, 0);

  const spa = { id: "spa-1", world: "spa", name: "Spa", location: "Center", area: "Center", description: "", features: [], lat: 32.1, lng: 34.8, priceLabel: "החל מ־500 ₪" };
  const spaPlaces = discoveryMapPlaces([spa], "he", translate, fallback, "spa", { spa: "ספא", hourly: "לפי שעה", packages: "חבילות", short: "קצר", from: "מ־" });
  assert.equal(spaPlaces[0].id, "spa-1");
  assert.equal(spaPlaces[0].markerKind, "price");
});

test('world adapters preserve explicit date quote, precision and localized marker values',()=>{
  const listing={slug:'villa-1',name:'Villa',location:'North',area:'North',type:'וילה',guests:4,image:'/a.jpg',lat:32.8,lng:35.1,price:900};
  const places=listingMapPlaces([listing],'en',translate,fallback,'vacation','from=2026-11-06&till=2026-11-07',{'villa-1':{amount:1800,mode:'stay_total'}},units);
  assert.equal(places[0].precision,'exact');assert.match(places[0].valueLabel,/1,800/);assert.match(places[0].valueLabel,/Stay/);
  assert.match(places[0].href,/from=2026-11-06/);assert.ok(!places[0].valueLabel.includes('900'));
  const hourly={id:'hourly-1',world:'hourly',name:'Room',location:'City',area:'Area',features:[],lat:32.1,lng:34.8,priceLabel:'לברור מחיר'};
  const [room]=discoveryMapPlaces([hourly],'he',translate,fallback,'hourly');
  assert.equal(room.markerKind,'category');assert.equal(room.valueLabel,undefined);assert.equal(room.precision,'area');
  assert.equal(discoveryMapPlaces([{...hourly,lat:NaN}],'he',translate,fallback,'hourly').length,0);
});

test('listing coordinate provenance reaches the map marker without weakening the exact default', () => {
  const base = { slug: 'area-place', name: 'Area place', location: 'North', area: 'North', type: 'וילה', guests: 4, image: '/a.jpg', lat: 32.8, lng: 35.1, price: 900 };
  assert.equal(listingMapPlaces([{ ...base, mapPrecision: 'area' }], 'he', translate, fallback, 'vacation', undefined, undefined, units)[0].precision, 'area');
  assert.equal(listingMapPlaces([base], 'he', translate, fallback, 'vacation', undefined, undefined, units)[0].precision, 'exact');
});
