import { test, expect } from "./fixtures";

test("click button on v0 app", async ({ page }) => {
  await page.goto("https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/");
  
  // Wait for popup when clicking the button
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Click me' }).click();
  const page1 = await page1Promise;
  
  // Verify the popup opened
  await expect(page1).toBeTruthy();
});