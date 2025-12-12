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
    
    // Helper function to clean up test environments
    const cleanupTestEnvs = async () => {
      // Try to show disabled environments to check all test environments
      // Use count to check if button exists before clicking (cleanup context, not test logic)
      const showDisabledButton = page.getByRole('button', { name: 'Show Disabled' });
      const hasShowButton = await showDisabledButton.count();
      if (hasShowButton > 0) {
        await showDisabledButton.click();
      }
      
      // Delete all test environments by repeatedly deleting the first match
      // This pattern avoids stale element issues when the table updates
      let testEnvRow = page.getByRole('row').filter({ hasText: /test-env-cron/ }).first();
      let hasTestEnv = await testEnvRow.count();
      
      while (hasTestEnv > 0) {
        // Click delete button for this environment
        await testEnvRow.locator('button').last().click();
        await page.getByRole('button', { name: 'Delete' }).click();
        // Wait for row to be removed before checking for next one
        await expect(testEnvRow).not.toBeVisible({ timeout: 5000 });
        
        // Re-query to check if more test environments exist
        testEnvRow = page.getByRole('row').filter({ hasText: /test-env-cron/ }).first();
        hasTestEnv = await testEnvRow.count();
      }
      
      // Try to hide disabled environments to return to clean state
      const hideDisabledButton = page.getByRole('button', { name: 'Hide Disabled' });
      const hasHideButton = await hideDisabledButton.count();
      if (hasHideButton > 0) {
        await hideDisabledButton.click();
      }
    };
    
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Environments (expand Settings menu first)
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environments' }).click();
    
    // Wait for the environments table to load
    await expect(page.getByRole('row').filter({ hasText: /Active|Disabled/ }).first()).toBeVisible();
    
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
    
    // Verify that a validation error is shown about conflicting cron schedules
    // The error will appear automatically after filling the field
    const conflictError = page.getByText(/conflicts with existing environment/i);
    await expect(conflictError).toBeVisible();
    
    // Verify the error message mentions the first environment name
    await expect(page.getByText(new RegExp(env1Name)).first()).toBeVisible();
    
    // Verify the error message suggests using a different cron schedule
    await expect(page.getByText(/Please use a different cron schedule/i)).toBeVisible();
    
    // Verify the Create button is disabled due to validation error
    const createButton = page.getByRole('button', { name: 'Create' });
    await expect(createButton).toBeDisabled();
    
    // Close the modal without creating the second environment
    await page.keyboard.press('Escape');
    
    // Verify that the second environment was NOT created
    const env2Row = page.getByRole('row').filter({ hasText: env2Name });
    await expect(env2Row).not.toBeVisible();
    
    // Cleanup after test: Delete all test environments
    await cleanupTestEnvs();
  });
});
