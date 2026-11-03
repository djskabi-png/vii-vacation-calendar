import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const hub = readFileSync(new URL("../app/components/vacation-booking-hub.tsx", import.meta.url), "utf8");

test("a live supplier check has a truthful neutral loading state", () => {
  assert.match(hub, /type BookingState = [^;]*"checking"/);
  assert.match(hub, /availabilityStatus === "loading"\) return "checking"/);
  assert.match(hub, /state === "checking"\) return \{ title: "בודקים זמינות ומחיר", text: "הבדיקה מתבצעת מול מערכת ההזמנות של המקום" \}/);
});
