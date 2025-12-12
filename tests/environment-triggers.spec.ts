import { test, expect } from "./fixtures";

test.describe("Environment Triggers", () => {
  test("two environments should not have overlapping cron triggers", async ({ page }) => {
    const env1Name = `test-env-cron-1-${Date.now()}`;
    const env2Name = `test-env-cron-2-${Date.now()}`;
    const sameCronExpression = "0 0 * * *"; // Midnight daily
    
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
    await page.getByPlaceholder('e.g. 0 0 * * * (cron expression)').fill(sameCronExpression);
    
    // Create the environment
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Wait for the environment to appear in the table
    await expect(page.getByRole('row').filter({ hasText: env1Name }).first()).toBeVisible();
    
    // Create second environment with the SAME cron trigger (this should be prevented or warned)
    await page.getByRole('button', { name: 'Create New Environment' }).click();
    await page.getByPlaceholder('e.g. staging, development, production').fill(env2Name);
    await page.getByPlaceholder('e.g. org-dev-test').fill(`${env2Name}-slug`);
    await page.getByPlaceholder('e.g. projectA,projectB').fill('chromium');
    
    // Set the SAME cron expression
    await page.getByPlaceholder('e.g. 0 0 * * * (cron expression)').fill(sameCronExpression);
    
    // Attempt to create the environment
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Check if there's a validation error or warning about overlapping cron triggers
    // This should fail if the UI allows creating two environments with the same cron trigger
    const errorMessage = page.getByText(/cron|trigger|overlap|conflict|duplicate/i);
    
    // Assert that an error message is shown (or the create button is still visible, meaning creation failed)
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    const createButtonStillVisible = await page.getByRole('button', { name: 'Create' }).isVisible().catch(() => false);
    
    // Either an error should be shown OR the creation should have been prevented
    expect(hasError || createButtonStillVisible).toBeTruthy();
    
    // If no error is shown and environment was created, we need to verify they have different triggers
    // by reading the scheduled trigger values from the table or API
    if (!hasError && !createButtonStillVisible) {
      // Close modal if it auto-closed
      await page.keyboard.press('Escape');
      
      // Get the cron triggers for both environments by opening their edit modals
      // First environment
      const env1Row = page.getByRole('row').filter({ hasText: env1Name }).first();
      await env1Row.getByRole('button').first().click(); // Click edit button
      
      const env1CronInput = page.getByPlaceholder('e.g. 0 0 * * * (cron expression)');
      const env1Cron = await env1CronInput.inputValue();
      
      // Close modal
      await page.keyboard.press('Escape');
      
      // Second environment
      const env2Row = page.getByRole('row').filter({ hasText: env2Name }).first();
      await env2Row.getByRole('button').first().click(); // Click edit button
      
      const env2CronInput = page.getByPlaceholder('e.g. 0 0 * * * (cron expression)');
      const env2Cron = await env2CronInput.inputValue();
      
      // Close modal
      await page.keyboard.press('Escape');
      
      // Verify the cron expressions are different
      expect(env1Cron).not.toBe(env2Cron);
    }
    
    // Cleanup: Delete the test environments
    // Delete first environment
    const deleteEnv1 = async () => {
      const env1Row = page.getByRole('row').filter({ hasText: env1Name });
      const rowCount = await env1Row.count();
      if (rowCount > 0) {
        await env1Row.first().locator('button').last().click(); // Click delete button
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(env1Row).not.toBeVisible({ timeout: 5000 });
      }
    };
    
    // Delete second environment
    const deleteEnv2 = async () => {
      const env2Row = page.getByRole('row').filter({ hasText: env2Name });
      const rowCount = await env2Row.count();
      if (rowCount > 0) {
        await env2Row.first().locator('button').last().click(); // Click delete button
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(env2Row).not.toBeVisible({ timeout: 5000 });
      }
    };
    
    await deleteEnv1();
    await deleteEnv2();
  });
});
