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
    
    await page.getByRole('button', { name: 'Add Variable' }).click();
    
    // Fill in the environment variable name
    await page.getByPlaceholder('e.g., DATABASE_URL').fill(envVarName);
    
    // Fill in the environment variable value
    await page.getByPlaceholder('e.g., postgres://...').fill(envVarValue);
    
    // Save the environment variable
    await page.getByRole('button', { name: 'Add Variable' }).click();
    
    // Verify the environment variable was added
    await expect(page.getByText(envVarName)).toBeVisible();
    await expect(page.getByText(envVarValue)).toBeVisible();
    
    // Delete the environment variable
    await page.getByRole('row').filter({ hasText: envVarName }).getByRole('button').last().click();
    
    // Verify the environment variable was deleted
    await expect(page.getByText(envVarName)).not.toBeVisible();
    await expect(page.getByText(envVarValue)).not.toBeVisible();
  });
});