import { test, expect } from "./fixtures";

test("delete all webhooks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Webhooks' }).click();

  await expect(page.getByRole('button', { name: 'Add Webhook' })).toBeVisible();

  const testButtons = page.getByRole('button', { name: 'Test', exact: true });
  let count = await testButtons.count();
  console.log(`Found ${count} webhooks to delete`);
  while (count > 0) {
    await page.getByRole('row').nth(1).getByRole('button').last().click();
    await page.getByRole('button', { name: 'Delete' }).click();
    count--;
    await expect(testButtons).toHaveCount(count);
  }
  console.log("All webhooks deleted");
});
