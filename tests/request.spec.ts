import { test, expect } from "./fixtures";
import { createRequest } from "./pages/requests";

test("should be able to create new request and verify a new chat session is created and title and description from the request are visible in the chat session", async ({ page, trackCurrentSession }) => {
  const timestamp = Date.now();
  const requestTitle = `Test Request ${timestamp}`;
  const requestDescription = `This is a test description for request ${timestamp}`;

  await createRequest(page, requestTitle, requestDescription);

  // Click on the newly created request in the sidebar to open its detail page
  await page.locator('[title="' + requestTitle + '"]').first().click();
  
  // Wait for the request detail page to load - we should see the heading
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible();
  
  // Click on the Sessions tab to view the sessions
  await page.getByRole('tab', { name: /Sessions/ }).click();
  
  // Verify the Sessions table shows a session was created
  await expect(page.locator('tbody tr').first()).toBeVisible();
  
  // Click on the session link in the Sessions table to navigate to the session
  await page.locator('tbody').getByRole('link').first().click();
  
  // Verify we're in the chat session by checking the URL contains "sessions"
  await expect(page).toHaveURL(/sessions/);
  
  // Track the session for automatic cleanup
  trackCurrentSession(page);
  
  // Check that both the title and description are visible in the first chat bubble
  const firstChatBubble = page.locator('div[data-message-id]').first();
  await expect(firstChatBubble.getByText(requestTitle)).toBeVisible();
  await expect(firstChatBubble.getByText(requestDescription)).toBeVisible();
});

test("should preserve request description when canceling edit", async ({ page }) => {
  const timestamp = Date.now();
  const requestTitle = `Edit Test Request ${timestamp}`;
  const requestDescription = `This is a test description for edit request ${timestamp}`;

  await createRequest(page, requestTitle, requestDescription);

  // Wait for any notification popups to disappear
  await page.waitForTimeout(2000);
  
  // Click on the span element with title attribute matching our requestTitle
  await page.locator('[title="' + requestTitle + '"]').first().click();
  
  // Wait for the request details to load and click the Edit button in the main content area
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible();
  await page.getByRole('heading', { name: requestTitle }).locator('..').getByRole('button', { name: 'Edit' }).click();
  
  // Clear the description input field and click "cancel"
  const descriptionField = page.getByRole('textbox', { name: 'Description' });
  await descriptionField.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.getByRole('button', { name: 'Cancel' }).click();
  
  // Click on the span element with title attribute matching our requestTitle
  await page.locator('[title="' + requestTitle + '"]').first().click();
  
  // Wait for the request details to load and click the Edit button in the main content area
  await expect(page.getByRole('heading', { name: requestTitle })).toBeVisible();
  await page.getByRole('heading', { name: requestTitle }).locator('..').getByRole('button', { name: 'Edit' }).click();
  
  // Verify that the description field should contain the original description (not be empty)
  await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue(requestDescription);
});

test("should be able to create draft request and verify it does not have a session", async ({ page }) => {
  const timestamp = Date.now();
  const requestTitle = `Draft Request ${timestamp}`;
  const requestDescription = `This is a draft request description ${timestamp}`;

  await createRequest(page, requestTitle, requestDescription, { createAsDraft: true });

  // Click on the draft request to select it
  await page.locator('[title="' + requestTitle + '"]').first().click();
  
  // Click on the Sessions tab to verify no sessions exist
  await page.getByRole('tab', { name: /Sessions/ }).click();
  
  // Verify that the draft request DOES NOT have a session
  // Check that the "No results." message is shown in the sessions table
  await expect(page.getByRole('cell', { name: 'No results.' })).toBeVisible();
  
  // Additionally, verify that there are draft indicators in the UI
  const draftIndicators = page.getByText('Draft', { exact: false });
  await expect(draftIndicators.first()).toBeVisible();
});
