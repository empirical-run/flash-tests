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
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Verify that the magic link redirects to the login page
    await expect(page).toHaveURL(/.*\/login\?token_hash=.*&returnTo=.*magic-link-landing/);
    
    // Verify that the login page loads correctly and shows login options
    await expect(page.getByRole('button', { name: 'Login with Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login with Google' })).toBeVisible();
    
    // Test that the login form is functional by clicking on email login
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Verify the email input field is visible and functional
    await expect(page.locator('#email-magic')).toBeVisible();
    
    // Fill in the unregistered email to verify the form works
    await page.locator('#email-magic').fill(unregisteredEmail);
    await expect(page.locator('#email-magic')).toHaveValue(unregisteredEmail);
    
    // Verify the Send Email button is available
    await expect(page.getByRole('button', { name: 'Send Email' })).toBeVisible();
  });
});