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
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    // Take a screenshot to see what's on the page
    await page.screenshot({ path: 'debug-magic-link-page.png', fullPage: true });
    
    // Log all text content on the page
    const pageText = await page.textContent('body');
    console.log('Page text content:', pageText);
    
    // Log the current URL
    console.log('Current URL:', page.url());
    
    // Check what buttons are available
    const buttons = await page.locator('button').allTextContents();
    console.log('Available buttons:', buttons);
    
    // Check if there are any links that might be the confirmation
    const links = await page.locator('a').allTextContents();
    console.log('Available links:', links);
    
    // Look for any form elements
    const forms = await page.locator('form').count();
    console.log('Number of forms:', forms);
    
    // Check if there's any element with "confirm" text (case insensitive)
    const confirmElements = await page.getByText(/confirm/i).allTextContents();
    console.log('Elements with "confirm" text:', confirmElements);
    
    // Wait a bit to see if anything loads
    await page.waitForTimeout(2000);
    
    // Check URL again in case there was a redirect
    console.log('URL after waiting:', page.url());
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});