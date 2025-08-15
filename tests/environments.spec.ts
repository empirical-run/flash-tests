import { test, expect } from "./fixtures";

test.describe("Environments Page", () => {
  test("enable/disable environment and verify in test run trigger", async ({ page }) => {
    const environmentName = "test-env-for-disable";
    
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments from the sidebar
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Wait for the environments table to load by waiting for the "Name" column header
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    
    // Check if environment "test-env-for-disable" exists, if not create it
    const environmentExists = await page.getByRole('cell', { name: environmentName }).isVisible();
    
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
      await expect(page.getByRole('cell', { name: environmentName })).toBeVisible();
    }
    
    // Find the environment row and assert it's "Active" (enabled)
    const environmentRow = page.getByRole('row').filter({ hasText: environmentName });
    await expect(environmentRow.getByText('Active')).toBeVisible();
    
    // Go to test runs page and verify environment is in dropdown
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Check if environment is in the dropdown
    const environmentDropdown = page.getByRole('combobox').first(); // Assuming this is the environment selector
    await environmentDropdown.click();
    await expect(page.getByRole('option', { name: environmentName })).toBeVisible();
    
    // Close the trigger dialog
    await page.keyboard.press('Escape');
    
    // Go back to environments page
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Disable the environment by clicking the power off button
    const environmentRowForDisable = page.getByRole('row').filter({ hasText: environmentName });
    await environmentRowForDisable.getByRole('button').filter({ hasText: 'Enabled' }).click();
    
    // Wait for the environment to be disabled
    await expect(environmentRowForDisable.getByText('Disabled')).toBeVisible();
    
    // Go to test runs page and verify environment is no longer in dropdown
    await page.getByRole('link', { name: 'Test Runs' }).click();
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Check if environment is no longer in the dropdown
    const environmentDropdownAfterDisable = page.getByRole('combobox').first();
    await environmentDropdownAfterDisable.click();
    await expect(page.getByRole('option', { name: environmentName })).not.toBeVisible();
    
    // Close the trigger dialog
    await page.keyboard.press('Escape');
    
    // Go back to environments and enable it back
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Enable the environment back
    const environmentRowForEnable = page.getByRole('row').filter({ hasText: environmentName });
    await environmentRowForEnable.getByRole('button').filter({ hasText: 'Disabled' }).click();
    
    // Wait for the environment to be enabled
    await expect(environmentRowForEnable.getByText('Enabled')).toBeVisible();
  });
});