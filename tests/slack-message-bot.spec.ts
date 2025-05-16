import { test, expect } from "@playwright/test";
import { loginToSlack } from "../pages/slack"; // Import the helper

test("should login to slack and message @empirical bot in general channel", async ({ page }) => {
  const emailId = 'user-foo'; // Or a different user if needed
  await loginToSlack(page, emailId);

  // Type and send the message
  // Adjusted to a more generic message input locator, verify during agent execution
  const messageInputLocator = page.locator('.ql-editor[role="textbox"], .p-message_input_field .ql-editor, [data-qa="message_input"] .ql-editor, [aria-label*="Message to"] p').first();
  const isoDateTimeString = new Date().toISOString();
  const uniqueMessage = "Hello @empirical bot from Playwright test - " + isoDateTimeString;
  
  await expect(messageInputLocator).toBeEditable({ timeout: 10000 });
  await messageInputLocator.fill(uniqueMessage);
  await messageInputLocator.press('Enter');

  // Assert that the message is visible in the message list in the general channel
  const sentMessageLocator = page.locator('[data-qa="message_content"]')
                                 .getByText(uniqueMessage);
  await expect(sentMessageLocator).toBeVisible({ timeout: 10000 });

  // 1. Identify the message container for the original message that we sent
  // sentMessageLocator is already defined and awaited in the lines above.
  const originalMessageContainer = page.locator('[data-qa="message_container"]')
    .filter({ has: sentMessageLocator });

  // 2. Locate the reply bar in that container, assert text, and click
  const replyBar = originalMessageContainer.locator('[data-qa="reply_bar"]');
  // Wait for the "reply" text to appear, indicating a thread has started.
  // Slack might take a few seconds for the bot to reply and the UI to update.
  await expect(replyBar).toContainText("reply", { timeout: 20000 }); // Wait for any reply indication
  await expect(replyBar).toContainText("1 reply", { timeout: 5000 }); // Specifically "1 reply"
  await replyBar.click();

  // 3. Assert for the thread content from the bot in the opened thread pane
  const threadPane = page.locator('div[data-qa="slack_kit_list"][aria-label*="Thread in general"]');
  
  // The bot's reply will be a 'message_container' within the thread pane,
  // sent by "Empirical" and containing the text "pong".
  const botThreadMessage = threadPane
    .locator('[data-qa="message_container"]') // Get all message containers in the thread
    .filter({
      has: page.locator('[data-qa="message_sender_name"]:has-text("Empirical")'), // Sent by Empirical
      hasText: isoDateTimeString // Contains the ISO datetime string
    });

  await expect(botThreadMessage.first()).toBeVisible({ timeout: 15000 }); // Ensure the bot's message with the unique string is visible

  console.log(`Successfully sent message to @empirical bot in general channel: "${uniqueMessage}" and verified threaded response.`);
});