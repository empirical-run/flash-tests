import { test, expect } from "./fixtures";

test("should be able to create new request and verify a new chat session is created and title and description from the request are visible in the chat session", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Wait for successful login (handled by setup project)
  await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
  
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
  
  // First click on the title to select the new request
  await page.locator('[title="' + requestTitle + '"]').click();
  
  // Then open the session using the Sessions table row locator
  await page.locator('div').filter({ hasText: /^Sessions/ }).locator('tbody tr').first().click();
  
  // Verify we're in the chat session by checking the URL contains "sessions"
  await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
  
  // Check that both the title and description are visible in the first chat bubble
  const firstChatBubble = page.locator('div[data-message-id]').first();
  await expect(firstChatBubble.getByText(requestTitle)).toBeVisible({ timeout: 10000 });
  await expect(firstChatBubble.getByText(requestDescription)).toBeVisible({ timeout: 10000 });
});

test("should preserve request description when canceling edit", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Wait for successful login (handled by setup project)
  await expect(page.getByText("Lorem Ipsum").first()).toBeVisible();
  
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
  
  // Wait for any notification popups to disappear
  await page.waitForTimeout(2000);
  
  // Click on the span element with title attribute matching our requestTitle
  await page.locator('[title="' + requestTitle + '"]').click();
  await page.getByRole('button', { name: 'Edit Request' }).click();
  
  // Clear the description input field and click "cancel"
  await page.getByLabel('Description').click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Backspace");
  await page.getByRole('button', { name: 'Cancel' }).click();
  
  // Click on the span element with title attribute matching our requestTitle
  await page.locator('[title="' + requestTitle + '"]').click();
  await page.getByRole('button', { name: 'Edit Request' }).click();
  
  // Verify that the description field should contain the original description (not be empty)
  const descriptionField = page.getByLabel('Description');
  await expect(descriptionField).toHaveValue(requestDescription);
});

test("should be able to create draft request and verify it does not have a session", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Wait for successful login (handled by setup project)
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Draft Request ${timestamp}`;
  const requestDescription = `This is a draft request description ${timestamp}`;
  
  // Click on the "Requests" on the sidebar
  await page.getByRole('link', { name: 'Requests' }).click();
  
  // Click on the "New Request" button
  await page.getByRole('button', { name: 'New Request' }).click();
  
  // Fill the form with title and description
  await page.getByLabel('Title').fill(requestTitle);
  await page.getByLabel('Description').fill(requestDescription);
  
  // Toggle the "create as draft" switch in the create request modal
  await page.getByRole('switch', { name: 'Create as draft' }).click();
  
  // Click the Create button to submit the form
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Verify the draft request is created and visible in the requests list
  await expect(page.locator('.text-sm').filter({ hasText: requestTitle }).first()).toBeVisible();
  
  // Click on the draft request to select it
  await page.locator('[title="' + requestTitle + '"]').click();
  
  // Verify that the draft request DOES NOT have a session
  // Check that the Sessions table either doesn't exist or is empty for this request
  const sessionsSection = page.locator('div').filter({ hasText: /^Sessions/ });
  const sessionRows = sessionsSection.locator('tbody tr');
  
  // Assert that there are no session rows for this draft request
  await expect(sessionRows).toHaveCount(0);
  
  // Additionally, verify that "No results" text is shown in the sessions section
  await expect(sessionsSection.getByText('No results')).toBeVisible();
  
  // Additionally, verify that there are draft indicators in the UI
  const draftIndicators = page.getByText('Draft', { exact: false });
  await expect(draftIndicators.first()).toBeVisible();
});