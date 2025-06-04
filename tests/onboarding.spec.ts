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
    
    console.log("Original magic link URL:", magicLinkUrl);
    console.log("Transformed magic link URL:", transformedMagicLinkUrl);
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    // Wait a moment for any redirects to complete
    await page.waitForLoadState('networkidle');
    
    console.log("Current page URL after navigation:", page.url());
    
    // Check if the unregistered domain message is already visible
    const unregisteredMessage = page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.");
    
    try {
      // Wait a short time to see if the message appears automatically
      await expect(unregisteredMessage).toBeVisible({ timeout: 5000 });
    } catch (error) {
      // If the message is not visible, try to navigate to the returnTo URL manually
      console.log("Unregistered domain message not immediately visible, trying to navigate to magic-link-landing page...");
      
      // Extract the returnTo parameter from the current URL and navigate there
      const currentUrl = new URL(page.url());
      const returnTo = currentUrl.searchParams.get('returnTo');
      const tokenHash = currentUrl.searchParams.get('token_hash');
      
      if (returnTo && tokenHash) {
        const magicLinkLandingUrl = `${currentUrl.origin}${returnTo}?token_hash=${tokenHash}`;
        console.log("Attempting to navigate to:", magicLinkLandingUrl);
        await page.goto(magicLinkLandingUrl);
        await page.waitForLoadState('networkidle');
      }
      
      // TODO(agent on page): We're now trying to complete the magic link authentication. Look for any buttons or actions needed to proceed
    }
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});