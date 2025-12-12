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
    
    // Wait for success notification and the environment to appear in the table
    await expect(page.getByText('Environment created')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('row').filter({ hasText: env1Name }).first()).toBeVisible();
    
    // Verify the first environment has the cron trigger in the "Scheduled Trigger" column
    const env1Row = page.getByRole('row').filter({ hasText: env1Name }).first();
    await expect(env1Row.getByText(sameCronExpression)).toBeVisible();
    
    // Create second environment with the SAME cron trigger (this should be prevented)
    await page.getByRole('button', { name: 'Create New Environment' }).click();
    await page.getByPlaceholder('e.g. staging, development, production').fill(env2Name);
    await page.getByPlaceholder('e.g. org-dev-test').fill(`${env2Name}-slug`);
    await page.getByPlaceholder('e.g. projectA,projectB').fill('chromium');
    
    // Set the SAME cron expression
    await page.getByPlaceholder('e.g. 0 0 * * * (cron expression)').fill(sameCronExpression);
    
    // Attempt to create the environment
    await page.getByRole('button', { name: 'Create' }).click();
    
    // Wait for either success notification or error
    await page.waitForTimeout(1000);
    
    // Check if there's a validation error about overlapping cron triggers
    const errorPatterns = [
      /already exists/i,
      /duplicate/i,
      /conflict/i,
      /overlap/i,
      /same.*trigger/i,
      /cannot.*create/i
    ];
    
    let hasValidationError = false;
    for (const pattern of errorPatterns) {
      const errorText = page.getByText(pattern);
      if (await errorText.isVisible().catch(() => false)) {
        hasValidationError = true;
        break;
      }
    }
    
    // If there's a validation error, the test passes (expected behavior)
    if (hasValidationError) {
      expect(hasValidationError).toBe(true);
      // Close the modal before cleanup
      await page.keyboard.press('Escape');
    } else {
      // No validation error - check if both environments were created with the same cron
      // Close modal if it's still open
      const createButtonVisible = await page.getByRole('button', { name: 'Create' }).isVisible().catch(() => false);
      if (createButtonVisible) {
        await page.keyboard.press('Escape');
      }
      
      // Wait for the table to update
      await page.waitForTimeout(500);
      
      // Check if both environments exist in the table
      const env1Row = page.getByRole('row').filter({ hasText: env1Name }).first();
      const env2Row = page.getByRole('row').filter({ hasText: env2Name }).first();
      
      const env1Exists = await env1Row.count() > 0;
      const env2Exists = await env2Row.count() > 0;
      
      // Both environments should exist for us to verify
      if (env1Exists && env2Exists) {
        // Check the "Scheduled Trigger" column for both environments
        // The cron expression appears in the Scheduled Trigger column
        const env1CronCell = env1Row.locator('td', { hasText: sameCronExpression });
        const env2CronCell = env2Row.locator('td', { hasText: sameCronExpression });
        
        const env1HasSameCron = await env1CronCell.count() > 0;
        const env2HasSameCron = await env2CronCell.count() > 0;
        
        // Both environments should NOT have the same cron expression
        // This assertion will fail if both have the same cron, documenting the bug
        expect(env1HasSameCron && env2HasSameCron, 
          `Both environments have the same cron trigger "${sameCronExpression}". ` +
          `The application should prevent creating environments with overlapping cron triggers.`
        ).toBe(false);
      }
    }
    
    // Cleanup: Delete the test environments
    // Close any open modal first
    await page.keyboard.press('Escape').catch(() => {});
    
    // Delete first environment
    const deleteEnv = async (envName: string) => {
      const envRow = page.getByRole('row').filter({ hasText: envName });
      const rowCount = await envRow.count();
      if (rowCount > 0) {
        await envRow.first().locator('button').last().click(); // Click delete button
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(envRow).not.toBeVisible({ timeout: 5000 });
      }
    };
    
    await deleteEnv(env1Name);
    await deleteEnv(env2Name);
  });
});
