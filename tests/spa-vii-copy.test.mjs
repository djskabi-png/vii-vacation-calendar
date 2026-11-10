import { readWorldDataSource } from "./helpers/world-data-source.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import catalog from "../app/data/spaplus-catalog.json" with { type: "json" };
import copies from "../app/data/spa-vii/copy.json" with { type: "json" };
import audit from "../docs/spa-editorial-review.json" with { type: "json" };
import { projectSpaViiSite, validateSpaEditorialCandidate, spaEditorialSourceHash } from "../app/lib/spa-editorial-policy.ts";
import { catalogResponse } from "../app/api/catalog/route.ts";
import { GET } from "../app/api/spa/description/route.ts";
import { spaLandings, spaSourceServiceTerms, spaItemMatches } from "../app/data/spa-landings.ts";
import { spaEditorialSummary } from "../app/data/spa-editorial.ts";
import { spaViiCopyOrNull } from "../app/data/spa-vii-copy.ts";
import { spaPlacesFromSites } from "../app/lib/spa-discovery-card.ts";
import { spaSearchStateFromValues, spaItemMatchesSearch } from "../app/data/spa-search-landings.ts";
import { isQuarantinedGalleryMedia } from "../app/lib/legacy-gallery-media.ts";

test("all 159 active Spa sources are pinned, individually rewritten and fact-mapped", async () => {
  assert.equal(copies.length, 159);
  assert.deepEqual(copies.map(x => x.id).sort((a,b)=>a-b), catalog.sites.map(x=>x.id).sort((a,b)=>a-b));
  assert.equal(new Set(copies.map(x=>x.cardSummary)).size, 159);
  assert.equal(new Set(copies.map(x=>x.paragraphs.join("\n"))).size, 159);
  for (const site of catalog.sites) {
    const copy=copies.find(x=>x.id===site.id), review=audit.records.find(x=>x.id===site.id);
    assert.equal(copy.sourceHash, await spaEditorialSourceHash(site), String(site.id));
    assert.deepEqual([...new Set(review.coverage.map(x=>x.sourceParagraph))].sort((a,b)=>a-b), site.about.map((_,i)=>i));
    assert.notEqual(copy.cardSummary, site.shortDescription);
    const oldCard = site.shortDescription || site.about[0] || "";
    const narrativeFacets = spaLandings.filter(facet => !["lodging", "hourly-room", "indoor-pool", "outdoor-pool", "heated-pool", "hammam"].includes(facet.id));
    for (const facet of narrativeFacets) assert.equal(facet.terms.some(x=>copy.filterText.includes(x)), facet.terms.some(x=>oldCard.includes(x)), `${site.id}: preserve ${facet.id} filter`);
    // New service facets use source facts, independently of rewritten display prose.
    const searchTerms = [...site.packages.map(pack => pack.title), ...spaSourceServiceTerms(site)];
    for (const facet of spaLandings.filter(facet => ["lodging", "hourly-room"].includes(facet.id))) {
      const original = { name: site.title, description: site.shortDescription, features: [], searchTerms };
      assert.equal(spaItemMatches({ ...original, filterText: copy.filterText }, facet), spaItemMatches(original, facet), `${site.id}: preserve ${facet.id} source facts`);
    }
    assert.notDeepEqual(copy.paragraphs, site.about);
    for (const paragraph of copy.paragraphs) {
      if (paragraph.length>40) assert.ok(!site.about.includes(paragraph), `${site.id}: original paragraph returned`);
    }
    const projected=await projectSpaViiSite(site);
    assert.deepEqual(projected.about, copy.paragraphs);
    assert.deepEqual(projected.packages, site.packages.map((pack) =>
      isQuarantinedGalleryMedia(pack.image) ? { ...pack, image: "" } : pack));
    assert.deepEqual(projected.opening, site.opening);
    const excluded=review.excludedSourceArtifacts.map(x=>x.text).join(" ");
    const text=copy.paragraphs.join(" ");
    for(const number of new Set((site.about.join(" ")+" "+site.shortDescription).match(/\d+(?:[.,:]\d+)*/g)||[])) {
      assert.ok(text.includes(number)||excluded.includes(number)||text.includes(review.numericEquivalents?.[number]||"\u0000"), `${site.id}: number ${number}`);
    }
  }
});

test("changed supplier facts refresh while supplier prose can never overwrite VII copy", async () => {
  const site=catalog.sites.find(x=>x.id===6);
  for(const change of [{about:[...site.about,"unreviewed new provider restriction"]},{address:"changed address"},{shortDescription:"new provider description"},
    {opening:["09:00-10:00"]}]) {
    const projected=await projectSpaViiSite({...site,...change});
    const copy=copies.find(x=>x.id===site.id);
    assert.equal(projected.shortDescription,copy.cardSummary);
    assert.deepEqual(projected.about,copy.paragraphs);
  }
  const commercial={...site, image:"https://www.spaplus.co.il/gallery/new.jpg", packages:site.packages.map(x=>({...x,price:x.price+1,durationMinutes:70}))};
  const view=await projectSpaViiSite(commercial);
  assert.deepEqual(view.packages,commercial.packages); assert.deepEqual(view.opening,commercial.opening);
  assert.equal(view.image,commercial.image);
  const added=await projectSpaViiSite({...site,id:999999,title:"ספא חדש",city:"חיפה",about:["טקסט ספק שלא אושר"]});
  assert.match(added.shortDescription,/ספא חדש/); assert.doesNotMatch(added.about.join(" "),/טקסט ספק/);
  await validateSpaEditorialCandidate([{supplierId:6,summary:site}]);
  await validateSpaEditorialCandidate([{supplierId:6,summary:{...site,about:["new text"],opening:["09:00-10:00"]}}]);
});

test("official SpaPlus facility evidence survives editorial projection for the two Tel Aviv pools", async () => {
  for (const id of [6, 385]) {
    const site = catalog.sites.find((entry) => entry.id === id);
    const projected = await projectSpaViiSite(site);
    assert.ok(projected.facilityIds?.length, String(id));
    assert.ok(projected.facilityIds.includes(id === 6 ? 115 : 214), String(id));
    for (const label of (id === 6 ? ["בריכה", "חדר כושר", "בריכה חיצונית"] : ["ג'קוזי פרטי"])) assert.ok(projected.features.includes(label), `${id}: ${label}`);
    if (id === 385) assert.ok(projected.optionalFeatures?.some((feature) => feature.label === "בריכה"), `${id}: optional pool`);
    if (id === 6) assert.ok(!projected.features.includes("ג'קוזי פרטי"));
    if (id === 385) assert.ok(!projected.features.includes("בריכה חיצונית"));
  }
});

test("empty partial supplier facilities cannot erase reviewed authoritative facility evidence", async () => {
  const source = structuredClone(catalog.sites.find((entry) => entry.id === 6));
  source.features = [];
  source.facilityIds = [];
  const projected = await projectSpaViiSite(source);
  assert.ok(projected.features.includes("בריכה"));
  assert.ok(projected.features.includes("חדר כושר"));
  assert.ok(projected.facilityIds.length > 0);
});

test("verified facility facts reach the real Spa search pipeline without package inclusion claims", async () => {
  const projected = await Promise.all([6, 385].map(async (id) => projectSpaViiSite(catalog.sites.find((site) => site.id === id))));
  const cards = spaPlacesFromSites(projected);
  const pool = spaSearchStateFromValues("תל אביב", undefined, ["pool"]);
  assert.equal(cards.filter((card) => spaItemMatchesSearch(card, pool)).length, 2);
  assert.ok(!cards.find((card) => card.id === "spa-385")?.searchTerms?.includes("החבילה כוללת כניסה לבריכה"));
  const outdoor = spaSearchStateFromValues("תל אביב", undefined, ["pool"]);
  assert.ok(spaItemMatchesSearch(cards.find((card) => card.id === "spa-6"), outdoor));
});

test("expanded facility filters use projected structured facts, including optional paid facilities", async () => {
  const projected = await Promise.all([6, 385].map(async (id) => projectSpaViiSite(catalog.sites.find((site) => site.id === id))));
  const cards = spaPlacesFromSites(projected);
  for (const id of ["indoor-pool", "outdoor-pool", "heated-pool", "hammam"]) {
    const landing = spaLandings.find((entry) => entry.id === id);
    assert.ok(landing);
    for (const card of cards.filter((entry) => spaItemMatches(entry, landing))) assert.ok(card.spaFacilityTerms?.some((term) => landing.terms.some((needle) => term.includes(needle))));
  }
  const kempinski = cards.find((card) => card.id === "spa-385");
  assert.ok(kempinski?.spaFacilityTerms?.includes("בריכה"));
  assert.equal(kempinski?.searchTerms?.includes("החבילה כוללת כניסה לבריכה"), false);
});

test("already-projected runtime Spa entries remain renderable after package updates", async () => {
  const site=structuredClone(catalog.sites.find(x=>x.id===6));
  const projected=await projectSpaViiSite(site);
  projected.packages=projected.packages.slice(1);
  const rendered=await projectSpaViiSite(projected);
  assert.equal(rendered.shortDescription,projected.shortDescription);
  assert.deepEqual(rendered.about,projected.about);
});

test("a newly approved Spa site remains renderable across discovery and detail projections", async () => {
  const newSite={...structuredClone(catalog.sites[0]),id:534,title:"ספא חדש",city:"חיפה",shortDescription:"תיאור VII ניטרלי",about:["תוכן VII ניטרלי"]};
  assert.equal(spaViiCopyOrNull(534),null);
  assert.equal(spaEditorialSummary(newSite),"תיאור VII ניטרלי");
  const worldData=await Promise.resolve(readWorldDataSource());
  assert.match(worldData,/spaViiCopyOrNull\(site\.id\)/);
  assert.match(worldData,/approvedCopy\?\.filterText \|\|/);
});

test("public catalog, card and both read-more paths expose VII without mutating supplier records", async () => {
  const site=catalog.sites.find(x=>x.id===6), copy=copies.find(x=>x.id===6), before=JSON.stringify(site);
  const response=await catalogResponse(new Request("https://vii.spaplus.co/api/catalog?world=spa&id=6"),null);
  const body=await response.json(); assert.equal(response.status,200); assert.deepEqual(body.entry.summary.about,copy.paragraphs);
  assert.equal(body.entry.summary.shortDescription,copy.cardSummary);
  const description=await (await GET(new Request("https://vii.spaplus.co/api/spa/description?id=6"))).json();
  assert.equal(description.editorial,"vii");assert.deepEqual(description.about,copy.paragraphs);
  assert.equal(JSON.stringify(site),before);
});

test("production sync gates source changes before staging and UI never falls back to provider text", async () => {
  const runtime=await readFile(new URL("../app/lib/supplier-catalog-runtime.ts",import.meta.url),"utf8");
  assert.match(runtime,/validateCandidate: async entries => \{/);
  assert.match(runtime,/if \(world === "spa"\) await validateSpaEditorialCandidate\(entries\)/);
  assert.match(runtime,/await archiveGalleryCandidate/);
  const sync=await readFile(new URL("../app/lib/supplier-catalog-sync.ts",import.meta.url),"utf8");
  assert.ok(sync.indexOf("await input.validateCandidate")<sync.indexOf("await stageSupplierCatalogEntries"));
  const ui=await readFile(new URL("../app/discover/place/client-page.tsx",import.meta.url),"utf8");
  assert.match(ui,/body.editorial !== "vii"/);assert.match(ui,/key=\{spaDetails.siteId\}/);
  assert.doesNotMatch(ui,/מידע נוסף שנמסר מספא פלוס/);
});
