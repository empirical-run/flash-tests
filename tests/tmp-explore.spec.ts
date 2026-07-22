import { test } from "./fixtures";
import { openCommandBar, getRecentItemTexts, recentGroupItems } from "./pages/command-bar";

async function dump(page: any, label: string) {
  await openCommandBar(page);
  let texts: string[] = [];
  try { texts = await getRecentItemTexts(page); } catch { texts = ['<none>']; }
  console.log(`DEBUG ${label}:`, JSON.stringify(texts));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

test('explore detail + reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.waitForTimeout(1200);

  // Base Test Runs list via SPA
  await page.getByRole('link', { name: 'Test Runs' }).first().click();
  await page.waitForURL(/test-runs/);
  await page.getByRole('heading', { name: 'Test Runs' }).waitFor();
  await page.waitForTimeout(800);
  await dump(page, 'after Test Runs base');

  // Open a test run detail by clicking the first row link (#number)
  const firstRunLink = page.getByRole('link', { name: /#\s*\d+/ }).first();
  await firstRunLink.click();
  await page.waitForURL(/test-runs\/\d+/);
  await page.waitForTimeout(800);
  const detailUrl = page.url();
  console.log('DEBUG detail url:', detailUrl);
  await dump(page, 'after detail');

  // Reload and check
  await page.reload();
  await page.waitForTimeout(1200);
  await dump(page, 'after reload');
});
