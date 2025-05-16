import { Page, expect } from "@playwright/test";
import { EmailClient } from "@empiricalrun/playwright-utils";

/**
 * Logs into Slack using a magic link.
 * @param page Playwright Page object
 * @param emailId The user ID for the email (e.g., 'user-foo')
 */
export async function loginToSlack(page: Page, emailId: string) {
  const client = new EmailClient({ emailId });
  const emailAddress = client.getAddress();

  await page.goto("https://empiricalrun.slack.com");

  await page.getByPlaceholder('name@work-email.com').click();
  await page.getByPlaceholder('name@work-email.com').fill(emailAddress);
  await page.getByLabel('Sign In With Email').click();

  // Wait for and process the login email
  const email = await client.waitForEmail();
  expect(email, "Login email should be received").toBeTruthy();
  expect(email.text, "Login email should have text content").toBeTruthy();

  const emailBody = email.text!; // Non-null assertion as we've checked above
  const codeRegex = /Here’s your confirmation code\.(?:.|\s)*?([A-Z0-9]{3}-[A-Z0-9]{3})/
  const match = emailBody.match(codeRegex);
  expect(match, "Login code should be found in email").toBeTruthy();
  const loginCode = match![1]; // Non-null assertion

  console.log(`Received login code: ${loginCode}`);
  expect(loginCode, "Login code format should be valid").toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);

  // Enter the login code
  const codeChars = loginCode.replace('-', '').split('');
  for (let i = 0; i < codeChars.length; i++) {
    const fieldLabel = `digit ${i + 1} of 6`;
    await page.getByLabel(fieldLabel, { exact: true }).fill(codeChars[i]);
  }

  // Opt to use Slack in browser and wait for workspace to load
  await page.getByRole('link', { name: 'use Slack in your browser' }).click();
  
  // Wait for the general channel to be visible to confirm successful login
  const generalChannelLocator = page.locator('[data-qa="channel-sidebar-channel"]').getByText('general');
  await expect(generalChannelLocator).toBeVisible({ timeout: 45000 });
  console.log('Successfully logged into Slack and the "general" channel is visible.');
}