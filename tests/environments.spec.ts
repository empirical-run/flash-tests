import { test, expect } from "./fixtures";

test.describe("Environments Page", () => {
  test("enable/disable environment and verify in test run trigger", async ({ page }) => {
    const environmentName = "test-env-for-disable";
    
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments via Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Wait for the environments table to load by waiting for any row with status data
    await expect(page.getByRole('row').filter({ hasText: /Active|Disabled/ }).first()).toBeVisible();
    
    // Check if environment "test-env-for-disable" exists, if not create it
    const environmentRow = page.getByRole('row').filter({ hasText: environmentName });
    const environmentExists = await environmentRow.isVisible();
    
    if (!environmentExists) {
      // Create the environment
      await page.getByRole('button', { name: 'Create New Environment' }).click();
      
      // Fill in the environment name
      await page.getByPlaceholder('e.g. staging, development, production').fill(environmentName);
      
      // Fill in the slug (auto-generated or manual)
      await page.getByPlaceholder('e.g. org-dev-test').fill('test-env-for-disable-slug');
      
      // Add Playwright projects
      await page.getByPlaceholder('e.g. projectA,projectB').fill('chromium');
      
      // Create the environment
      await page.getByRole('button', { name: 'Create' }).click();
      
      // Show disabled environments to find the newly created environment (might be disabled by default)
      await page.getByRole('button', { name: 'Show Disabled' }).click();
      
      // Wait for the environment to appear in the table
      await expect(page.getByRole('row').filter({ hasText: environmentName }).first()).toBeVisible();
    }
    
    // Environment is created as disabled, so enable it (disabled environments are already shown)
    const disabledEnvironmentRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Disabled' }).first();
    await disabledEnvironmentRow.locator('button').nth(2).click();
    await page.getByRole('button', { name: 'Enable' }).click();
    
    // Hide disabled environments to return to normal view
    await page.getByRole('button', { name: 'Hide Disabled' }).click();
    
    // Verify the environment is now "Active" (enabled)
    const envRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Active' }).first();
    await expect(envRow.getByText('Active')).toBeVisible();
    
    // Go to test runs page and verify environment is in dropdown
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Open the environment dropdown and verify test-env-for-disable is available
    await page.getByRole('combobox', { name: 'Environment' }).click();
    await expect(page.getByRole('option', { name: environmentName }).first()).toBeVisible();
    
    // Close the environment dropdown first, then close the modal
    await page.keyboard.press('Escape'); // Close dropdown
    await page.getByText('Cancel').click(); // Close modal
    
    // Go back to environments page  
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Find the ACTIVE test environment row and disable it by clicking the toggle button
    const testEnvRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Active' }).first();
    // Click the green toggle button (third button from left in Actions column)
    await testEnvRow.locator('button').nth(2).click(); 
    
    // Confirm the disable action in the modal
    await page.getByRole('button', { name: 'Disable' }).click();
    
    // Verify the environment is now disabled - need to show disabled environments first
    await page.getByRole('button', { name: 'Show Disabled' }).click();
    const verifyDisabledRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Disabled' }).first();
    await expect(verifyDisabledRow.getByText('Disabled')).toBeVisible();
    
    // Hide disabled environments again to return to normal view
    await page.getByRole('button', { name: 'Hide Disabled' }).click();
    
    // Go to test runs page and verify disabled environment is NOT available
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Open the environment dropdown and verify disabled environment is NOT visible
    await page.getByRole('combobox', { name: 'Environment' }).click();
    
    // After reload with cache-busting, disabled environments should not appear in dropdown at all
    await expect(page.getByRole('option', { name: environmentName })).not.toBeVisible();;
    
    // Close the trigger dialog
    await page.keyboard.press('Escape'); // Close dropdown first
    await page.getByText('Cancel').click(); // Close modal
    
    // Go back to environments and enable it back
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Show disabled environments to find our disabled environment
    await page.getByRole('button', { name: 'Show Disabled' }).click();
    
    // Find the DISABLED test environment row and enable it back
    const finalDisabledRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Disabled' }).first();
    
    // Click the toggle button to enable it back (same button, now red/disabled)
    await finalDisabledRow.locator('button').nth(2).click();
    
    // Confirm the enable action in the modal
    await page.getByRole('button', { name: 'Enable' }).click();
    
    // Verify the environment is now active again - check for the active row
    const enabledRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Active' }).first();
    await expect(enabledRow.getByText('Active')).toBeVisible();
  });
});