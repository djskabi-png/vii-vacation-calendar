import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/mcp/route.ts", import.meta.url), "utf8");

test("the authenticated spa catalog pull also warms the shared discovery snapshot", () => {
  assert.match(source, /if \(world === "spa"\)[\s\S]*warmSpaDiscoveryCache\(db\)/);
  assert.match(source, /scheduled spa discovery refresh unavailable/);
});
