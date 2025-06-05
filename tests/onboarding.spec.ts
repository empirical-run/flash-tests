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
    
    // Debug: Let's check what email was filled
    const filledEmail = await page.locator('#email-magic').inputValue();
    console.log("Filled email:", filledEmail);
    
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Debug: Let's see if there are any error messages on the page
    const errorElements = await page.locator('[role="alert"], .error, [class*="error"], [data-testid*="error"]').all();
    if (errorElements.length > 0) {
      for (const element of errorElements) {
        const text = await element.textContent();
        console.log("Error message found:", text);
      }
    }
    
    // Debug: Let's check for any success messages that might exist
    const allText = await page.textContent('body');
    console.log("Looking for success messages in page content...");
    
    // Try different variations of success messages
    const possibleSuccessMessages = [
      "Check your email for a sign-in link",
      "Check your email",
      "Email sent",
      "We've sent you a link",
      "Magic link sent",
      "Check your inbox",
      "Sign-in link sent"
    ];
    
    for (const message of possibleSuccessMessages) {
      if (allText.includes(message)) {
        console.log("Found success message:", message);
      }
    }
    
    // Assert that the success message is visible - let's try to be more flexible
    await expect(page.getByText("Check your email for a sign-in link")).toBeVisible();
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