import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test("shows 'account is not registered, contact us' message for unregistered email", async ({ page }) => {
    // Create a dynamic email for testing
    const client = new EmailClient();
    const unregisteredEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // TODO(agent on page): Enter the unregistered email address in the email field and submit
    
    // Assert that the message "account is not registered, contact us" is visible
    await expect(page.getByText("account is not registered, contact us")).toBeVisible();
  });
});