import test from "node:test";
import assert from "node:assert/strict";
import { getActivityDetails } from "../app/data/activity-details.ts";

const base = { id:"verified-kayaks",world:"activities",name:"Verified venue",location:"North",area:"North",description:"Approved catalog description",features:["Kayaks","Family","פרטים מלאים","בדיקת אפשרויות הזמנה"],indexable:true,sourceUrl:"https://example.com" };

test("verified named attraction keeps its approved business facts instead of matching-service filler", () => {
  const result = getActivityDetails(base);
  assert.equal(result.about[0], base.description);
  assert.deepEqual(result.highlights,["Kayaks","Family"]);
  assert.ok(result.about.every(text=>!text.includes("לא שם של עסק מסוים")));
  assert.ok(result.highlights.every(text=>!text.includes("לפני הצגה")));
  assert.equal(result.booking.mode,"online");
});

test("unverified matching category retains its separate matching identity", () => {
  const result = getActivityDetails({...base,indexable:false,sourceUrl:undefined});
  assert.ok(result.about[0].includes("שירות התאמה"));
});
