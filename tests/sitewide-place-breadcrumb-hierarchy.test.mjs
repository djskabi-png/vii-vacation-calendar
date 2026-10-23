import test from "node:test";
import assert from "node:assert/strict";
import { orderedPlaceLocations } from "../app/lib/place-breadcrumb-locations.ts";
import { eventBreadcrumbsForLocation, hourlyBreadcrumbsForLocation } from "../app/data/world-search-landings.ts";
import { spaBreadcrumbsForLocation } from "../app/data/spa-search-landings.ts";

test("verified region and city remain ordered and canonically deduplicated", () => {
  assert.deepEqual(orderedPlaceLocations("גליל מערבי", "יערה"), ["גליל מערבי", "יערה"]);
  assert.deepEqual(orderedPlaceLocations("חיפה", "חיפה"), ["חיפה"]);
  assert.deepEqual(orderedPlaceLocations("כל הארץ", "נתניה"), ["נתניה"]);
  assert.deepEqual(orderedPlaceLocations("", ""), []);
});

test("events exposes region then city with working world-specific search destinations", () => {
  assert.deepEqual(eventBreadcrumbsForLocation("מרכז", "פתח תקווה"), [
    { name: "מקומות לאירועים במרכז", path: "/events/search/center" },
    { name: "מקומות לאירועים בפתח תקווה", path: "/events/search/petah-tikva" },
  ]);
});

test("spa exposes region then city without inventing an unsupported semantic city route", () => {
  assert.deepEqual(spaBreadcrumbsForLocation("מרכז", "פתח תקווה"), [
    { name: "ספא במרכז", path: "/spas/search/center" },
    { name: "ספא בפתח תקווה", path: "/spas?location=%D7%A4%D7%AA%D7%97%20%D7%AA%D7%A7%D7%95%D7%95%D7%94" },
  ]);
});

test("hourly keeps the same approved region-city hierarchy", () => {
  assert.deepEqual(hourlyBreadcrumbsForLocation("מישור החוף והשפלה", "ראשון לציון"), [
    { name: "חדרים לפי שעה במישור החוף והשפלה", path: "/hourly/search/coastal-plain" },
    { name: "חדרים לפי שעה בראשון לציון", path: "/hourly/search/rishon-lezion" },
  ]);
});
