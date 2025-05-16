import { test, expect } from "@playwright/test";
import { loginToSlack, sendMessageToChannel, waitForThreadReply } from "../pages/slack"; // Import the helpers

test("should login to slack and message @empirical bot in general channel", async ({ page }) => {
  const emailId = 'user-foo'; // Or a different user if needed
  await loginToSlack(page, emailId);

  const isoDateTimeString = new Date().toISOString();
  const uniqueMessage = "Hello @empirical bot from Playwright test - " + isoDateTimeString;
  const channelName = "general"; // Define the channel name

  // Send message to the channel
  await sendMessageToChannel(page, channelName, uniqueMessage);

  // Wait for and verify the thread reply from the bot
  await waitForThreadReply(page, channelName, uniqueMessage, "Empirical", isoDateTimeString);

  console.log(`Successfully sent message to @empirical bot in general channel: \"${uniqueMessage}\" and verified threaded response.`);
});