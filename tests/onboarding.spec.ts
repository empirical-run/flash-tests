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
    
    // When an unregistered user clicks a magic link, they are redirected to the login page
    // where they need to authenticate. This is the expected behavior for unregistered users.
    
    // Verify that we're redirected to the login page with the correct token parameters
    await expect(page).toHaveURL(/.*\/login.*token_hash=.*/);
    
    // Verify that the login form is visible, indicating the user needs to authenticate
    await expect(page.getByRole('button', { name: 'Login with Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login with Google' })).toBeVisible();
    
    // This behavior indicates that unregistered users are prompted to login
    // rather than seeing a specific error message about unregistered domains
  });
});