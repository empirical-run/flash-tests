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

export async function sendMessageToChannel(page: Page, channelName: string, message: string) {
  // Locator for message input. Prioritizes specific aria-labels if channelName is general.
  // Falls back to more generic selectors.
  const messageInputSelectors = [
    `[aria-label*="Message to #${channelName}"] p`,
    `[aria-label*="Message to ${channelName}"] p`,
    '.ql-editor[role="textbox"]',
    '.p-message_input_field .ql-editor',
    '[data-qa="message_input"] .ql-editor'
  ];
  const messageInputLocator = page.locator(messageInputSelectors.join(', ')).first();

  await expect(messageInputLocator, `Message input for channel "${channelName}" should be editable`).toBeEditable({ timeout: 10000 });
  await messageInputLocator.fill(message);
  await messageInputLocator.press('Enter');

  // Assert that the message is visible in the message list
  const sentMessageLocator = page.locator('[data-qa="message_content"]')
                                 .getByText(message);
  await expect(sentMessageLocator, `Sent message "${message}" should be visible in channel "${channelName}"`).toBeVisible({ timeout: 10000 });
  console.log(`Successfully sent message "${message}" to channel "${channelName}".`);
}

export async function waitForThreadReply(page: Page, channelName: string, originalMessageText: string, expectedReplySender: string, expectedReplyTextHint: string) {
  const sentMessageLocator = page.locator('[data-qa="message_content"]')
                                 .getByText(originalMessageText);
  // Ensure the original message is visible before proceeding
  await expect(sentMessageLocator, `Original message "${originalMessageText}" should be visible`).toBeVisible({ timeout: 10000 });

  const originalMessageContainer = page.locator('[data-qa="message_container"]')
    .filter({ has: sentMessageLocator });
  await expect(originalMessageContainer, "Original message container should exist").toHaveCount(1);


  const replyBar = originalMessageContainer.locator('[data-qa="reply_bar"]');
  // Wait for the "reply" text to appear, indicating a thread has started.
  await expect(replyBar, `Reply bar for message "${originalMessageText}" should indicate a reply`).toContainText("reply", { timeout: 20000 });
  await expect(replyBar, `Reply bar for message "${originalMessageText}" should show "1 reply"`).toContainText("1 reply", { timeout: 5000 });
  await replyBar.click();

  // Assert for the thread content from the bot in the opened thread pane
  const threadPaneSelectors = [
    `div[data-qa="slack_kit_list"][aria-label*="Thread in #${channelName}"]`,
    `div[data-qa="slack_kit_list"][aria-label*="Thread in ${channelName}"]`
  ];
  const threadPane = page.locator(threadPaneSelectors.join(', '));
  await expect(threadPane, `Thread pane for channel "${channelName}" should be visible`).toBeVisible({timeout: 10000});

  const botThreadMessage = threadPane
    .locator('[data-qa="message_container"]')
    .filter({
      has: page.locator(`[data-qa="message_sender_name"]:has-text("${expectedReplySender}")`),
      hasText: expectedReplyTextHint // This hint is crucial for identifying the correct reply
    });

  await expect(botThreadMessage.first(), `Thread reply from "${expectedReplySender}" containing "${expectedReplyTextHint}" should be visible`).toBeVisible({ timeout: 15000 });
  console.log(`Successfully verified threaded response from "${expectedReplySender}" containing "${expectedReplyTextHint}" in channel "${channelName}".`);
}
