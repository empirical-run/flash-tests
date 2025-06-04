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
    
    // Click the Confirm Login button
    await page.getByRole('button', { name: 'Confirm Login' }).click();
    
    // Assert that the user sees the message about unregistered domain
    await expect(page.getByText("Your email domain is not registered with Empirical. Contact us to onboard your team.")).toBeVisible();
    
    // Also verify we're on the login page with the unregistered domain status
    await expect(page).toHaveURL(/.*status=unregistered_domain/);
  });
});

test.describe("Google Login Verification", () => {
  test("can perform Google login", async ({ page, context }) => {
    // Navigate to the app
    await page.goto("/");
    
    // Click on the Google login button to initiate OAuth flow
    await page.getByRole('button', { name: 'Login with Google' }).click();
    
    // Wait for Google OAuth page to load
    await page.waitForURL(/accounts\.google\.com/, { timeout: 10000 });
    
    // Wait for animation to complete before interacting with the email field
    await page.waitForTimeout(3000);
    
    // Enter email using the specific selector
    await page.getByRole('textbox', { name: 'Email or phone' }).fill('dpdzero-test-user@empirical.run');
    
    // Click Next
    await page.getByRole('button', { name: 'Next' }).click();
    
    // Wait for password page to load
    await page.waitForTimeout(2000);
    
    // Enter password - try multiple selectors to find the correct password field
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]:visible',
      '[aria-label="Enter your password"]',
      'input[jsname="YPqjbf"]'
    ];
    
    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const passwordField = page.locator(selector).first();
        await passwordField.waitFor({ state: 'visible', timeout: 5000 });
        await passwordField.fill('flash-tests-foo-bar');
        passwordFilled = true;
        break;
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    if (!passwordFilled) {
      throw new Error('Could not find or fill password field');
    }
    
    // Click Next/Sign In button
    await page.getByRole('button', { name: 'Next' }).click();
    
    // Wait for redirect back to the application
    await page.waitForURL(/.*dash\.empirical\.run/, { timeout: 15000 });
    
    // Verify login was successful by checking the URL doesn't contain error parameters
    await expect(page).not.toHaveURL(/.*error/);
    
    // Check for successful authentication indicators
    // Look for common authenticated UI elements
    const authIndicators = [
      page.locator('[data-testid="user-menu"]'),
      page.locator('[aria-label*="user"]'),
      page.locator('[class*="user"]'),
      page.locator('text=Dashboard'),
      page.locator('text=Profile'),
      page.locator('text=Settings'),
      page.locator('button:has-text("Sign out")'),
      page.locator('button:has-text("Logout")')
    ];
    
    // Wait for at least one authentication indicator to be visible
    let authSuccess = false;
    for (const indicator of authIndicators) {
      try {
        await indicator.waitFor({ state: 'visible', timeout: 5000 });
        authSuccess = true;
        break;
      } catch (error) {
        // Continue to next indicator
      }
    }
    
    expect(authSuccess).toBe(true);
  });
});