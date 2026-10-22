import assert from "node:assert/strict";
import { test } from "node:test";
import { hourlyEntryMode } from "../app/lib/hourly-entry.ts";
import { getHourlyDetails } from "../app/data/hourly-details.ts";

test("classifies only explicit no-meeting entrance evidence", () => {
  assert.equal(hourlyEntryMode(["כניסה ותשלום דיסקרטיים ללא מפגש"]), "no-meeting");
  assert.equal(hourlyEntryMode(["כניסה דיסקרטית ותשלום ללא מפגש"]), "no-meeting");
  assert.equal(hourlyEntryMode(["כניסה עצמאית ודיסקרטית"]), "no-meeting");
});

test("classifies explicit in-person entrance evidence", () => {
  assert.equal(hourlyEntryMode(["כניסה דיסקרטית עם מפגש עם נציג המקום"]), "with-meeting");
  assert.equal(hourlyEntryMode(["מפגש עם הצוות בעת הכניסה"]), "with-meeting");
});

test("does not infer entrance mode from ambiguous or payment-only copy", () => {
  assert.equal(hourlyEntryMode(["כניסה דיסקרטית"]), undefined);
  assert.equal(hourlyEntryMode(["תשלום ללא מפגש ודיסקרטיות מלאה"]), undefined);
  assert.equal(hourlyEntryMode(["אירוח פרטי ודיסקרטי"]), undefined);
  assert.equal(hourlyEntryMode([]), undefined);
});

test("adds the verified fact and FAQ only when entrance mode is known", () => {
  const item = { id: "hourly-test", description: "כניסה דיסקרטית ותשלום ללא מפגש", features: [] };
  const place = { id: "hourly-test", description: item.description, rooms: [] };
  const verified = getHourlyDetails(item, place);
  assert.equal(verified.entryDisclosure?.label, "כניסה דיסקרטית ללא מפגש");
  assert.equal(verified.faq[0].question, "האם הכניסה למקום היא ללא מפגש?");

  const unknownItem = { ...item, description: "כניסה דיסקרטית" };
  const unknown = getHourlyDetails(unknownItem, { ...place, description: unknownItem.description });
  assert.equal(unknown.entryDisclosure, undefined);
  assert.equal(unknown.faq.some((entry) => /מפגש/.test(entry.question)), false);
  assert.equal(unknown.arrivalNotes.some((entry) => /מפגש/.test(entry)), false);
});
