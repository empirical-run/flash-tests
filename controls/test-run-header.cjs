// Run: node --test controls/test-run-header.cjs (local isolated browser; all network aborted).
// Replay a real pre-hydration trace DOM: RUN_HEADER_CAPTURE_PATH=<html> RUN_HEADER_CAPTURE_ID=<id> node --test controls/test-run-header.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { chromium, expect } = require('@playwright/test');
const { chromeStablePath } = require('@empiricalrun/playwright-utils');

const sourcePath = path.resolve(__dirname, '../tests/pages/test-runs.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const realRequire = Module.createRequire(sourcePath);
const isolated = new Module(sourcePath);
isolated.require = name => {
  if (name === './api-auth' || name === './urls') return new Proxy({}, {
    get() { return () => { throw new Error('Live API access forbidden in header controls'); }; },
  });
  return realRequire(name);
};
isolated._compile(compiled, sourcePath);
const { getTestRunHeading, expectTestRunHeaderStatus } = isolated.exports;
let browser;
before(async () => { browser = await chromium.launch({ executablePath: chromeStablePath(), headless: true }); });
after(async () => { await browser.close(); });
const row = (id = 123, env = 'staging', status = 'Failed', extra = '') =>
  `<div><h1>Test run on ${env} # ${id}</h1><span data-slot="badge">${status}</span>${extra}</div>`;
async function localDom(html, check) {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''));
  await check(page);
  await page.close();
}

test('same exact run: one accessible heading/badge, unrelated Failed labels ignored', async () => {
  await localDom(`${row()}<aside>Passed</aside>${row(124, 'staging', 'Passed')}`, async page => {
    await expectTestRunHeaderStatus(page, 123, 'staging', 'Failed');
  });
});
test('terminal alternatives normalize surrounding whitespace, but reject other status text', async () => {
  await localDom(row(123, 'staging', ' Failed '), async page => {
    await expectTestRunHeaderStatus(page, 123, 'staging', /^\s*(Failed|Passed|Partial)\s*$/);
    await page.locator('[data-slot="badge"]').evaluate(el => { el.textContent = 'Not Failed'; });
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', /^\s*(Failed|Passed|Partial)\s*$/, { timeout: 100 }));
  });
});
test('environment escaped; both #123 and # 123 forms supported', async () => {
  await localDom(row(123, 'stage.[blue]+').replace('# 123', '#123'), async page => {
    await expectTestRunHeaderStatus(page, 123, 'stage.[blue]+', 'Failed');
    await expect(getTestRunHeading(page, 123, 'stageXblue')).toHaveCount(0);
  });
});
test('hidden streamed duplicates excluded until actual native header is revealed', async () => {
  const capturePath = process.env.RUN_HEADER_CAPTURE_PATH;
  const id = Number(process.env.RUN_HEADER_CAPTURE_ID || 123);
  const html = capturePath ? fs.readFileSync(capturePath, 'utf8') : `<div hidden id="S:5">${row(id)}</div><div hidden id="S:6">${row(id)}</div>`;
  await localDom(html, async page => {
    await expect(page.getByText(`Test run on staging`, { exact: false })).toHaveCount(2);
    await expect(getTestRunHeading(page, id, 'staging')).toHaveCount(0);
    // Controlled hydration of the final native segment; no live app mutation.
    await page.locator('#S\\:6').evaluate(el => { el.hidden = false; });
    await expectTestRunHeaderStatus(page, id, 'staging', 'Failed');
    await expect(page.getByText('Test run on staging', { exact: false })).toHaveCount(2);
  });
});
test('hidden-only header cannot satisfy readiness', async () => {
  await localDom(`<div hidden id="S:6">${row()}</div>`, async page => {
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', 'Failed'));
  });
});
test('wrong run cannot satisfy status even with matching environment/Failed badge', async () => {
  await localDom(row(124), async page => {
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', 'Failed'));
  });
});
test('wrong environment cannot satisfy status', async () => {
  await localDom(row(123, 'production'), async page => {
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', 'Failed'));
  });
});
test('two genuinely accessible headings fail rather than ordinal selection', async () => {
  await localDom(row() + row(), async page => {
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', 'Failed'));
  });
});
test('two native header badges fail; no page-wide Failed fallback', async () => {
  await localDom(row(123, 'staging', 'Failed', '<span data-slot="badge">Failed</span>'), async page => {
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', 'Failed'));
  });
});
test('wrong header status fails despite a Failed label elsewhere', async () => {
  await localDom(row(123, 'staging', 'Passed') + '<aside>Failed</aside>', async page => {
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', 'Failed', { timeout: 100 }));
  });
});
test('hidden native badge cannot satisfy status', async () => {
  await localDom(row().replace('<span data-slot', '<span hidden data-slot'), async page => {
    await assert.rejects(() => expectTestRunHeaderStatus(page, 123, 'staging', 'Failed'));
  });
});
