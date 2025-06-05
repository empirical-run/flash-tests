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
    
    // Wait a moment for any redirects or content to load
    await page.waitForLoadState('networkidle');
    
    // Capture the current URL to see where we landed
    const currentUrl = page.url();
    console.log("Current URL after magic link:", currentUrl);
    
    // Capture all text content on the page to understand what's displayed
    const pageContent = await page.locator('body').textContent();
    console.log("Page content:", pageContent);
    
    // Try to find any error message or status message on the page
    const errorMessages = await page.locator('[data-testid*="error"], [class*="error"], .alert, .message').allTextContents();
    console.log("Found messages:", errorMessages);
    
    // Look for common text patterns that might indicate unregistered domain
    const hasUnregisteredText = await page.getByText(/unregistered|not registered|domain.*registered/i).count();
    console.log("Unregistered text count:", hasUnregisteredText);
    
    // Check if we're on a login page with status parameter
    if (currentUrl.includes('status=')) {
      console.log("Status found in URL");
      // Extract status from URL
      const statusMatch = currentUrl.match(/status=([^&]+)/);
      if (statusMatch) {
        console.log("Status value:", statusMatch[1]);
      }
    }
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});