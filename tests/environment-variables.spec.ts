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
  
  // Verify the environment variable was added successfully
  await expect(page.getByText("TEST_VAR")).toBeVisible();
  await expect(page.getByText("test_value")).toBeVisible();
  
  // Find and click the delete button for the TEST_VAR environment variable
  // Try different selectors to find the delete button
  const deleteButton = page.locator('[data-testid*="delete"], [aria-label*="delete"], [title*="delete"], button:has-text("Delete"), button:has-text("×"), button:has-text("✕")').first();
  await deleteButton.click();
  
  // Verify the environment variable was deleted successfully
  await expect(page.getByText("TEST_VAR")).not.toBeVisible();
  await expect(page.getByText("test_value")).not.toBeVisible();
});