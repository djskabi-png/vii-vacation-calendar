import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("frontend account access is shared, explicit and never claims real OAuth", async () => {
  const [access, layout, header, account] = await Promise.all([read("app/components/account-access.tsx"), read("app/layout.tsx"), read("app/site-header.tsx"), read("app/account/page.tsx")]);
  assert.match(access, /google.*facebook.*instagram/s);
  assert.match(access, /Frontend preview only/);
  assert.match(access, /localStorage|stored only in this browser/);
  assert.doesNotMatch(access, /signInWith|oauth|accounts\.google\.com|graph\.facebook/iu);
  assert.match(layout, /AccountAccessProvider/);
  assert.match(header, /AccountHeaderButton/);
  assert.match(account, /הזמנות ובקשות/);
});

test("customer forms offer sign in and prefill saved profile details", async () => {
  const [booking, whatsapp, lead] = await Promise.all([read("app/booking/client-page.tsx"), read("app/components/whatsapp-lead-button.tsx"), read("app/components/lead-intake-form.tsx")]);
  for (const source of [booking, whatsapp, lead]) {
    assert.match(source, /AccountFormPrompt/);
    assert.match(source, /useAccountAccess/);
    assert.match(source, /account\?\.(?:name|phone|email)|account\.(?:name|phone|email)/);
  }
  assert.match(booking, /setName\(account\.name\)/);
  assert.match(booking, /setPhone\(account\.phone \|\| ""\)/);
  assert.match(booking, /setEmail\(account\.email\)/);
});