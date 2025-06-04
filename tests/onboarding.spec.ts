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

  test("shows sign up confirmation and redirects to login after confirming", async ({ page, baseURL }) => {
    // The magic link URL from email might contain localhost, so we need to replace it with the correct base URL
    const urlObj = new URL(magicLinkUrl);
    const correctedUrl = `${baseURL || 'https://dash.empirical.run'}${urlObj.pathname}${urlObj.search}`;
    
    // Navigate to the corrected magic link
    await page.goto(correctedUrl);
    
    // Verify the page shows the sign up confirmation
    await expect(page.getByText("Welcome to Empirical")).toBeVisible();
    await expect(page.getByText("Click the button below to confirm your sign up")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm Sign Up' })).toBeVisible();
    
    // Verify we're on the magic link landing page with token hash
    await expect(page).toHaveURL(/.*token_hash=pkce_/);
    
    // Click the Confirm Sign Up button
    await page.getByRole('button', { name: 'Confirm Sign Up' }).click();
    
    // TODO(agent on page): Find and copy the exact text of the alert message about unregistered domain
    
    // Verify we're redirected to the login page with unregistered domain alert
    await expect(page.getByText("the email domain doesn't have an account")).toBeVisible();
    await expect(page.getByText("reach out to us")).toBeVisible();
    
    // Verify login options are present
    await expect(page.getByText("Login with Google")).toBeVisible();
    await expect(page.getByText("Login with Email")).toBeVisible();
  });
});