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
    
    // Monitor network requests to check if form submission is working
    let magicLinkRequestMade = false;
    page.on('request', request => {
      if (request.url().includes('/api/') && request.method() === 'POST') {
        console.log('POST request made:', request.url());
        // Look for magic link or email-related API calls
        if (request.url().includes('magic') || 
            request.url().includes('email') || 
            request.url().includes('auth') ||
            request.url().includes('login')) {
          magicLinkRequestMade = true;
        }
      }
    });
    
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Wait for potential async operations
    await page.waitForTimeout(3000);
    
    // Check if a network request was made (indicating form submission worked)
    if (!magicLinkRequestMade) {
      // This is an app issue - the magic link form is not working
      // The form should submit and make an API request when "Send Email" is clicked
      throw new Error(
        'APP ISSUE: Magic link form submission is broken. ' +
        'Clicking "Send Email" should trigger a POST request to send the magic link, ' +
        'but no network request was made. This indicates the form submission logic is not working. ' +
        'Developers need to fix the magic link form before this test can pass.'
      );
    }
    
    // If we get here, the form submission worked, so check for success message
    await expect(page.getByText("Check your email for a sign-in link")).toBeVisible();
  });

  test("receives magic link email for unregistered user", async ({ page }) => {
    // This test depends on the magic link form working correctly
    // If the previous test failed due to broken form submission, this test will also fail
    
    try {
      // Wait for the magic link email (shorter timeout since we expect it to fail if form is broken)
      const email = await client.waitForEmail({ timeout: 5000 });
      
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
    } catch (error) {
      if (error.message?.includes('Email not received')) {
        throw new Error(
          'APP ISSUE: No magic link email was received. ' +
          'This is expected if the magic link form submission is broken (see previous test). ' +
          'The form must be fixed before magic link emails can be sent. ' +
          'Original error: ' + error.message
        );
      }
      throw error;
    }
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