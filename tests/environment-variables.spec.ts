import { test, expect } from "./fixtures";

test("add environment variable", async ({ page }) => {
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
});

test("environment variables page navigation", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Assert that user is logged in
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();

  // Navigate to settings page
  await page.getByRole('link', { name: 'Settings' }).click();
  
  // Verify we're on the settings page and environment variables section is visible
  await expect(page.getByRole('heading', { name: 'Environment Variables' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Variable' })).toBeVisible();
  
  // Verify the environment variables help text is present
  await expect(page.getByText("These will be passed to your application")).toBeVisible();
});