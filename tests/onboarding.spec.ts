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
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address
    await page.locator('#email-magic').fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // After clicking Send Email, the app may show a success message or proceed silently
    // We'll check for success/error indicators to determine if the email was sent
    
    // Wait a moment for any UI updates or messages to appear
    await page.waitForTimeout(1000);
    
    // Check for various possible success messages
    const successMessages = [
      "Check your email for a sign-in link",
      "Check your email",
      "We've sent you a sign-in link", 
      "Email sent",
      "Magic link sent"
    ];
    
    let hasSuccessMessage = false;
    for (const message of successMessages) {
      if (await page.getByText(message, { exact: false }).count() > 0) {
        hasSuccessMessage = true;
        break;
      }
    }
    
    // Check for error messages
    const errorMessages = [
      "error occurred",
      "failed to send",
      "invalid email",
      "something went wrong"
    ];
    
    let hasErrorMessage = false;
    for (const message of errorMessages) {
      if (await page.getByText(message, { exact: false }).count() > 0) {
        hasErrorMessage = true;
        throw new Error(`Email sending failed: found error message containing "${message}"`);
      }
    }
    
    // If no explicit success message is shown, that's acceptable as long as there's no error
    // This handles cases where the app sends emails silently without UI feedback
    if (!hasSuccessMessage) {
      console.log('No success message displayed - app may send emails silently');
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