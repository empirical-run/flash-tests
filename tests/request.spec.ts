import { test, expect } from "./fixtures";

test("should be able to create new request and verify a new chat session is created and title and description from the request are visible in the chat session", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Wait for successful login (handled by setup project)
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Test Request ${timestamp}`;
  const requestDescription = `This is a test description for request ${timestamp}`;
  
  // Click on the "Requests" on the sidebar
  await page.getByRole('link', { name: 'Requests' }).click();
  
  // Click on the "New Request" button
  await page.getByRole('button', { name: 'New Request' }).click();
  
  // Fill the form with title and description
  await page.getByLabel('Title').click();
  await page.getByLabel('Title').fill(requestTitle);
  await page.getByLabel('Description').click();
  await page.getByLabel('Description').fill(requestDescription);
  
  // Click the Create button to submit the form
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Verify the chat session with the title is created and visible in the same screen
  // Look for the request in the Sessions section specifically
  await expect(page.locator('.text-sm').filter({ hasText: requestTitle }).first()).toBeVisible();
  
  // Open the session by clicking on the specific session row for our request
  await page.getByRole('cell', { name: requestTitle }).click();
  
  // Now click on the session link that contains our request title to open the chat
  await page.getByRole('link').filter({ hasText: requestTitle }).click();
  
  // Verify we're in the chat session by checking the URL contains "sessions"
  await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
  
  // Check that both the title and description are visible in the first chat bubble
  const firstChatBubble = page.locator('[data-message-id="1"]');
  await expect(firstChatBubble.getByText(requestTitle)).toBeVisible({ timeout: 10000 });
  await expect(firstChatBubble.getByText(requestDescription)).toBeVisible({ timeout: 10000 });
});

test("should preserve request description when canceling edit", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Skip authentication check for now - focus on the main issue
  // await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Edit Test Request ${timestamp}`;
  const requestDescription = `This is a test description for edit request ${timestamp}`;
  
  // TODO(agent on page): Navigate through the app to create a request, edit it, cancel the edit, and verify the description is preserved when editing again
  
});