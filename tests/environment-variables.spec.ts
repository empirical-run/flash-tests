import { test, expect } from "./fixtures";

test.describe("Environment Variables", () => {
  test("add and delete environment variable", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to settings
    await page.getByRole('link', { name: 'Settings' }).click();

    // Add a new environment variable
    const envVarName = `TEST_VAR_${Date.now()}`;
    const envVarValue = "test_value_123";
    
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
    await expect(page.getByRole('row').filter({ hasText: envVarName }).getByText(envVarValue)).toBeVisible();
    
    // Delete the environment variable by clicking the delete button in its row
    await page.getByRole('row').filter({ hasText: envVarName }).getByRole('button').last().click();
    
    // Verify the environment variable was deleted
    await expect(page.getByText(envVarName)).not.toBeVisible();
    await expect(page.getByText(envVarValue)).not.toBeVisible();
  });
});