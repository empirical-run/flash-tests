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
  
  // Handle login with a simple email approach
  await page.locator('[data-testid="login\\/email-input"]').click();
  await page.locator('[data-testid="login\\/email-input"]').fill("test@example.com");
  await page.locator('[data-testid="login\\/email-button"]').click();
  
  // Wait a bit and see if we can access the app
  await page.waitForTimeout(2000);
  
  // Check if we can find the main app content or if we're redirected
  try {
    await expect(page.getByText("Lorem Ipsum")).toBeVisible({ timeout: 10000 });
  } catch (error) {
    // If Lorem Ipsum is not found, let's see what's actually on the page and try to navigate properly
    console.log("Main content not found, checking current page state");
    
    // TODO(agent on page): Navigate to the main app content where we can see "Lorem Ipsum" and access the requests functionality
    await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  }
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Edit Test Request ${timestamp}`;
  const requestDescription = `This is a test description for edit request ${timestamp}`;
  
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
  
  // Wait for the request to be created and visible
  await expect(page.locator('.text-sm').filter({ hasText: requestTitle }).first()).toBeVisible();
  
  // Click on "edit request" button for the newly created request
  await page.getByRole('button', { name: 'Edit Request' }).click();
  
  // Clear the description input field and click "cancel"
  await page.getByLabel('Description').click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Backspace");
  await page.getByRole('button', { name: 'Cancel' }).click();
  
  // Click on "edit request" button again and verify the description field contains the original description
  await page.getByRole('button', { name: 'Edit Request' }).click();
  
  // Verify that the description field should contain the original description (not be empty)
  const descriptionField = page.getByLabel('Description');
  await expect(descriptionField).toHaveValue(requestDescription);
});