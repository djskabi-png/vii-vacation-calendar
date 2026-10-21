import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function ordered(source, markers) {
  let previous = -1;
  for (const marker of markers) {
    const position = source.indexOf(marker);
    assert.ok(position > previous, `${marker} must exist after the preceding result boundary`);
    previous = position;
  }
}

test('vacation rail follows actual progressive/map results and empty recovery, not the heading', () => {
  const source = read('app/search/page.tsx');
  ordered(source, ['<section className="results-list"', '<ProgressiveResults autoLoad', '<div className="airbnb-map-split">', '<div className="empty-state">', '<RegionalAvailability world="vacation"', '<SearchAfterResults world="vacation"']);
  assert.equal(source.match(/<RegionalAvailability world="vacation"/g)?.length, 1);
  assert.match(source, /!mapOpen && !selectedStay && !flexibleSearch && selectedTypes\.length === 0 && !pool && !spa && !whole && !accessibleOnly && !onlineOnly && !selectedExtras\.length \? <RegionalAvailability world="vacation" region=\{area\} guests=\{guests\} embedded/);
});

test('event rail follows all result cards and empty recovery and retains eligibility', () => {
  const source = read('app/events/search/page.tsx');
  ordered(source, ['<section className={`event-list', '{displayed.map((place)', '<div className="empty-state">', '<RegionalAvailability world="events"', '<SearchAfterResults world="events"']);
  assert.equal(source.match(/<RegionalAvailability world="events"/g)?.length, 1);
  assert.match(source, /!mapOpen && !eventFrom && type === "הכל" && eventType === "הכל" && facility === "הכל" && !noNoiseLimit && !accessibleOnly \? <RegionalAvailability world="events" region=\{area\} guests=\{guests \|\| 20\} embedded/);
});

test('regional Spa rail follows the complete world-results section; national slot stays before it', () => {
  const source = read('app/components/world-landing.tsx');
  ordered(source, ['{beforeResults}', '<section id="world-results"', '<WorldMapResults', '</section>\n      {world === "spa"', '<RegionalAvailability world="spa"', '<SearchAfterResults']);
  assert.equal(source.match(/<RegionalAvailability world="spa"/g)?.length, 1);
  assert.match(source, /world === "spa" && !beforeResults && !initialSpaAudience && !initialSpaFilters\?\.length/);
  assert.match(read('app/spas/page.tsx'), /beforeResults=\{<SpaPackageDeals sectionId="spa-world-package-deals"/);
});

test('other worlds keep discovery sliders after their actual results', () => {
  const landing = read('app/components/world-landing.tsx');
  ordered(landing, ['<section id="world-results"', '<HourlyResults', '<ProviderResults', '<SearchAfterResults']);
  ordered(read('app/attractions/page.tsx'), ['<AttractionsExplorer', '<SearchAfterResults']);
  ordered(read('app/trails/page.tsx'), ['<TrailsExplorer', '<SearchAfterResults']);
  const regional = read('app/components/regional-availability.tsx');
  assert.doesNotMatch(regional, /(?:order\s*:|flex-direction|column-reverse)/);
  assert.match(regional, /world === "vacation" \? <VacationDeals/);
  assert.match(regional, /world === "events" \? <EventDeals/);
  assert.match(regional, /: <SpaDeals/);
});
