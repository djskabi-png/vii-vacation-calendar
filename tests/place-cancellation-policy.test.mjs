import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { supplierPlaceDetail } from "../app/data/supplier-place-detail.ts";

const root = new URL("../", import.meta.url);
const snapshot = JSON.parse(fs.readFileSync(new URL("app/data/legacy-place-agreements.json", root), "utf8"));

test("the legacy cancellation snapshot covers every vacation place source", () => {
  assert.equal(snapshot.coverage.requested, 573);
  assert.equal(snapshot.coverage.captured, 573);
  assert.equal(snapshot.coverage.failures, 0);
  assert.equal(Object.keys(snapshot.policies).length, 573);
});

test("Kesem Harimon keeps its place-specific cancellation policy", () => {
  const terms = supplierPlaceDetail("vacation-296")?.policy.cancellationTerms || "";
  assert.match(terms, /עד 14 ימים/);
  assert.match(terms, /14-7 ימים/);
  assert.match(terms, /100% דמי ביטול/);
});

test("booking and business pages render the place policy separately from the site terms", () => {
  const bookingPage = fs.readFileSync(new URL("app/booking/page.tsx", root), "utf8");
  const bookingClient = fs.readFileSync(new URL("app/booking/client-page.tsx", root), "utf8");
  const businessClient = fs.readFileSync(new URL("app/business/client-page.tsx", root), "utf8");
  assert.match(bookingPage, /cancellationTerms:/);
  assert.match(bookingClient, /מדיניות הביטול של \{props\.placeName\}/);
  assert.match(bookingClient, /למדיניות הביטול של המקום/);
  assert.match(bookingClient, /href="\/legal\/terms"/);
  assert.match(businessClient, /supplierDetail\?\.policy\.cancellationTerms/);
  assert.match(businessClient, /cancellationTitle: \(name: string\)/);
  assert.match(businessClient, /businessCopy\.cancellationTitle\(localizedPropertyName\)/);
  assert.match(businessClient, /<p lang="he" dir="rtl" data-no-translate>/);
  assert.match(businessClient, /businessCopy\.originalPolicy/);
});
