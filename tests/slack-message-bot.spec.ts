import { test } from "@playwright/test";
import { SlackClient } from "../pages/slack";

test("should login to slack and message @empirical bot in general channel", async ({
  page,
}) => {
  const emailId = "user-foo";
  const slackClient = new SlackClient({
    workspace: "empiricalrun",
    emailId: emailId,
  });
  await slackClient.login({ page });
  const isoDateTimeString = new Date().toISOString();
  const uniqueMessage = "Hello @empirical bot " + isoDateTimeString;
  const channelName = "bot-testing";

  // Send message to the channel
  await slackClient.sendChannelMessage({
    page,
    channel: channelName,
    text: uniqueMessage,
  });
  await slackClient.assertMessageIsVisibleInChannel({
    page,
    messageContent: uniqueMessage,
  });
  await slackClient.assertMessageHasThreadReplies({
    page,
    channel: channelName,
    messageContent: uniqueMessage,
    repliesNumber: 1,
  });

  // Open the thread for the message sent
  await slackClient.openMessageThread({
    page,
    channel: channelName,
    messageContent: uniqueMessage,
  });
  // Assert that the bot's reply is visible in the thread
  const expectedReplyText = "project for this channel";
  await slackClient.assertMessageIsVisibleInThread({
    page,
    channel: channelName,
    messageContent: expectedReplyText,
  });
});
