import { test, expect } from "./fixtures";

test("successful login with automation test user", async ({ page }) => {
  // Get the app URL from environment variable with fallback
  const appUrl = process.env.BUILD_URL || "https://dash.empirical.run";
  
  // Navigate to the app
  await page.goto(appUrl);
  
  // Login with email and password
  await page.getByPlaceholder('m@example.com').click();
  await page.getByPlaceholder('m@example.com').fill("automation-test@example.com");
  await page.getByPlaceholder('●●●●●●●●').click();
  await page.getByPlaceholder('●●●●●●●●').fill("k8mSX99gDUD@E#L");
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();
});