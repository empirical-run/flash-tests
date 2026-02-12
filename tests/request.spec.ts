import { test, expect } from "./fixtures";

test("should be able to create new request and verify a new chat session is created and title and description from the request are visible in the chat session", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Wait for successful login (handled by setup project)
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Test Request ${timestamp}`;
  const requestDescription = `This is a test description for request ${timestamp}`;
  
  // Click on the "Requests" on the sidebar
  await page.getByRole('link', { name: 'Requests' }).click();
  
  // Click on the "+" button to create a new request (button is next to "Requests" heading)
  await page.getByRole('heading', { name: 'Requests' }).locator('..').getByRole('button').click();
  
  // Fill the form with title and description
  await page.getByLabel('Title').click();
  await page.getByLabel('Title').fill(requestTitle);
  await page.getByLabel('Description').click();
  await page.getByLabel('Description').fill(requestDescription);
  
  // Click the Create button to submit the form
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Wait for the request to be created - it should appear in the sidebar
  await expect(page.locator('.text-sm').filter({ hasText: requestTitle }).first()).toBeVisible();
  
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
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Edit Test Request ${timestamp}`;
  const requestDescription = `This is a test description for edit request ${timestamp}`;
  
  // Click on the "Requests" on the sidebar
  await page.getByRole('link', { name: 'Requests' }).click();
  
  // Click on the "+" button to create a new request (button is next to "Requests" heading)
  await page.getByRole('heading', { name: 'Requests' }).locator('..').getByRole('button').click();
  
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
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Wait for successful login (handled by setup project)
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  
  // Generate unique title and description for the test
  const timestamp = Date.now();
  const requestTitle = `Draft Request ${timestamp}`;
  const requestDescription = `This is a draft request description ${timestamp}`;
  
  // Click on the "Requests" on the sidebar
  await page.getByRole('link', { name: 'Requests' }).click();
  
  // Click on the "+" button to create a new request (button is next to "Requests" heading)
  await page.getByRole('heading', { name: 'Requests' }).locator('..').getByRole('button').click();
  
  // Fill the form with title and description
  await page.getByLabel('Title').fill(requestTitle);
  await page.getByLabel('Description').fill(requestDescription);
  
  // Toggle the "create as draft" switch in the create request modal
  await page.getByRole('switch', { name: 'Create as draft' }).click();
  
  // Click the Create button to submit the form
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Verify the draft request is created and visible in the requests list
  const elem = page.locator('.text-sm').filter({ hasText: requestTitle }).first();
  await elem.scrollIntoViewIfNeeded();
  await expect(elem).toBeVisible();
  
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