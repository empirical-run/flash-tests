import { test, expect } from "./fixtures";

test.describe("Environments Page", () => {
  test("enable/disable environment and verify in test run trigger", async ({ page }, testInfo) => {
    const environmentName = "test-env-for-disable";
    
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments from the sidebar
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
      
      // Wait for the environment to appear in the table
      await expect(page.getByRole('row').filter({ hasText: environmentName }).first()).toBeVisible();
    }
    
    // Check if environment is currently disabled (from previous test runs) and enable it if needed
    const initialDisabledRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Disabled' }).first();
    if (await initialDisabledRow.isVisible()) {
      // Enable the currently disabled environment
      await initialDisabledRow.locator('button').nth(2).click();
      await page.getByRole('button', { name: 'Enable' }).click();
      
      // Wait for it to become active
      const activeRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Active' }).first();
      await expect(activeRow.getByText('Active')).toBeVisible();
    }
    
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
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Take screenshot before disabling
    await page.screenshot({ path: 'before-disable-action.png' });
    await testInfo.attach('before-disable-action', { path: 'before-disable-action.png', contentType: 'image/png' });
    
    // Find the ACTIVE test environment row and disable it by clicking the toggle button
    const testEnvRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Active' }).first();
    // Click the green toggle button (third button from left in Actions column)
    await testEnvRow.locator('button').nth(2).click(); 
    
    // Confirm the disable action in the modal
    await page.getByRole('button', { name: 'Disable' }).click();
    
    // Wait a bit for the state change to propagate
    await page.waitForTimeout(2000);
    
    // Take screenshot after disable action
    await page.screenshot({ path: 'after-disable-action.png' });
    await testInfo.attach('after-disable-action', { path: 'after-disable-action.png', contentType: 'image/png' });
    
    // Verify the environment is now disabled - check for the disabled row
    const disabledRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Disabled' }).first();
    await expect(disabledRow.getByText('Disabled')).toBeVisible();
    
    // Go to test runs page and verify disabled environment is NOT available
    await page.getByRole('link', { name: 'Test Runs' }).click();
    
    // Wait 5 seconds then reload to ensure we get fresh environment data (not cached)
    await page.waitForTimeout(5000);
    await page.reload();
    
    // Wait for the Test Runs page to load after reload
    await expect(page.getByRole('button', { name: 'New Test Run' })).toBeVisible();
    
    await page.getByRole('button', { name: 'New Test Run' }).click();
    
    // Open the environment dropdown and verify disabled environment is NOT visible
    await page.getByRole('combobox', { name: 'Environment' }).click();
    
    // After reload with cache-busting, disabled environments should not appear in dropdown at all
    await expect(page.getByRole('option', { name: environmentName })).not.toBeVisible();;
    
    // Close the trigger dialog
    await page.keyboard.press('Escape'); // Close dropdown first
    await page.getByText('Cancel').click(); // Close modal
    
    // Go back to environments and enable it back
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Take a screenshot before trying to find the disabled environment
    await page.screenshot({ path: 'environments-page-before-find.png' });
    await testInfo.attach('environments-page-before-find', { path: 'environments-page-before-find.png', contentType: 'image/png' });
    
    // Wait for environments page to load properly - look for the table
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    
    // Add extra wait to ensure data is loaded
    await page.waitForTimeout(3000);
    
    // Take another screenshot after waiting
    await page.screenshot({ path: 'environments-page-after-wait.png' });
    await testInfo.attach('environments-page-after-wait', { path: 'environments-page-after-wait.png', contentType: 'image/png' });
    
    // Check if ANY rows are visible first
    const allRows = page.getByRole('row');
    const rowCount = await allRows.count();
    console.log(`Total rows found: ${rowCount}`);
    
    // Check specifically for our environment name
    const envRowsWithName = page.getByRole('row').filter({ hasText: environmentName });
    const envRowCount = await envRowsWithName.count();
    console.log(`Rows with '${environmentName}': ${envRowCount}`);
    
    // Check for disabled rows specifically
    const disabledRows = page.getByRole('row').filter({ hasText: 'Disabled' });
    const disabledRowCount = await disabledRows.count();
    console.log(`Disabled rows found: ${disabledRowCount}`);
    
    // If we don't find the disabled environment, try reloading
    const testEnvRowForEnable = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Disabled' }).first();
    const isDisabledEnvVisible = await testEnvRowForEnable.isVisible();
    
    if (!isDisabledEnvVisible) {
      console.log('Disabled environment not found, trying page reload...');
      await page.reload();
      await page.waitForTimeout(5000);
      
      // Take screenshot after reload
      await page.screenshot({ path: 'environments-page-after-reload.png' });
      await testInfo.attach('environments-page-after-reload', { path: 'environments-page-after-reload.png', contentType: 'image/png' });
      
      // Wait for table to load again
      await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    }
    
    // Find the DISABLED test environment row and enable it back
    const finalTestEnvRowForEnable = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Disabled' }).first();
    
    // Take final screenshot before clicking
    const screenshot4 = await page.screenshot();
    await testInfo.attach('before-final-click', { body: screenshot4, contentType: 'image/png' });
    
    // Click the toggle button to enable it back (same button, now red/disabled)
    await finalTestEnvRowForEnable.locator('button').nth(2).click();
    
    // Confirm the enable action in the modal
    await page.getByRole('button', { name: 'Enable' }).click();
    
    // Verify the environment is now active again - check for the active row
    const enabledRow = page.getByRole('row').filter({ hasText: environmentName }).filter({ hasText: 'Active' }).first();
    await expect(enabledRow.getByText('Active')).toBeVisible();
  });
});