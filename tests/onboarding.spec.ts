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
    const baseUrl = process.env.BUILD_URL || "https://dash.empirical.run";
    const transformedMagicLinkUrl = magicLinkUrl.replace(/^https?:\/\/localhost:\d+/, baseUrl);
    
    console.log("Magic link URL:", transformedMagicLinkUrl);
    
    // Navigate to the magic link
    await page.goto(transformedMagicLinkUrl);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    console.log("Current URL after navigation:", await page.url());
    
    // The magic link might now directly redirect to an error state without requiring a button click
    // Check if we're already in the error state
    const currentUrl = await page.url();
    if (currentUrl.includes('status=unregistered_domain')) {
      console.log("Magic link directly redirected to unregistered domain status");
    } else {
      // If not already redirected, the app might have changed its UI
      // Let's try to find any available buttons that might confirm the login
      const buttons = await page.locator('button').all();
      console.log(`Found ${buttons.length} buttons on the page`);
      
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const buttonText = await button.textContent();
        console.log(`Button ${i}: ${buttonText}`);
      }
      
      // Try common button names for login confirmation
      const possibleButtons = [
        'Confirm Login', 
        'Complete Login', 
        'Verify', 
        'Continue', 
        'Sign In',
        'Log In',
        'Login'
      ];
      
      let buttonFound = false;
      for (const buttonName of possibleButtons) {
        const button = page.getByRole('button', { name: buttonName });
        if (await button.isVisible()) {
          console.log(`Found button: ${buttonName}`);
          await button.click();
          buttonFound = true;
          break;
        }
      }
      
      if (!buttonFound) {
        console.log("No confirmation button found - the magic link might auto-process");
      }
    }
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});