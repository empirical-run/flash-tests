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
    
    // TODO(agent on page): Add a new environment variable with name "${envVarName}" and value "${envVarValue}"

    // Verify the environment variable was added
    // TODO(agent on page): Verify that the environment variable with name "${envVarName}" is visible in the list

    // Delete the environment variable
    // TODO(agent on page): Delete the environment variable with name "${envVarName}"

    // Verify the environment variable was deleted
    // TODO(agent on page): Verify that the environment variable with name "${envVarName}" is no longer visible in the list
  });
});