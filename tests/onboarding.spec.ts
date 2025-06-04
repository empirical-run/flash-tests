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

  test("debug magic link verification page", async ({ page }) => {
    // Try different magic link URL patterns to see what the actual verification page looks like
    const testUrls = [
      "https://test-generator-dashboard-qlz75ytgs-empirical.vercel.app/auth/magic-link?token=dummy_token&email=test@example.com",
      "https://test-generator-dashboard-qlz75ytgs-empirical.vercel.app/verify?token=dummy_token&email=test@example.com",
      "https://test-generator-dashboard-qlz75ytgs-empirical.vercel.app/auth/callback?token=dummy_token&email=test@example.com"
    ];
    
    for (const url of testUrls) {
      console.log(`Testing URL: ${url}`);
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // TODO(agent on page): Examine what's on this page and document any buttons or form elements that might be used for confirming login
      console.log(`Current URL after navigation: ${await page.url()}`);
    }
  });
});