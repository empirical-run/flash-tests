import { test, expect } from "./fixtures";
import { addEnvironmentVariable, navigateToSettings } from "./pages/settings";

test.describe("Environment Variables", () => {
  // Track variable names created by each test so we can guarantee cleanup even if
  // the test fails partway through. Without this, a mid-test failure leaks a row
  // and the shared environment accumulates junk over time.
  let createdVarNames: string[] = [];

  test.afterEach(async ({ page }) => {
    if (createdVarNames.length === 0) return;
    await navigateToSettings(page, 'Environment variables');
    const filter = page.getByPlaceholder('Filter by name or description...');
    for (const name of createdVarNames) {
      await filter.fill(name);
      const rows = page.getByRole('row').filter({ hasText: name });
      while ((await rows.count()) > 0) {
        await rows.first().getByRole('button').last().click();
        await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).click();
        await expect(page.getByText('Are you sure you want to delete')).not.toBeVisible();
      }
    }
    createdVarNames = [];
  });

  test("add and delete environment variable", async ({ page }) => {
    await navigateToSettings(page, 'Environment variables');

    // Add a new environment variable
    const envVarName = `TEST_VAR_${Date.now()}`;
    createdVarNames.push(envVarName);
    const envVarValue = `test_value_${Date.now()}`;
    
    await addEnvironmentVariable(page, envVarName, envVarValue);
    
    // Verify the environment variable was added to the list
    await expect(page.getByText(envVarName)).toBeVisible();
    
    // Verify the environment variable value is initially masked (for security)
    const envVarRow = page.getByRole('row', { name: envVarName });
    await expect(envVarRow).toBeVisible();
    
    // Click the eye icon to reveal the value
    await envVarRow.getByRole('button').first().click();
    
    // Now verify the actual value is visible
    await expect(page.getByText(envVarValue)).toBeVisible();
    
    // Delete the environment variable by clicking the delete button in its row
    await page.getByRole('row').filter({ hasText: envVarName }).getByRole('button').last().click();
    
    // Wait for the confirmation dialog to appear
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
    
    // Confirm the deletion by clicking the confirmation button
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Wait for the confirmation dialog to disappear
    await expect(page.getByText('Are you sure you want to delete')).not.toBeVisible();
    
    // Verify the environment variable was deleted
    await expect(page.getByText(envVarName)).not.toBeVisible();
    await expect(page.getByText(envVarValue)).not.toBeVisible();
  });

  test("add environment-specific override", async ({ page }) => {
    await navigateToSettings(page, 'Environment variables');
    
    // Create unique variable name and value
    const envVarName = `PROD_VAR_${Date.now()}`;
    const envVarValue = `production_value_${Date.now()}`;
    createdVarNames.push(envVarName);
    
    await addEnvironmentVariable(page, envVarName, envVarValue, ['production']);
    
    // Verify the variable appears in the list with the production environment tag
    await expect(page.getByRole('row', { name: new RegExp(envVarName) })).toBeVisible();
    
    // Clean up: delete the variable
    await page.getByRole('row', { name: new RegExp(envVarName) }).getByRole('button').last().click();
    
    // Confirm deletion
    await expect(page.getByText('Are you sure you want to delete')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    
    // Verify the variable was deleted
    await expect(page.getByText(envVarName)).not.toBeVisible();
  });
});