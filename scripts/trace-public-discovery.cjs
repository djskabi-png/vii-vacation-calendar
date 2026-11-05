// Bounded, anonymous read-only diagnostic. No booking, lead or message actions.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const out = path.resolve(process.env.QA_OUTPUT_DIR || '.qa-output/plan-execution/trace');
fs.mkdirSync(out, { recursive: true });
const receipt = path.join(out, 'operation.json');
if (fs.existsSync(receipt)) throw new Error('Diagnostic has an existing outcome; inspect it before another run.');
const state = { operation: 'plan-execution-public-discovery-baseline', attempt: 1, status: 'running', startedAt: new Date().toISOString(), scope: 'One anonymous homepage load, no user actions or source mutations' };
const save = () => fs.writeFileSync(receipt, JSON.stringify(state, null, 2));
const resourceManifest = path.resolve('.qa-output/vii-plan-execution-resources.json');
const record = (pid, label) => execFileSync('pwsh.exe', ['-NoProfile', '-File', 'C:/Users/Adir/.codex/skills/manage-task-resource-hygiene/scripts/resource_hygiene.ps1', '-Mode', 'record', '-ManifestPath', resourceManifest, '-ProcessId', String(pid), '-Label', label], { windowsHide: true, stdio: 'pipe' });
save();
(async () => {
  let browser;
  const requests = new Map(); const network = []; const errors = [];
  try {
    record(process.pid, 'bounded-public-discovery-trace');
    browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const cdp = await browser.newBrowserCDPSession();
    const processes = await cdp.send('SystemInfo.getProcessInfo');
    const browserPid = processes.processInfo.find(p => p.type === 'browser')?.id;
    if (browserPid) record(browserPid, 'owned-anonymous-discovery-browser');
    const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    page.on('request', req => {
      if (new URL(req.url()).hostname === 'vii.spaplus.co') requests.set(req, Date.now());
    });
    page.on('requestfinished', req => {
      if (!requests.has(req)) return;
      const timing = req.timing();
      network.push({ path: new URL(req.url()).pathname, method: req.method(), type: req.resourceType(), elapsedMs: Date.now() - requests.get(req), responseStartMs: timing.responseStart, responseEndMs: timing.responseEnd });
    });
    page.on('requestfailed', req => {
      if (requests.has(req)) network.push({ path: new URL(req.url()).pathname, type: req.resourceType(), elapsedMs: Date.now() - requests.get(req), failure: req.failure()?.errorText });
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.__viiDiscoveryObservations = [];
      const started = performance.now();
      const observe = () => {
        const text = document.body?.innerText || '';
        const item = { atMs: Math.round(performance.now() - started), cards: document.querySelectorAll('[data-testid*="card"], .deal-card, .place-card').length, loadingAvailability: (text.match(/בודקים זמינות ומחירים/g) || []).length, retry: (text.match(/לנסות שוב/g) || []).length };
        const prior = window.__viiDiscoveryObservations.at(-1);
        if (!prior || item.cards !== prior.cards || item.loadingAvailability !== prior.loadingAvailability || item.retry !== prior.retry) window.__viiDiscoveryObservations.push(item);
      };
      new MutationObserver(observe).observe(document, { subtree: true, childList: true });
      document.addEventListener('DOMContentLoaded', observe, { once: true });
    });
    const began = Date.now();
    const response = await page.goto('https://vii.spaplus.co/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(10000);
    const content = await page.evaluate(() => ({ observations: window.__viiDiscoveryObservations, navigation: performance.getEntriesByType('navigation').map(e => ({ responseStart: e.responseStart, domContentLoaded: e.domContentLoadedEventEnd, load: e.loadEventEnd })), publicApi: performance.getEntriesByType('resource').filter(e => e.name.includes('/api/')).map(e => ({ path: new URL(e.name).pathname, startMs: e.startTime, durationMs: e.duration, transferBytes: e.transferSize })), loadingAvailability: (document.body.innerText.match(/בודקים זמינות ומחירים/g) || []).length, retry: (document.body.innerText.match(/לנסות שוב/g) || []).length }));
    await page.screenshot({ path: path.join(out, 'homepage-desktop.png'), fullPage: true });
    const report = { checkedAt: new Date().toISOString(), status: response.status(), documentMs: Date.now() - began, build: response.headers()['x-vii-build'] || null, cache: response.headers()['x-vii-edge-cache'] || null, ...content, network: network.filter(e => e.type === 'document' || e.path.startsWith('/api/')), pageErrors: errors, pendingPublicRequests: [...requests.keys()].filter(req => !req.timing().responseEnd && req.resourceType() === 'fetch').map(req => new URL(req.url()).pathname), limitations: ['Single anonymous desktop baseline', 'No transaction, location or signed-in behavior exercised', 'Ten-second observation window after DOMContentLoaded'] };
    fs.writeFileSync(path.join(out, 'baseline.json'), JSON.stringify(report, null, 2));
    state.status = 'completed'; state.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify(report));
  } catch (error) {
    state.status = 'failed'; state.error = String(error); save(); process.exitCode = 1;
    console.error(error);
  } finally { if (browser) await browser.close(); }
})();
