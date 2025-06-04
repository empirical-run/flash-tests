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
    
    // Check if the URL already indicates unregistered domain status
    const currentUrl = page.url();
    console.log('Current URL after magic link navigation:', currentUrl);
    
    // Wait for any redirections to complete and check final URL
    await page.waitForLoadState('networkidle');
    const finalUrl = page.url();
    console.log('Final URL after all redirections:', finalUrl);
    
    // Check if the magic link properly redirects to unregistered domain status
    // If the URL contains status=unregistered_domain, we can check for the message
    if (finalUrl.includes('status=unregistered_domain')) {
      // Assert that the user sees the message about unregistered domain
      await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    } else {
      // If not redirected to unregistered domain status, this suggests an app issue
      // For now, we'll check if we can trigger the domain validation by interacting with the login form
      
      // Try clicking Login with Email to see if domain validation happens there
      await page.getByRole('button', { name: 'Login with Email' }).click();
      
      // Fill in the unregistered email
      await page.locator('#email-magic').fill(unregisteredEmail);
      
      // Try to send email and see if domain validation triggers
      await page.getByRole('button', { name: 'Send Email' }).click();
      
      // Wait a moment for any error messages to appear
      await page.waitForTimeout(2000);
      
      // Check if there's any domain-related error message or unregistered domain status in URL
      const updatedUrl = page.url();
      console.log('URL after attempting email send:', updatedUrl);
      
      if (updatedUrl.includes('status=unregistered_domain')) {
        // Domain validation happened after form submission
        await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
      } else {
        // If still no unregistered domain status, log the current page state for debugging
        const pageContent = await page.content();
        console.log('Page content for debugging:', pageContent.substring(0, 1000));
        
        // Check for alternative error messages that might indicate unregistered domain
        const possibleErrorSelectors = [
          'text="not registered"',
          'text="unregistered"', 
          'text="domain"',
          '[role="alert"]',
          '.error',
          '.warning'
        ];
        
        let foundError = false;
        for (const selector of possibleErrorSelectors) {
          const errorElement = page.locator(selector);
          if (await errorElement.isVisible()) {
            const errorText = await errorElement.textContent();
            console.log(`Found potential error with selector ${selector}: ${errorText}`);
            foundError = true;
          }
        }
        
        if (!foundError) {
          console.log('No unregistered domain error found - this may indicate an app issue');
          // For now, we'll fail the test to surface this potential app issue
          throw new Error('Expected unregistered domain validation but no error was shown. This may indicate an app issue where unregistered domain checking is not working properly.');
        }
      }
    }
    
    // Verify we're on a page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});