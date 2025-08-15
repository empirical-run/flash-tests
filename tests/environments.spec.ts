import { test, expect } from "./fixtures";

test.describe("Environments Page", () => {
  test("enable/disable environment and verify in test run trigger", async ({ page }) => {
    const environmentName = "test-env-for-disable";
    
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments from the sidebar
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Wait for the environments page to load
    await expect(page.getByRole('heading', { name: 'Environments' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create New Environment' })).toBeVisible();
    
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
      
      // Wait for the environment to appear in the table
      const newEnvironmentRow = page.getByRole('row').filter({ hasText: environmentName });
      await expect(newEnvironmentRow).toBeVisible();
    }
    
    // Find the environment row and assert it's "Active" (enabled)
    const envRow = page.getByRole('row').filter({ hasText: environmentName });
    await expect(envRow.getByText('Active')).toBeVisible();
    
    // Go to test runs page and verify environment is in dropdown
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Open the environment dropdown and verify test-env-for-disable is available
    await page.getByRole('combobox', { name: 'Environment' }).click();
    await expect(page.getByRole('option', { name: environmentName })).toBeVisible();
    
    // Close the environment dropdown first, then close the modal
    await page.keyboard.press('Escape'); // Close dropdown
    await page.getByText('Cancel').click(); // Close modal
    
    // Go back to environments page  
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Find the test environment row and disable it by clicking the toggle button
    const testEnvRow = page.getByRole('row').filter({ hasText: environmentName });
    // Click the green toggle button (third button from left in Actions column)
    await testEnvRow.locator('button').nth(2).click(); 
    
    // Verify the environment is now disabled
    await expect(testEnvRow.getByText('Disabled')).toBeVisible();
    
    // Go to test runs page and verify environment is no longer in dropdown
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // TODO(agent on page): In the test run trigger modal, find the environment dropdown and verify that "test-env-for-disable" environment is no longer available in the list
    
    // Close the trigger dialog
    await page.keyboard.press('Escape');
    
    // Go back to environments and enable it back
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // TODO(agent on page): Find the "test-env-for-disable" environment row and click on the enable/toggle button to enable it back. The environment should now show as "Active" again
  });
});