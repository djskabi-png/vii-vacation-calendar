import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/admin/business-performance/page.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/admin/business-performance/business-performance.module.css", import.meta.url), "utf8");

test("business performance chart is driven by the active report filters and verified metrics", () => {
  assert.match(page, /const \[chartMetric, setChartMetric\]/);
  assert.match(page, /filtered\.map/);
  assert.match(page, /pageViews/);
  assert.match(page, /bizCalls/);
  assert.match(page, /bizOrders/);
  assert.match(page, /bizRevenue/);
  assert.match(page, /אין עדיין נתון שמור למדד הזה במסנן הנבחר/);
});

test("chart offers keyboard buttons and opens the selected business detail", () => {
  assert.match(page, /aria-pressed=\{chartMetric === metric\}/);
  assert.match(page, /onClick=\{\(\) => openChartBusiness\(item\.row\)\}/);
  assert.match(page, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(page, /id="business-performance-table"/);
});

test("chart layout remains responsive and respects reduced motion", () => {
  assert.match(styles, /\.performanceChart/);
  assert.match(styles, /\.performanceBars/);
  assert.match(styles, /@media\(max-width:760px\)/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(styles, /\.performanceBars i b/);
});
