import { test, expect } from "./fixtures";

test.describe("Environments Page", () => {
  const environmentName = "test-env-for-disable";
  const environmentSlug = `test-env-for-disable-slug-${Date.now()}`;
  
  // Clean up any existing test environments before each test
  test.beforeEach(async ({ page }) => {
    try {
      await page.goto("/");
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('link', { name: 'Environments' }).click();
      
      // Delete any existing environments with the test name (both active and disabled)
      const cleanupEnvironments = async (showDisabled = false) => {
        if (showDisabled) {
          await page.getByRole('button', { name: 'Show Disabled' }).click();
        }
        
        // Find all rows with the test environment name
        const rows = page.getByRole('row').filter({ hasText: environmentName });
        const count = await rows.count();
        
        for (let i = 0; i < count; i++) {
          const row = rows.nth(i);
          const isVisible = await row.isVisible();
          if (isVisible) {
            try {
              await row.locator('button').nth(3).click(); // Delete button
              await page.getByRole('button', { name: 'Delete' }).click();
              // Wait a bit for the deletion to complete
              await page.waitForTimeout(500);
            } catch (e) {
              // Continue if deletion fails
            }
          }
        }
      };
      
      // Clean up active environments first
      await cleanupEnvironments(false);
      // Then clean up disabled environments
      await cleanupEnvironments(true);
      
      // Return to normal view
      try {
        await page.getByRole('button', { name: 'Hide Disabled' }).click();
      } catch (e) {
        // Button might not be visible if no disabled environments
      }
    } catch (error) {
      console.log('Cleanup error (ignored):', error);
    }
  });
  
  test.afterEach(async ({ page }) => {
    // Clean up the test environment after each test
    try {
      await page.goto("/");
      await page.getByRole('button', { name: 'Settings' }).click();
      await page.getByRole('link', { name: 'Environments' }).click();
      
      // Look for the specific environment by both name and slug to avoid conflicts
      let envRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: environmentSlug });
      let environmentExists = await envRow.isVisible();
      
      if (!environmentExists) {
        // Check in disabled state
        await page.getByRole('button', { name: 'Show Disabled' }).click();
        envRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: environmentSlug });
        environmentExists = await envRow.isVisible();
      }
      
      if (environmentExists) {
        // Delete the environment
        await envRow.locator('button').nth(3).click(); // Delete button (4th button)
        await page.getByRole('button', { name: 'Delete' }).click();
      }
    } catch (error) {
      // Ignore cleanup errors to avoid failing tests
      console.log('Cleanup error (ignored):', error);
    }
  });

  test("enable/disable environment and verify in test run trigger", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments via Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Wait for the environments table to load by waiting for any row with status data
    await expect(page.getByRole('row').filter({ hasText: /Active|Disabled/ }).first()).toBeVisible();
    
    // Create the test environment (assuming it doesn't exist due to cleanup)
    await page.getByRole('button', { name: 'Create New Environment' }).click();
    
    // Fill in the environment name
    await page.getByPlaceholder('e.g. staging, development, production').fill(environmentName);
    
    // Fill in the slug (auto-generated or manual)
    await page.getByPlaceholder('e.g. org-dev-test').fill(environmentSlug);
    
    // Add Playwright projects
    await page.getByPlaceholder('e.g. projectA,projectB').fill('chromium');
    
    // Create the environment
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Wait for the environment to appear in the table
    await expect(page.getByRole('row').filter({ hasText: environmentName }).first()).toBeVisible();
    
    // Environment already exists and is active, proceed with the test
    
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
    await expect(page.getByRole('option', { name: environmentName })).not.toBeVisible();
    
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