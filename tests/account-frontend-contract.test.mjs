import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Google account access is shared and backed by real server OAuth routes", async () => {
  const [access, layout, header, account, styles] = await Promise.all([read("app/components/account-access.tsx"), read("app/layout.tsx"), read("app/site-header.tsx"), read("app/account/page.tsx"), read("app/globals.css")]);
  assert.match(access, /\/api\/auth\/google/);
  assert.match(access, /src="\/vii-logo\.png"/);
  assert.doesNotMatch(access, /account-avatar[^>]*>VII</);
  assert.match(access, /\/api\/auth\/session/);
  assert.match(access, /\/api\/auth\/logout/);
  assert.doesNotMatch(access, /Frontend preview only|תצוגת פרונט בלבד/);
  assert.match(layout, /AccountAccessProvider/);
  assert.doesNotMatch(header, /<AccountHeaderButton/);
  assert.match(header, /className="menu-panel__account"/);
  assert.match(header, /useAccountAccess/);
  assert.match(header, /account\.name\.trim\(\)\.slice\(0, 1\)/);
  assert.match(header, /openAccountLogin/);
  assert.equal(header.split('href="/account"').length - 1, 1);
  assert.doesNotMatch(header, /menu-panel__account-action/);
  assert.doesNotMatch(header, /accountCopy\.enter/);
  assert.match(header, /translate\(item\.label\)/);
  assert.match(header, /translate\("לאן תרצו להגיע\?"\)/);
  assert.doesNotMatch(header, /translate\("התחברות או פתיחת חשבון"\)/);
  assert.match(header, /translate\("שאלות ותשובות"\)/);
  assert.match(styles, /\.menu-panel__account-copy small[^}]*line-height:\s*1\.3/);
  assert.match(styles, /\.menu-panel__account-copy strong[^}]*line-height:\s*1\.25/);
  assert.match(styles, /\.menu-panel__account-copy span[^}]*line-height:\s*1\.35/);
  assert.match(styles, /\.menu-panel__account\s*\{[^}]*min-height:\s*92px[^}]*padding:\s*12px/);
  assert.match(access, /aria-label=\{copy\[language\]\.login\}/);
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
