import { test, expect } from "./fixtures";

test("successful login with automation test user", async ({ page }) => {
  // Get the app URL from environment variable with fallback
  const appUrl = process.env.BUILD_URL || "https://dash.empirical.run";
  
  // Navigate to the app
  await page.goto(appUrl);
  
  // TODO(agent on page): Login with email "automation-test@example.com" and password "k8mSX99gDUD@E#L"
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();
});