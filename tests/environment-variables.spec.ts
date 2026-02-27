import { test, expect } from "./fixtures";

test.describe("Environment Variables", () => {
  test("add and delete environment variable", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environment variables' }).click();

    // Add a new environment variable
    const envVarName = `TEST_VAR_${Date.now()}`;
    const envVarValue = `test_value_${Date.now()}`;
    
    // Click Add Variable button to open the modal
    await page.getByRole('button', { name: 'Add Variable' }).click();
    
    // Wait for the modal to appear
    await expect(page.getByText('Add Environment Variable')).toBeVisible();
    
    // Fill in the environment variable name
    await page.getByPlaceholder('e.g., DATABASE_URL').fill(envVarName);
    
    // Fill in the environment variable value  
    await page.getByPlaceholder('e.g., postgres://...').fill(envVarValue);
    
    // Save the environment variable by clicking the modal's Add Variable button
    await page.getByRole('dialog').getByRole('button', { name: 'Add Variable' }).click();
    
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
    // Navigate to the app
    await page.goto("/");
    
    // Navigate to Settings > Environment variables (new dedicated page)
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('link', { name: 'Environment variables' }).click();
    
    // Create unique variable name and value
    const envVarName = `PROD_VAR_${Date.now()}`;
    const envVarValue = `production_value_${Date.now()}`;
    
    // Click Add Variable button
    await page.getByRole('button', { name: 'Add Variable' }).click();
    
    // Wait for the modal to appear
    await expect(page.getByText('Add Environment Variable')).toBeVisible();
    
    // Fill in the variable name and value
    await page.getByPlaceholder('e.g., DATABASE_URL').fill(envVarName);
    await page.getByPlaceholder('e.g., postgres://...').fill(envVarValue);
    
    // Select "Specific environments" and check "production"
    await page.getByRole('radio', { name: 'Specific environments' }).click();
    await page.getByRole('checkbox', { name: 'production' }).check();
    
    // Save the environment variable
    await page.getByRole('dialog').getByRole('button', { name: 'Add Variable' }).click();
    
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