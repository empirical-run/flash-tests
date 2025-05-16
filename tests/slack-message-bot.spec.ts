import { test, expect } from "@playwright/test";
import { loginToSlack } from "../pages/slack"; // Import the helper

test("should login to slack and message @empirical bot", async ({ page }) => {
  const emailId = 'user-foo'; // Or a different user if needed
  await loginToSlack(page, emailId);

  // Click on the "Add teammates" or "Direct messages" button to find the bot
  // This selector might need adjustment based on the Slack UI
  await page.locator('button:has-text("Add teammates"), [data-qa="DM_DIRECT_MESSAGES"]').first().click();
  
  // Search for the @empirical bot
  // The placeholder text for search input might vary
  await page.getByPlaceholder('Search for people').click();
  await page.getByPlaceholder('Search for people').fill('@empirical');

  // Click on the bot in the search results
  // This selector needs to be precise for the bot's entry
  // TODO(agent on page): Click on the @empirical bot in the search results to open a direct message with it. Ensure the bot's name is correctly identified in the user list.

  // Type and send the message
  const messageInputLocator = page.locator('[aria-label*="Message to @empirical"] .ql-editor, div[data-qa="message_input"] .ql-editor, [aria-label*="Message to @empirical"] p, div[data-qa="message_input"] p').first();
  const uniqueMessage = "Hello @empirical bot from Playwright test - " + new Date().toISOString();
  
  await expect(messageInputLocator).toBeEditable({ timeout: 10000 });
  await messageInputLocator.fill(uniqueMessage);
  await messageInputLocator.press('Enter');

  // Assert that the message is visible in the message list with the bot
  const sentMessageLocator = page.locator('[data-qa="message_content"]')
                                 .getByText(uniqueMessage);
  await expect(sentMessageLocator).toBeVisible({ timeout: 10000 });

  console.log(`Successfully sent message to @empirical bot: "${uniqueMessage}"`);
});