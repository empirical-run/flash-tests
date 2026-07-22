import { test } from "./fixtures";
import { openCommandBar, getRecentItemTexts } from "./pages/command-bar";
import { visitAndRecord } from "./pages/command-bar";

test('inspect failure-groups recent label', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1200);
  await visitAndRecord(page, `/lorem-ipsum/failure-groups`);
  console.log('DEBUG url after visit:', page.url());
  console.log('DEBUG document.title:', await page.title());
  await openCommandBar(page);
  await page.waitForTimeout(1500);
  console.log('DEBUG recent texts:', JSON.stringify(await getRecentItemTexts(page)));
});
