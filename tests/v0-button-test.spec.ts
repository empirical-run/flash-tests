import { test, expect } from "./fixtures";

test("navigate to v0 app, click button, and verify sign up button", async ({ page }) => {
  await page.goto("https://v0-button-to-open-v0-home-page-h5dizpkwp.vercel.app/");
  
  // Click the "Click me" button which opens a new popup
  const page1Promise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Click me' }).click();
  const page1 = await page1Promise;
  
  // Assert that the "sign up" button is visible on the new page
  await expect(page1.getByRole('button', { name: 'sign up' })).toBeVisible();
});