import { test } from "./fixtures";
import { openCommandBar, getRecentItemTexts, visitAndRecord } from "./pages/command-bar";

for (const run of [1, 2, 3, 4, 5]) {
  test(`order timing ${run}`, async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    await visitAndRecord(page, `/lorem-ipsum/analytics`);
    await visitAndRecord(page, `/lorem-ipsum/memories`);
    await openCommandBar(page);
    for (let i = 0; i < 6; i++) {
      const texts = await getRecentItemTexts(page);
      const iM = texts.findIndex((t) => /› Memories$/.test(t));
      const iA = texts.findIndex((t) => /› Analytics$/.test(t));
      console.log(`DEBUG run${run} poll${i}: iM=${iM} iA=${iA} top5=${JSON.stringify(texts.slice(0, 5))}`);
      await page.waitForTimeout(1500);
    }
  });
}
