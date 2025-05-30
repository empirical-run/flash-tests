import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test("shows 'Check your email for a sign-in link' message after submitting email", async ({ page }) => {
    // Create a dynamic email for testing
    const client = new EmailClient();
    const testEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the email address in the email field
    await page.locator('#email-magic').fill(testEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Assert that the success message is visible
    await expect(page.getByText("Check your email for a sign-in link")).toBeVisible();
  });

  test("shows error for unregistered email via magic link", async ({ page }) => {
    // Use a static email that we know is unregistered
    const client = new EmailClient({ emailId: "test-unregistered-user" });
    const unregisteredEmail = client.getAddress();
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address in the email field
    await page.locator('#email-magic').fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Wait for the email to be sent and received
    const email = await client.waitForEmail();
    
    // Get the magic link from the email
    const magicLink = email.links.find(link => link.href.includes('/auth/') || link.href.includes('/login') || link.href.includes('/magic'));
    expect(magicLink).toBeTruthy();
    
    // Navigate to the magic link
    await page.goto(magicLink!.href);
    
    // TODO(agent on page): Check what message appears when visiting the magic link for an unregistered user
    
    // Assert that some error message is visible (we'll update this based on what we find)
    await expect(page.getByText("account is not registered, contact us")).toBeVisible();
  });
});