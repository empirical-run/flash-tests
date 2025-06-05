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
    
    // Debug: Log the URLs to understand what's happening
    console.log("Original magic link URL:", magicLinkUrl);
    console.log("Transformed magic link URL:", transformedMagicLinkUrl);
    console.log("BUILD_URL environment variable:", process.env.BUILD_URL);
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    // Wait a moment for any redirects or loading
    await page.waitForLoadState('networkidle');
    
    // Debug: Log current URL and page title
    console.log("Current page URL:", page.url());
    console.log("Page title:", await page.title());
    
    // Take a screenshot to see what's actually on the page
    await page.screenshot({ path: 'debug-magic-link-page.png' });
    
    // Try to find any button that might be related to confirming the login
    const buttons = await page.locator('button').all();
    console.log("Available buttons:");
    for (const button of buttons) {
      const text = await button.textContent();
      console.log(`- Button text: "${text}"`);
    }
    
    // TODO(agent on page): Investigate what's on the page after navigation, then find and click the appropriate button to confirm login
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});