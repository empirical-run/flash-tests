import { test, expect } from "./fixtures";

test("should be able to create new request and verify a new chat session is created and title and description from the request are visible in the chat session", async ({ page }) => {
  // Get the app URL from environment variable with fallback
  const appUrl = process.env.BUILD_URL || "https://dash.empirical.run";
  
  // Navigate to the app
  await page.goto(appUrl);
  
  // Login with email and password (assuming login is required)
  await page.getByPlaceholder('m@example.com').click();
  await page.getByPlaceholder('m@example.com').fill("automation-test@example.com");
  await page.getByPlaceholder('●●●●●●●●').click();
  await page.getByPlaceholder('●●●●●●●●').fill("k8mSX99gDUD@E#L");
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  
  // Wait for successful login
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Test Request ${timestamp}`;
  const requestDescription = `This is a test description for request ${timestamp}`;
  
  // Click on the "Requests" on the sidebar
  await page.getByRole('link', { name: 'Requests' }).click();
  
  // TODO(agent on page): Click on the "New Request" button
});