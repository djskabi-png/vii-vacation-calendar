import assert from "node:assert/strict";
import test from "node:test";
import {spaHasLodging,spaHasHourlyRoom,spaSourceServiceTerms} from "../app/data/spa-landings.ts";
import catalog from "../app/data/spaplus-public-catalog.json" with {type:"json"};
test("actual supplier services preserve lodging without inferring it from a hotel",()=>{assert.equal(spaHasLodging("ספא בבית מלון, ללא לינה"),false);assert.equal(spaHasLodging("חבילות לינה"),true);assert.ok(catalog.sites.some(site=>spaSourceServiceTerms(site).includes("לינה")));});
test("actual hourly spa packages match daily-use private rooms but not treatment or gym rooms",()=>{assert.equal(spaHasHourlyRoom("חדרי טיפולים, חדר כושר, שעות פתיחה"),false);assert.equal(spaHasHourlyRoom("חדרי טיפולים וחדר פרטי למשך 4 שעות"),true);assert.ok(spaSourceServiceTerms(catalog.sites.find(site=>site.id===80)).includes("חדר לפי שעה"));});
