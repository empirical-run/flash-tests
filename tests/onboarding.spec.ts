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
    
    // Debug: Let's see what buttons are available on the page
    const buttons = await page.locator('button').all();
    console.log("Available buttons on page:");
    for (const button of buttons) {
      const text = await button.textContent();
      const type = await button.getAttribute('type');
      const disabled = await button.isDisabled();
      console.log(`  Button: "${text}" (type: ${type}, disabled: ${disabled})`);
    }
    
    // Try to find the send button more carefully
    const sendEmailButton = page.getByRole('button', { name: 'Send Email' });
    const sendEmailButtonExists = await sendEmailButton.count() > 0;
    console.log("Send Email button exists:", sendEmailButtonExists);
    
    if (sendEmailButtonExists) {
      const isDisabled = await sendEmailButton.isDisabled();
      console.log("Send Email button disabled:", isDisabled);
      await sendEmailButton.click();
    } else {
      // Try alternative selectors
      const alternativeButtons = [
        page.getByRole('button', { name: /send/i }),
        page.getByRole('button', { name: /email/i }),
        page.locator('button[type="submit"]'),
        page.locator('button:has-text("Send")')
      ];
      
      for (const btn of alternativeButtons) {
        if (await btn.count() > 0) {
          console.log("Found alternative button:", await btn.textContent());
          await btn.click();
          break;
        }
      }
    }
    
    // Wait a moment for any async operations to complete
    await page.waitForTimeout(2000);
    
    // Debug: Let's see what's on the page after waiting
    console.log("Page content after waiting:", await page.textContent('body'));
    console.log("Current URL after submission:", page.url());
    
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
    
    // Click the Confirm Login button
    await page.getByRole('button', { name: 'Confirm Login' }).click();
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});