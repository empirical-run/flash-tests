import { test, expect } from "./fixtures";

test.describe("Environment Triggers", () => {
  test("two environments should not have overlapping cron triggers", async ({ page }) => {
    const timestamp = Date.now();
    const env1Name = `test-env-cron-1-${timestamp}`;
    const env2Name = `test-env-cron-2-${timestamp}`;
    // Use a unique cron expression based on current minute to avoid conflicts with existing environments
    // Format: "minute hour * * *" where minute is derived from timestamp
    const minute = timestamp % 60;
    const hour = Math.floor((timestamp / 60) % 24);
    const cronExpression = `${minute} ${hour} * * *`;
    
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments (expand Settings menu first)
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Wait for the environments table to load
    await expect(page.getByRole('row').filter({ hasText: /Active|Disabled/ }).first()).toBeVisible();
    
    // Clean up any leftover test environments from previous runs
    const cleanupTestEnvs = async () => {
      // Check both active and disabled environments
      await page.getByRole('button', { name: 'Show Disabled' }).click().catch(() => {});
      
      // Find all rows containing "test-env-cron" in the name
      const testEnvRows = page.getByRole('row').filter({ hasText: /test-env-cron/ });
      const count = await testEnvRows.count();
      
      for (let i = 0; i < count; i++) {
        // Always get the first matching row since the list updates after each deletion
        const row = testEnvRows.first();
        const rowExists = await row.count() > 0;
        
        if (rowExists) {
          // Click the delete button (last button in the row)
          await row.locator('button').last().click();
          // Confirm deletion
          await page.getByRole('button', { name: 'Delete' }).click();
          // Wait for deletion to complete
          await page.waitForTimeout(500);
        }
      }
      
      // Hide disabled environments again
      await page.getByRole('button', { name: 'Hide Disabled' }).click().catch(() => {});
    };
    
    await cleanupTestEnvs();
    
    // Create first environment with cron trigger
    await page.getByRole('button', { name: 'Create New Environment' }).click();
    await page.getByPlaceholder('e.g. staging, development, production').fill(env1Name);
    await page.getByPlaceholder('e.g. org-dev-test').fill(`${env1Name}-slug`);
    await page.getByPlaceholder('e.g. projectA,projectB').fill('chromium');
    
    // Set the cron expression
    await page.getByPlaceholder('e.g. 0 0 * * * (cron expression)').fill(cronExpression);
    
    // Create the environment
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Wait for success notification and the environment to appear in the table
    await expect(page.getByText('Environment created').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('row').filter({ hasText: env1Name }).first()).toBeVisible();
    
    // Verify the first environment has the cron trigger in the table
    const env1Row = page.getByRole('row').filter({ hasText: env1Name }).first();
    await expect(env1Row.getByText(cronExpression)).toBeVisible();
    
    // Try to create second environment with the SAME cron trigger
    await page.getByRole('button', { name: 'Create New Environment' }).click();
    await page.getByPlaceholder('e.g. staging, development, production').fill(env2Name);
    await page.getByPlaceholder('e.g. org-dev-test').fill(`${env2Name}-slug`);
    await page.getByPlaceholder('e.g. projectA,projectB').fill('chromium');
    
    // Set the SAME cron expression
    const cronInput = page.getByPlaceholder('e.g. 0 0 * * * (cron expression)');
    await cronInput.fill(cronExpression);
    
    // Wait for validation to trigger
    await page.waitForTimeout(500);
    
    // Verify that a validation error is shown about conflicting cron schedules
    const conflictError = page.getByText(/This cron schedule conflicts with existing environments/i);
    await expect(conflictError).toBeVisible();
    
    // Verify the error message suggests using a different cron schedule
    await expect(page.getByText(/Please use a different cron schedule/i)).toBeVisible();
    
    // Verify the Create button is disabled due to validation error
    const createButton = page.getByRole('button', { name: 'Create' });
    await expect(createButton).toBeDisabled();
    
    // Verify that the second environment was NOT created
    // Close the modal
    await page.keyboard.press('Escape');
    
    // Check that only the first environment exists
    const env2Row = page.getByRole('row').filter({ hasText: env2Name });
    await expect(env2Row).not.toBeVisible();
    
    // Cleanup: Delete the first environment
    await env1Row.locator('button').last().click(); // Click delete button
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(env1Row).not.toBeVisible({ timeout: 5000 });
  });
});
