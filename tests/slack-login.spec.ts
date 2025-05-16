import { test, expect } from "@playwright/test";
import { EmailClient } from "@empiricalrun/playwright-utils";

test("should login to slack with magic link and get code", async ({ page }) => {
  const emailId = 'user-foo';
  const client = new EmailClient({ emailId }); // This uses 'user-foo'
  const emailAddress = 'user-foo@pnyrwq5o.mailosaur.net'; // This is the address to type

  await page.goto("https://empiricalrun.slack.com");

  await page.getByPlaceholder('name@work-email.com').click();
  await page.getByPlaceholder('name@work-email.com').fill(emailAddress);
  await page.getByLabel('Sign In With Email').click();

  const email = await client.waitForEmail({ timeout: 60000 });
  expect(email).toBeTruthy();
  expect(email.text).toBeTruthy();

  const emailBody = email.text;
  const codeRegex = /Here’s your confirmation code\.(?:.|\s)*?([A-Z0-9]{3}-[A-Z0-9]{3})/;
  const match = emailBody.match(codeRegex);
  expect(match).toBeTruthy();
  const loginCode = match[1];

  console.log(`Received login code: ${loginCode}`);
  expect(loginCode).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}$/);

  const codeChars = loginCode.replace('-', '').split('');

  for (let i = 0; i < codeChars.length; i++) {
    const fieldLabel = `digit ${i + 1} of 6`;
    await page.getByLabel(fieldLabel, { exact: true }).fill(codeChars[i]);
  }

  await page.getByRole('link', { name: 'use Slack in your browser' }).click();

  const generalChannelLocator = page.getByLabel('Channels and direct messages').getByText('general');
  await expect(generalChannelLocator).toBeVisible({ timeout: 45000 });
  await generalChannelLocator.click();

  const messageInput = page.locator('[aria-label*="Message to #general"] .ql-editor, div[data-qa="message_input"] .ql-editor, [aria-label*="Message to #general"] p, div[data-qa="message_input"] p').first();
  await expect(messageInput).toBeEditable({ timeout: 10000 });
  await messageInput.fill("hi - this is from the test run");

  await messageInput.press('Enter');

  // Assert that the message is visible in the message list
  const sentMessageLocator = page.locator('[data-qa="message_content"]')
                                 .getByText("hi - this is from the test run")
                                 .last(); // Get the last matching message
  await expect(sentMessageLocator).toBeVisible({ timeout: 10000 });
});
