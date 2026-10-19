import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const discovery = readFileSync(new URL("../app/components/home-discovery-sections.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("all homepage vacation discovery rails use the search discovery card contract", () => {
  assert.match(discovery, /className="home-managed-discovery__track search-depth__rail"/);
  assert.match(discovery, /className="search-depth__discovery-card"/);
  assert.match(discovery, /className="search-depth__discovery-icon home-managed-discovery__visual"/);
  assert.match(discovery, /className="search-depth__discovery-arrow"/);
  assert.equal((discovery.match(/<DiscoveryRail id="home-(?:city|type)-rail"/g) || []).length, 2);
  assert.match(discovery, /presentation\.popular\.map/);
  assert.doesNotMatch(discovery, /<DiscoveryRail id="home-popular-rail"/);
});

test("homepage discovery cards retain CMS images, destinations and click feedback", () => {
  assert.match(discovery, /href=\{localizedPath\(item\.href, language\)\}/);
  assert.match(discovery, /src=\{item\.image\}/);
  assert.match(discovery, /alt=\{item\.imageAlt \|\| item\.label\}/);
  assert.match(discovery, /title=\{item\.imageAlt \|\| item\.label\}/);
  assert.match(discovery, /data-global-feedback="true"/);
  assert.match(discovery, /data-loading-label=\{`פותחים \$\{item\.label\}\.\.\.`\}/);
});

test("homepage search-style cards stay uniform on desktop and horizontally usable on mobile", () => {
  assert.match(css, /\.home-managed-discovery__track\.search-depth__rail \{[^}]*grid-auto-columns: minmax\(220px,calc\(\(100% - 42px\)\/4\)\)/s);
  assert.match(css, /\.home-managed-discovery__track \.search-depth__discovery-card \{[^}]*min-height: 126px;[^}]*grid-template-columns: 48px minmax\(0,1fr\) 24px;/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.home-managed-discovery__track\.search-depth__rail \{[^}]*grid-auto-columns: minmax\(220px,78vw\)/);
  assert.match(css, /\.home-managed-discovery__track \.home-managed-discovery__visual \{[^}]*width: 48px;[^}]*height: 48px;/s);
  assert.doesNotMatch(css, /\.home-managed-discovery__track > a::after/);
});
