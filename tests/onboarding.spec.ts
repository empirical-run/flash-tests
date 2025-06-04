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
    
    // The app behavior appears to have changed. Instead of showing an unregistered domain message,
    // it redirects back to the login page. Let's check if the expected URL pattern still applies
    // or if we need to adapt the test to the new behavior
    
    // First check if we end up on a URL with unregistered_domain status
    if (currentUrl.includes('status=unregistered_domain')) {
      // If URL has the status, look for the message
      await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
      await expect(page).toHaveURL(/.*status=unregistered_domain/);
    } else {
      // The app behavior has changed - magic link for unregistered users no longer shows the expected message
      // This might be an intentional change or a bug in the application
      console.log('Application behavior has changed: magic link no longer shows unregistered domain message');
      
      // For now, let's check if we at least get redirected to the login page as expected
      await expect(page).toHaveURL(/.*login.*/);
      
      // Since the specific unregistered domain flow appears to have been removed or changed,
      // we should document this as an app behavior change rather than a test issue
      throw new Error('App behavior changed: Magic link for unregistered users no longer displays the expected unregistered domain message. The user is redirected to login page instead.');
    }
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});