import { test, expect } from "./fixtures";

test("manage environment variables", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Assert that user is logged in
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // Navigate to settings page
  await page.getByRole('link', { name: 'Settings' }).click();
  
  // Add a new environment variable with key "TEST_VAR" and value "test_value"
  await page.getByRole('button', { name: 'Add Variable' }).click();
  await page.getByPlaceholder('e.g., DATABASE_URL').click();
  await page.getByPlaceholder('e.g., DATABASE_URL').fill("TEST_VAR");
  await page.getByPlaceholder('e.g., postgres://').click();
  await page.getByPlaceholder('e.g., postgres://').fill("test_value");
  await page.getByRole('button', { name: 'Add Variable' }).click();
  
  // TODO(agent on page): Verify the environment variable was added successfully
  
  // TODO(agent on page): Delete the environment variable "TEST_VAR"
  
  // TODO(agent on page): Verify the environment variable was deleted successfully
});