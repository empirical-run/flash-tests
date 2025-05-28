import { test } from "@playwright/test";
import { SlackClient } from "../pages/slack";
// 

test("should login to slack with magic link and get code", async ({ page }) => {
  const emailId = "user-bar";
  const slackClient = new SlackClient({
    workspace: "empiricalrun",
    emailId: emailId,
  });
  await slackClient.login({ page });
  const channelName = "bot-testing";
  const uniqueMessage = `This message was sent from a test run at ${new Date().toISOString()}`;

  await slackClient.openSlackChannel({ page, channel: channelName });
  await slackClient.sendChannelMessage({
    page,
    channel: channelName,
    text: uniqueMessage,
  });
  await slackClient.assertMessageIsVisibleInChannel({
    page,
    messageContent: uniqueMessage,
  });
});
