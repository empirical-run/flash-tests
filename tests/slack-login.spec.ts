import { test, expect } from "@playwright/test";
import { loginToSlack, sendMessageToChannel } from "../pages/slack"; // Import the helpers

test("should login to slack with magic link and get code", async ({ page }) => {
  const emailId = 'user-foo';
  await loginToSlack(page, emailId); // Use the helper

  // The helper loginToSlack already waits for the general channel to be visible.
  // We can proceed to send a message to it.
  const channelName = "general";
  const uniqueMessage = "hi - this is from the test run - " + new Date().toISOString();

  // Send message to the general channel
  await sendMessageToChannel(page, channelName, uniqueMessage);
  
  console.log(`Successfully sent message to #${channelName}: \"${uniqueMessage}\"`);
});