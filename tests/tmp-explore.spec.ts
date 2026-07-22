import { test } from "./fixtures";
import { openCommandBar } from "./pages/command-bar";

test('inspect command bar DOM', async ({ page }) => {
  await page.goto('/lorem-ipsum/analytics');
  await page.waitForTimeout(1500);
  await openCommandBar(page);
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const groups = Array.from(document.querySelectorAll('[cmdk-group]'));
    return groups.map((g) => {
      const heading = g.querySelector('[cmdk-group-heading]')?.textContent?.trim() || '(none)';
      const items = Array.from(g.querySelectorAll('[cmdk-item]')).map((i) => (i.textContent || '').trim());
      return { heading, count: items.length, items };
    });
  });
  console.log('DEBUG groups:', JSON.stringify(info, null, 2));
});
