import { test } from "./fixtures";
import { openCommandBar, getRecentItemTexts } from "./pages/command-bar";

test('explore recent via SPA nav', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Dashboard' }).waitFor();
  await page.waitForTimeout(1000);

  // SPA navigation via in-app nav links (no full reload)
  await page.getByRole('link', { name: 'Analytics' }).first().click();
  await page.waitForURL(/analytics/);
  await page.waitForTimeout(1800);

  await page.getByRole('link', { name: 'Test Cases' }).first().click();
  await page.waitForURL(/test-cases/);
  await page.waitForTimeout(1800);

  await page.getByRole('link', { name: 'Requests' }).first().click();
  await page.waitForURL(/requests/);
  await page.waitForTimeout(1800);

  await openCommandBar(page);
  console.log('DEBUG after SPA nav:', JSON.stringify(await getRecentItemTexts(page)));
  await page.keyboard.press('Escape');

  // Now reload and re-check
  await page.reload();
  await openCommandBar(page);
  const items = page.locator('[cmdk-item]');
  const count = await items.count();
  console.log('DEBUG total items after reload:', count);
  // Try to dump recent group if present
  try {
    console.log('DEBUG recent after reload:', JSON.stringify(await getRecentItemTexts(page)));
  } catch (e) {
    console.log('DEBUG no recent group after reload');
  }
});
