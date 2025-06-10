import { test, expect } from "./fixtures";

test.describe("Cleanup", () => {
  test("delete all disabled API keys", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // Navigate to the API keys section
    await page.getByRole('link', { name: 'API Keys' }).click();
    
    // TODO(agent on page): Find all disabled API keys and delete them. Look for rows that contain "Disabled" status or disabled buttons, then click on the delete button for each one and complete the deletion flow.
  });
});