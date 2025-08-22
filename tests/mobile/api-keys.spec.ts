import { test, expect } from '../fixtures';

test.describe('Mobile API Keys Tests', () => {
  test('view API keys page in mobile web', async ({ page }) => {
    // Navigate to the application (already logged in via auth setup)
    await page.goto('/');
    
    // Verify mobile viewport is being used
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412); // Pixel 7 width
    
    // Open the sidebar by clicking the hamburger menu button, then click on API Keys
    await page.getByLabel('Open sidebar').click();
    await page.getByRole('link', { name: 'API Keys', exact: true }).click();
    
    // Verify we're on the API Keys page
    await expect(page).toHaveURL(/api-keys/, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
    
    // Verify the Generate New Key button is visible and functional in mobile
    await expect(page.getByRole('button', { name: 'Generate New Key' })).toBeVisible();
    
    // Check if there are any existing API keys or if we show the empty state
    // The table should be visible even if empty
    const tableExists = page.locator('table, tbody');
    await expect(tableExists.first()).toBeVisible();
    
    // Verify that key mobile UI elements are properly sized/positioned
    // The page should be responsive and not require horizontal scrolling
    const pageWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(412);
    
    console.log('✅ API Keys page loads correctly in mobile web view');
    console.log('✅ Mobile navigation works properly');
    console.log('✅ Page is responsive for mobile viewport');
  });

  test('create new API key in mobile web', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify mobile viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412);
    
    // Navigate to API Keys via mobile menu
    await page.getByLabel('Open sidebar').click();
    await page.getByRole('link', { name: 'API Keys', exact: true }).click();
    
    // Verify we're on the API Keys page
    await expect(page).toHaveURL(/api-keys/);
    await expect(page.getByRole('heading', { name: 'API Keys' })).toBeVisible();
    
    // Create a new API key
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    
    // Fill in the API key name
    const apiKeyName = `Mobile-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    
    // Generate the API key
    await page.getByRole('button', { name: 'Generate' }).click();
    
    // Verify the API key was created successfully - modal should show success
    await expect(page.getByRole('button', { name: 'Copy to Clipboard' })).toBeVisible();
    
    // Copy the API key to clipboard
    await page.getByRole('button', { name: 'Copy to Clipboard' }).click();
    
    // Get the API key from clipboard to verify it exists
    const apiKey = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    
    // Verify we got a valid API key
    expect(apiKey).toBeTruthy();
    expect(typeof apiKey).toBe('string');
    expect(apiKey.length).toBeGreaterThan(0);
    
    // Close the modal
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Verify the new API key appears in the list with 'Enabled' status
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    console.log('✅ API key created successfully in mobile web');
    
    // Clean up: Delete the API key that was created
    await keyRow.getByRole('button').last().click();
    
    // Confirm the deletion by typing the API key name in the confirmation field
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    
    // Verify the API key is removed from the list
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Mobile API key creation test completed with cleanup');
  });

  test('verify mobile API keys table responsive layout', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Verify mobile viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(412);
    
    // Navigate to API Keys via mobile menu
    await page.getByLabel('Open sidebar').click();
    await page.getByRole('link', { name: 'API Keys', exact: true }).click();
    
    // Verify we're on the API Keys page
    await expect(page).toHaveURL(/api-keys/);
    
    // Create a temporary API key to verify table layout
    await page.getByRole('button', { name: 'Generate New Key' }).click();
    const apiKeyName = `Layout-Test-Key-${Date.now()}`;
    await page.getByPlaceholder('e.g. Production API Key').fill(apiKeyName);
    await page.getByRole('button', { name: 'Generate' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    
    // Verify table exists and is visible
    const table = page.locator('table');
    await expect(table).toBeVisible();
    
    // Check table headers are visible (Name, Status, Actions)
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    
    // Verify our test API key row is properly displayed
    const keyRow = page.getByRole('row').filter({ hasText: apiKeyName });
    await expect(keyRow).toBeVisible();
    
    // Verify key elements in the row are visible (Name, Status, Action buttons)
    await expect(keyRow.getByText(apiKeyName)).toBeVisible();
    await expect(keyRow.getByText('Enabled')).toBeVisible();
    
    // Verify action buttons are accessible in mobile
    const actionButtons = keyRow.getByRole('button');
    const buttonCount = await actionButtons.count();
    expect(buttonCount).toBeGreaterThan(0); // Should have disable/enable and delete buttons
    
    // Verify no horizontal scroll is needed
    const pageWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(412);
    
    console.log('✅ Mobile API keys table layout is responsive');
    console.log(`✅ Page width: ${pageWidth}px (within mobile viewport)`);
    console.log(`✅ Found ${buttonCount} action buttons per row`);
    
    // Clean up: Delete the test API key
    await keyRow.getByRole('button').last().click();
    const confirmationField = page.locator(`input[placeholder*="${apiKeyName}"]`);
    await confirmationField.fill(apiKeyName);
    await page.getByRole('button', { name: 'Delete Permanently' }).click();
    await expect(page.locator('tbody').getByText(apiKeyName)).not.toBeVisible();
    
    console.log('✅ Mobile table layout test completed with cleanup');
  });
});