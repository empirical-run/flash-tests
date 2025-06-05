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
    
    // Monitor network requests to see if form submission is working
    let magicLinkRequestMade = false;
    page.on('request', request => {
      if (request.url().includes('/api/') && request.method() === 'POST') {
        console.log('POST request made:', request.url());
        if (request.url().includes('magic') || request.url().includes('email')) {
          magicLinkRequestMade = true;
        }
      }
    });
    
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Wait a bit for any async operations
    await page.waitForTimeout(3000);
    
    console.log('Magic link request made:', magicLinkRequestMade);
    
    // Check if we can find any success indication
    const successIndicators = [
      "Check your email for a sign-in link",
      "Check your email for a login link", 
      "Check your email",
      "Email sent",
      "We've sent you an email",
      "Magic link sent",
      "Sign-in link sent",
      "Sent!",
      "Success"
    ];
    
    let foundMessage = null;
    for (const message of successIndicators) {
      try {
        await expect(page.getByText(message)).toBeVisible({ timeout: 1000 });
        foundMessage = message;
        break;
      } catch (e) {
        // Continue to next message
      }
    }
    
    if (foundMessage) {
      console.log(`Success message found: "${foundMessage}"`);
    } else {
      // If no success message but network request was made, this might be an app issue
      if (magicLinkRequestMade) {
        throw new Error('Network request was made but no success message appeared - likely an app issue with the UI feedback');
      } else {
        throw new Error('No network request was made - form submission may not be working');
      }
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