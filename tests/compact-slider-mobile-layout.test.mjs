import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile slider families share one compact heading, action and controls rhythm", () => {
  const publicMobile = read("app/mobile-polish.css");
  const homeMobile = read("app/home-mobile.css");

  for (const css of [publicMobile, homeMobile]) {
    assert.match(css, /:has\(> \.section-head \+ \.home-mobile-rail-controls\)/);
    assert.match(css, /> \.section-head[^{]*\{\s*display:contents;/);
    assert.match(css, /> \.section-head > a[^{]*\{[\s\S]*?grid-row:2;[\s\S]*?justify-self:start;[\s\S]*?min-height:44px;/);
    assert.match(css, /> \.home-mobile-rail-controls[^{]*\{[\s\S]*?grid-row:2;[\s\S]*?justify-self:end;[\s\S]*?margin:0;/);
    assert.match(css, /> \.home-mobile-rail[^{]*\{[\s\S]*?grid-row:3;[\s\S]*?margin-top:0;/);
  }

  assert.match(publicMobile, /:has\(> \.section-head \+ \.event-rail-wrap\)/);
  assert.match(publicMobile, /> \.event-rail-wrap \{\s*display:contents;/);
  assert.match(publicMobile, /> \.event-rail-wrap > \.event-rail-controls \{\s*grid-row:2;/);
  assert.match(publicMobile, /> \.event-rail-wrap > \.event-rail,[\s\S]*grid-row:3;/);
  assert.match(publicMobile, /\.event-slider-section > \.section-head > \.event-slider-section__actions[^{]*\{[\s\S]*?grid-row:2;[\s\S]*?min-height:44px;[\s\S]*?justify-content:space-between;/);

  const eventPage = read("app/events/page.tsx");
  for (const railId of ["recommended-events-rail", "event-types-rail", "event-providers-rail", "event-places-rail"]) {
    assert.match(eventPage, new RegExp(`<HomeSliderControls railId="${railId}"`));
    assert.match(eventPage, new RegExp(`<EventRail railId="${railId}" showControls=\\{false\\}`));
  }
});
