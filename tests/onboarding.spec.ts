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
    
    // The magic link now takes us to the login page with token_hash parameter
    // The token might be processed automatically - let's wait and see what happens
    await page.waitForTimeout(3000);
    
    // Check if any error message appears after the wait
    const currentUrl = page.url();
    console.log('URL after waiting:', currentUrl);
    
    const currentPageText = await page.textContent('body');
    console.log('Page content after waiting:', currentPageText?.slice(0, 500) + '...');
    
    // Check for any error messages that might be displayed
    const errorElements = await page.locator('[role="alert"], .error, .alert-error, [data-testid*="error"]').allTextContents();
    console.log('Error elements found:', errorElements);
    
    // Check if there's any message about unregistered domain (with partial text matching)
    const unregisteredMessages = await page.getByText(/not registered|unregistered|contact us/i).allTextContents();
    console.log('Unregistered-related messages:', unregisteredMessages);
    
    // If we're still on the login page, maybe the actual authentication happens when clicking login
    if (currentUrl.includes('/login')) {
      console.log('Still on login page, trying to trigger authentication...');
      await page.getByRole('button', { name: 'Login with Google' }).click();
      
      // Wait for any redirect or error message
      await page.waitForTimeout(2000);
      
      const newUrl = page.url();
      console.log('URL after Google login click:', newUrl);
      
      const newPageText = await page.textContent('body');
      console.log('Page content after Google login:', newPageText?.slice(0, 500) + '...');
    }
    
    // Now try to find the error message - it might have different text
    const allText = await page.textContent('body');
    console.log('Full page text for debugging:', allText);
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});