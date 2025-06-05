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
    
    console.log("Generated email address:", unregisteredEmail);
    
    // Navigate to the app
    await page.goto("/");
    
    // Click on magic link login option
    await page.getByRole('button', { name: 'Login with Email' }).click();
    
    // Enter the unregistered email address
    await page.locator('#email-magic').fill(unregisteredEmail);
    await page.getByRole('button', { name: 'Send Email' }).click();
    
    // Wait for a response message to appear
    await page.waitForTimeout(3000);
    
    // Check for different possible messages more broadly
    const allText = await page.textContent('body');
    console.log("Page content after sending email:", allText);
    
    // Look for success indicators
    const successMessage = page.locator('text=Check your email for a sign-in link');
    const successEmailSent = page.locator('text=Email sent');
    const successCheckEmail = page.locator('text=check your email', { hasText: /check.*email/i });
    
    // Look for error indicators  
    const errorMessage = page.locator('text=An unexpected error occurred');
    const errorGeneral = page.locator('text=error', { hasText: /error/i });
    const errorTryAgain = page.locator('text=Please try again');
    
    // Check if any success message appears
    const hasSuccess = await successMessage.isVisible() || 
                      await successEmailSent.isVisible() || 
                      await successCheckEmail.isVisible();
    
    // Check if any error message appears
    const hasError = await errorMessage.isVisible() || 
                    await errorGeneral.isVisible() || 
                    await errorTryAgain.isVisible();
    
    if (hasSuccess) {
      console.log("SUCCESS: Magic link email was sent successfully");
      // Assert on the most common success message
      await expect(page.locator('text=Check your email')).toBeVisible();
    } else if (hasError) {
      console.log("DETECTED APP ISSUE: Email sending is failing");
      console.log("This is an app issue - the backend email service is not working properly");
      
      // This is an app issue that should be reported to developers
      throw new Error("APP ISSUE: Magic link email sending is failing with error messages. Backend email service appears to be down or misconfigured. This needs to be fixed by the app development team.");
    } else {
      console.log("UNEXPECTED: No clear success or error message found");
      console.log("Available text on page:", allText?.substring(0, 500));
      throw new Error("TEST ISSUE: Unable to determine the result of magic link email request. The page structure may have changed.");
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