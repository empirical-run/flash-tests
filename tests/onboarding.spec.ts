import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test("shows 'account is not registered, contact us' message for unregistered email", async ({ page }) => {
    // Create a dynamic email for testing
    const client = new EmailClient();
    const unregisteredEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // TODO(agent on page): Click on magic link login option and enter the unregistered email address
    
    // Assert that the message "account is not registered, contact us" is visible
    await expect(page.getByText("account is not registered, contact us")).toBeVisible();
  });
});