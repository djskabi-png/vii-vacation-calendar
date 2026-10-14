import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import catalog from "../app/data/spaplus-catalog.json" with { type: "json" };
import copies from "../app/data/spa-vii/copy.json" with { type: "json" };
import audit from "../docs/spa-editorial-review.json" with { type: "json" };
import { projectSpaViiSite, validateSpaEditorialCandidate, spaEditorialSourceHash } from "../app/lib/spa-editorial-policy.ts";
import { catalogResponse } from "../app/api/catalog/route.ts";
import { GET } from "../app/api/spa/description/route.ts";
import { spaLandings } from "../app/data/spa-landings.ts";

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
    for (const facet of spaLandings) assert.equal(facet.terms.some(x=>copy.filterText.includes(x)), facet.terms.some(x=>oldCard.includes(x)), `${site.id}: preserve ${facet.id} filter`);
    assert.notDeepEqual(copy.paragraphs, site.about);
    for (const paragraph of copy.paragraphs) {
      if (paragraph.length>40) assert.ok(!site.about.includes(paragraph), `${site.id}: original paragraph returned`);
    }
    const projected=await projectSpaViiSite(site);
    assert.deepEqual(projected.about, copy.paragraphs);
    assert.deepEqual(projected.packages, site.packages);
    assert.deepEqual(projected.opening, site.opening);
    const excluded=review.excludedSourceArtifacts.map(x=>x.text).join(" ");
    const text=copy.paragraphs.join(" ");
    for(const number of new Set((site.about.join(" ")+" "+site.shortDescription).match(/\d+(?:[.,:]\d+)*/g)||[])) {
      assert.ok(text.includes(number)||excluded.includes(number)||text.includes(review.numericEquivalents?.[number]||"\u0000"), `${site.id}: number ${number}`);
    }
  }
});

test("changed supplier prose cannot overwrite VII; approved package, commercial and media updates remain independent", async () => {
  const site=catalog.sites.find(x=>x.id===6);
  for(const change of [{about:[...site.about,"unreviewed new provider restriction"]},{address:"changed address"},{shortDescription:"new provider description"},
    {opening:["09:00-10:00"]}]) {
    await assert.rejects(()=>projectSpaViiSite({...site,...change}), /catalog_editorial_requires_review/);
  }
  const commercial={...site, image:"https://www.spaplus.co.il/gallery/new.jpg", packages:site.packages.map(x=>({...x,price:x.price+1,durationMinutes:70}))};
  const view=await projectSpaViiSite(commercial);
  assert.deepEqual(view.packages,commercial.packages); assert.deepEqual(view.opening,commercial.opening);
  assert.equal(view.image,commercial.image);
  const added=await projectSpaViiSite({...site,id:999999,title:"ספא חדש",city:"חיפה",about:["טקסט ספק שלא אושר"]});
  assert.match(added.shortDescription,/ספא חדש/); assert.doesNotMatch(added.about.join(" "),/טקסט ספק/);
  await validateSpaEditorialCandidate([{supplierId:6,summary:site}]);
  await assert.rejects(()=>validateSpaEditorialCandidate([{supplierId:6,summary:{...site,about:["new text"]}}]),/catalog_editorial_requires_review/);
});

test("already-projected runtime Spa entries remain renderable after package updates", async () => {
  const site=structuredClone(catalog.sites.find(x=>x.id===6));
  const projected=await projectSpaViiSite(site);
  projected.packages=projected.packages.slice(1);
  const rendered=await projectSpaViiSite(projected);
  assert.equal(rendered.shortDescription,projected.shortDescription);
  assert.deepEqual(rendered.about,projected.about);
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
  assert.match(runtime,/validateCandidate: world === "spa" \? validateSpaEditorialCandidate/);
  const sync=await readFile(new URL("../app/lib/supplier-catalog-sync.ts",import.meta.url),"utf8");
  assert.ok(sync.indexOf("await input.validateCandidate")<sync.indexOf("await stageSupplierCatalogEntries"));
  const ui=await readFile(new URL("../app/discover/place/client-page.tsx",import.meta.url),"utf8");
  assert.match(ui,/body.editorial !== "vii"/);assert.match(ui,/key=\{spaDetails.siteId\}/);
  assert.doesNotMatch(ui,/מידע נוסף שנמסר מספא פלוס/);
});
