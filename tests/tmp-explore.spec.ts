import { test } from "./fixtures";
import { openCommandBar, getRecentItemTexts } from "./pages/command-bar";

async function dump(page: any, label: string) {
  await openCommandBar(page);
  let texts: string[] = [];
  try { texts = await getRecentItemTexts(page); } catch { texts = ['<none>']; }
  console.log(`DEBUG ${label}:`, JSON.stringify(texts));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

test('explore recent via SPA nav', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.waitForTimeout(1200);

  await page.getByRole('link', { name: 'Analytics' }).first().click();
  await page.waitForURL(/analytics/);
  await page.waitForTimeout(800);
  await dump(page, 'after Analytics');

  await page.getByRole('link', { name: 'Test Cases' }).first().click();
  await page.waitForURL(/test-cases/);
  await page.waitForTimeout(800);
  await dump(page, 'after Test Cases');

  await page.getByRole('link', { name: 'Requests' }).first().click();
  await page.waitForURL(/requests/);
  await page.waitForTimeout(800);
  await dump(page, 'after Requests');
});
