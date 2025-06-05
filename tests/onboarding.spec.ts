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
    
    // Debug: Check if email field was actually filled
    const emailValue = await page.locator('#email-magic').inputValue();
    console.log('Email field value:', emailValue);
    
    // Debug: Check if there are any error messages
    const errorElements = await page.locator('[role="alert"], .error, [data-testid*="error"]').all();
    for (const errorElement of errorElements) {
      const errorText = await errorElement.textContent();
      console.log('Error message found:', errorText);
    }
    
    // Debug: Check button state before clicking
    const sendButton = page.getByRole('button', { name: 'Send Email' });
    const isButtonEnabled = await sendButton.isEnabled();
    console.log('Send Email button enabled:', isButtonEnabled);
    
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Debug: Wait a bit for any async operations
    await page.waitForTimeout(2000);
    
    // Debug: Take a screenshot to see what's on the page
    await page.screenshot({ path: 'debug-after-send-email.png', fullPage: true });
    
    // Debug: Check current URL
    console.log('Current URL after Send Email:', page.url());
    
    // Debug: Print page content to see what messages are actually present
    const pageText = await page.textContent('body');
    console.log('Page text after clicking Send Email:', pageText?.substring(0, 800));
    
    // Try different possible success messages
    const possibleMessages = [
      "Check your email for a sign-in link",
      "Check your email for a login link", 
      "Check your email",
      "Email sent",
      "We've sent you an email",
      "Magic link sent",
      "Sign-in link sent",
      "Sent!",
      "Success"
    ];
    
    let foundMessage = false;
    for (const message of possibleMessages) {
      try {
        await expect(page.getByText(message)).toBeVisible({ timeout: 1000 });
        console.log(`Found message: "${message}"`);
        foundMessage = true;
        break;
      } catch (e) {
        // Continue to next message
      }
    }
    
    if (!foundMessage) {
      // Check if we're still on the same form (indicating form submission failed)
      const emailField = page.locator('#email-magic');
      const isEmailFieldVisible = await emailField.isVisible();
      if (isEmailFieldVisible) {
        throw new Error(`Form submission appears to have failed. Email field still visible. Page content: ${pageText?.substring(0, 500)}`);
      } else {
        throw new Error(`No success message found but form may have submitted. Page content: ${pageText?.substring(0, 500)}`);
      }
    }
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
    
    // Click the Confirm Login button
    await page.getByRole('button', { name: 'Confirm Login' }).click();
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});