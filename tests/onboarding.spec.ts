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
    
    // Debug: Check if the form is properly set up
    const emailInput = page.locator('#email-magic');
    const inputValue = await emailInput.inputValue();
    const form = page.locator('form').first();
    const formAction = await form.getAttribute('action');
    const formMethod = await form.getAttribute('method');
    
    console.log(`Email filled: "${inputValue}"`);
    console.log(`Form action: "${formAction}"`);
    console.log(`Form method: "${formMethod}"`);
    
    // Try pressing Enter on the input field (alternative way to submit)
    console.log("Trying to submit via Enter key...");
    await emailInput.press('Enter');
    await page.waitForTimeout(1000);
    
    // Check if anything changed after Enter
    let currentUrl = page.url();
    console.log("URL after Enter:", currentUrl);
    
    // If Enter didn't work, try clicking the button
    if (currentUrl.includes('/login')) {
      console.log("Enter didn't work, trying button click...");
      await page.getByRole('button', { name: 'Send Email' }).click();
      await page.waitForTimeout(1000);
      currentUrl = page.url();
      console.log("URL after button click:", currentUrl);
    }
    
    // Try alternative - submit the form directly
    if (currentUrl.includes('/login')) {
      console.log("Button click didn't work, trying form submit...");
      await form.evaluate(form => (form as HTMLFormElement).submit());
      await page.waitForTimeout(1000);
      currentUrl = page.url();
      console.log("URL after form submit:", currentUrl);
    }
    
    // Check the final page state
    console.log("Final page content:", await page.textContent('body'));
    
    // The test expectation - this should pass if magic link functionality works
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