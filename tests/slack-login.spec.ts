import { test, expect } from "@playwright/test";
import { loginToSlack } from "../pages/slack"; // Import the helper

test("should login to slack with magic link and get code", async ({ page }) => {
  const emailId = 'user-foo';
  await loginToSlack(page, emailId); // Use the helper

  // The helper already waits for the general channel to be visible.
  // We can proceed to click it and send a message.
  const generalChannelLocator = page.locator('[data-qa="channel-sidebar-channel"]').getByText('general');
  await generalChannelLocator.click(); // Ensure it's clicked after login

  const messageInput = page.locator('[aria-label*="Message to #general"] .ql-editor, div[data-qa="message_input"] .ql-editor, [aria-label*="Message to #general"] p, div[data-qa="message_input"] p').first();
  const uniqueMessage = "hi - this is from the test run - " + new Date().toISOString();
  
  await expect(messageInput).toBeEditable({ timeout: 10000 });
  await messageInput.fill(uniqueMessage);
  await messageInput.press('Enter');

  // Assert that the message is visible in the message list
  const sentMessageLocator = page.locator('[data-qa="message_content"]')
                                 .getByText(uniqueMessage);
                                 
  await expect(sentMessageLocator).toBeVisible({ timeout: 10000 });
  console.log(`Successfully sent message to #general: "${uniqueMessage}"`);
});