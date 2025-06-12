import { test, expect } from "./fixtures";

test("user can logout successfully", async ({ page }) => {
  // Navigate to the app (starting with authenticated state)
  await page.goto("/");
  
  // Verify we're initially logged in by checking for the authenticated content
  await expect(page.getByText("Lorem Ipsum")).toBeVisible();
  
  // TODO(agent on page): Find and click the logout button or menu option to log the user out
  
  // Verify that logout was successful by checking for login elements
  // After logout, user should see login options
  await expect(
    page.locator('button:has-text("Login with password")')
  ).toBeVisible();
  
  // Verify that authenticated content is no longer visible
  await expect(page.getByText("Lorem Ipsum")).not.toBeVisible();
});