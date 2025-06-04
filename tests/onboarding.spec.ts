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
    
    // Assert that the success message is visible
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
    
    console.log('Original magic link URL:', magicLinkUrl);
    console.log('Transformed magic link URL:', transformedMagicLinkUrl);
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    console.log('Current page URL after navigation:', page.url());
    
    // The application now redirects to the login page after visiting the magic link
    // Wait a moment for any potential redirects or messages to load
    await page.waitForLoadState('networkidle');
    
    // Check the final URL to see if it contains status parameters
    const currentUrl = page.url();
    console.log('Final URL after waiting:', currentUrl);
    
    // TODO(agent on page): After following the magic link, we're redirected to a login page. Please inspect all the text content and UI elements on this page to see if there are any error messages, warnings, or notifications about unregistered users/domains. Look for any text that might indicate the user's domain is not recognized or registered.
    
    // Look for the unregistered domain message anywhere on the page
    const unregisteredMessage = page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.");
    
    // Try to find the message with a more flexible approach
    const partialMessage = page.locator('text=email domain is not registered');
    const anotherPartialMessage = page.locator('text=unregistered');
    
    // Check if any form of the message exists
    const messageVisible = await unregisteredMessage.isVisible().catch(() => false) ||
                          await partialMessage.isVisible().catch(() => false) ||
                          await anotherPartialMessage.isVisible().catch(() => false);
    
    if (!messageVisible) {
      // If message not immediately visible, check if URL has specific status
      if (currentUrl.includes('status=unregistered_domain')) {
        console.log('URL contains unregistered_domain status parameter');
        // The status is in URL, message might appear after some action
      } else {
        console.log('No unregistered domain status found in URL or page');
      }
    }
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});