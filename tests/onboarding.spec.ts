import { test, expect } from "./fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";

test.describe("Magic Link Login", () => {
  test.describe.configure({ mode: 'serial' });
  
  let client: EmailClient;
  let unregisteredEmail: string;
  let magicLinkUrl: string;

  test("can request magic link for unregistered email", async ({ page }) => {
    // Create a dynamic email for testing unregistered user scenario
    client = new EmailClient();
    unregisteredEmail = client.getAddress();
    
    console.log("Generated email address:", unregisteredEmail);
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address
    await page.locator('#email-magic').fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Wait for a response message to appear
    await page.waitForTimeout(2000);
    
    // Check what messages are displayed
    const successMessage = page.getByText("Check your email for a sign-in link");
    const errorMessage = page.getByText("An unexpected error occurred. Please try again.").first();
    
    // Determine which message is shown
    const isSuccessVisible = await successMessage.isVisible();
    const isErrorVisible = await errorMessage.isVisible();
    
    if (isSuccessVisible) {
      // Success case - this is what we expect when the app is working properly
      await expect(successMessage).toBeVisible();
      console.log("SUCCESS: Magic link request succeeded");
    } else if (isErrorVisible) {
      // Error case - this indicates an app issue that should be reported
      console.log("DETECTED APP ISSUE: Email sending is failing with error message");
      console.log("This appears to be a backend/email service issue, not a test issue");
      
      // Try one more time to see if it's transient
      await page.getByRole('button', { name: 'Send Email' }).click();
      await page.waitForTimeout(2000);
      
      if (await successMessage.isVisible()) {
        await expect(successMessage).toBeVisible();
        console.log("SUCCESS: Magic link request succeeded on retry");
      } else {
        // Still failing - this is definitely an app issue
        throw new Error("App Issue: Magic link email sending is consistently failing. Backend email service appears to be down or misconfigured.");
      }
    } else {
      // Neither success nor error message found - unexpected state
      throw new Error("Unexpected state: Neither success nor error message found after sending magic link email");
    }
  });

  test("receives magic link email for unregistered user", async ({ page }) => {
    // Wait for the magic link email
    const email = await client.waitForEmail();
    
    // Verify email was received
    expect(email).toBeTruthy();
    
    // Find the magic link in the email
    const magicLink = email.links.find(link => 
      link.href.includes('/auth/') || 
      link.href.includes('/login') || 
      link.href.includes('/magic') ||
      link.href.includes('/verify') ||
      link.text?.toLowerCase().includes('sign') ||
      link.text?.toLowerCase().includes('login')
    );
    
    expect(magicLink).toBeTruthy();
    magicLinkUrl = magicLink!.href;
  });

  test("shows appropriate message when unregistered user clicks magic link", async ({ page }) => {
    // Transform the magic link URL to use the correct base URL for the test environment
    // The email contains localhost URLs but we need to use the actual deployment URL
    const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const transformedMagicLinkUrl = magicLinkUrl.replace(/^https?:\/\/localhost:\d+/, baseUrl);
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    // Click the Confirm Login button
    await page.getByRole('button', { name: 'Confirm Login' }).click();
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});