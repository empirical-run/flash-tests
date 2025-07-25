import { test, expect } from "./fixtures";

test("user is logged in successfully", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");
  
  // Assert that "Lorem Ipsum" text is visible after successful login
  // (login steps are handled by the setup project)
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
});