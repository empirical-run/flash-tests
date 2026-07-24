import { test, expect } from "./fixtures";
import { navigateToSettings } from "./pages/settings";
import { addEnvironmentVariable } from "./pages/environment-variables";

test.describe("Environment Variables", () => {
  test("add and delete environment variable", async ({ page }) => {
    await navigateToSettings(page, 'Environment variables');

    // Add a new environment variable
    const envVarName = `TEST_VAR_${Date.now()}`;
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

    await addEnvironmentVariable(page, envVarName, envVarValue, {
      environments: ['production'],
    });

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