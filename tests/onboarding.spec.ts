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
    console.log('Base URL:', baseUrl);
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    // Debug: Check what page we're actually on
    console.log('Current URL after navigation:', page.url());
    console.log('Page title:', await page.title());
    
    // Wait a bit to see if the page processes the magic link automatically
    await page.waitForLoadState('networkidle');
    console.log('URL after waiting for network idle:', page.url());
    
    // Check if we're redirected to a page with status information
    const currentUrl = page.url();
    if (currentUrl.includes('status=')) {
      const urlParams = new URL(currentUrl);
      console.log('Status from URL:', urlParams.searchParams.get('status'));
    }
    
    // Look for the expected error message or check if it's already showing
    const errorMessage = page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.");
    const isErrorVisible = await errorMessage.isVisible();
    console.log('Is error message visible:', isErrorVisible);
    
    if (!isErrorVisible) {
      // If the message is not visible, we might need to trigger some action
      // TODO(agent on page): The magic link should show an error message for unregistered domains. Check if there's any action needed to trigger this, or if we need to wait for something to load
    }
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});