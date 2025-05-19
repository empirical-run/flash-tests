import { Page, expect } from "@playwright/test";
import { EmailClient } from "@empiricalrun/playwright-utils";

export class SlackClient {
  private workspace: string;
  private emailId: string;

  constructor({ workspace, emailId }: { workspace: string; emailId: string }) {
    this.workspace = workspace;
    this.emailId = emailId;
  }

  async login({ page }: { page: Page }) {
    const emailClient = new EmailClient({ emailId: this.emailId });
    const emailAddress = emailClient.getAddress();

    await page.goto(`https://${this.workspace}.slack.com`);
    await page.getByPlaceholder("name@work-email.com").click();
    await page.getByPlaceholder("name@work-email.com").fill(emailAddress);
    await page.getByRole("button", { name: "Sign In with Email" }).click();

    const email = await emailClient.waitForEmail({
      subject: "Slack confirmation code",
    });
    expect(email).toBeTruthy();

    const emailSubject = email.subject!;
    const codeRegex = /Slack confirmation code: ([A-Z0-9]{3}-[A-Z0-9]{3})/;
    const match = emailSubject.match(codeRegex);
    const loginCode = match![1];
    console.log(
      `Received login code: ${loginCode} from subject: "${emailSubject}"`,
    );

    const codeChars = loginCode.replace("-", "").split("");
    for (let i = 0; i < codeChars.length; i++) {
      const fieldLabel = `digit ${i + 1} of 6`;
      await page.getByLabel(fieldLabel, { exact: true }).fill(codeChars[i]);
    }
    await page.getByRole("link", { name: "use Slack in your browser" }).click();
    // Assert that the workspace is loaded by checking for the search bar
    await page.getByLabel("Search").waitFor();
  }

  async openSlackChannel({ page, channel }: { page: Page; channel: string }) {
    const sidebarLocator = page.locator('[data-qa="channel-sidebar"]');
    // Switch to the channel
    await sidebarLocator.getByText(channel).click();
  }

  async sendChannelMessage({
    page,
    channel,
    text,
  }: {
    page: Page;
    channel: string;
    text: string;
  }) {
    // Send message
    const messageInputSelectors = [
      `[aria-label*="Message to #${channel}"] p`,
      `[aria-label*="Message to ${channel}"] p`,
      `[aria-label*="Message to # ${channel}"] p`,
      '.ql-editor[role="textbox"]',
      ".p-message_input_field .ql-editor",
      '[data-qa="message_input"] .ql-editor',
      '[data-qa="message-input"] .ql-editor',
    ];
    const messageInputLocator = page
      .locator(messageInputSelectors.join(", "))
      .first();
    await messageInputLocator.fill(text);
    await messageInputLocator.press("Enter");
  }

  async assertMessageIsVisibleInChannel({
    page,
    messageContent,
  }: {
    page: Page;
    messageContent: string;
  }) {
    const messageLocator = page
      .locator('[data-qa="message_content"]')
      .getByText(messageContent);
    await expect(messageLocator.last()).toBeVisible();
  }

  async openMessageThread({
    page,
    channel,
    messageContent,
  }: {
    page: Page;
    channel: string;
    messageContent: string;
  }) {
    const originalMessageContainer = page
      .locator('[data-qa="message_container"]')
      .filter({ hasText: messageContent });
    const replyBar = originalMessageContainer.locator('[data-qa="reply_bar"]');
    await replyBar.click();

    const threadPaneSelectors = [
      `div[data-qa="slack_kit_list"][aria-label*="Thread in #${channel}"]`,
      `div[data-qa="slack_kit_list"][aria-label*="Thread in ${channel}"]`,
      `div[data-qa="slack_kit_list"][aria-label*="Thread"]`,
      `[data-qa="threads-flexpane"]`,
      `.p-threads_flexpane`,
    ];
    const threadPane = page.locator(threadPaneSelectors.join(", ")).first();
    await expect(threadPane).toBeVisible({ timeout: 10000 });
  }

  async assertMessageIsVisibleInThread({
    page,
    channel,
    messageContent,
  }: {
    page: Page;
    channel: string;
    messageContent: string;
  }) {
    // This method expects the thread pane to be open
    const threadPaneSelectors = [
      `div[data-qa="slack_kit_list"][aria-label*="Thread in #${channel}"]`,
      `div[data-qa="slack_kit_list"][aria-label*="Thread in ${channel}"]`,
      `div[data-qa="slack_kit_list"][aria-label*="Thread"]`,
      `[data-qa="threads-flexpane"]`,
      `.p-threads_flexpane`,
    ];
    const threadPane = page.locator(threadPaneSelectors.join(", ")).first();
    const replyMessageLocator = threadPane
      .locator('[data-qa="message_content"], .c-message_kit__message_content')
      .getByText(messageContent, { exact: false });

    await expect(replyMessageLocator).toBeVisible();
  }

  async assertMessageHasThreadReplies({
    page,

    messageContent,
    repliesNumber,
  }: {
    page: Page;
    channel: string;
    messageContent: string;
    repliesNumber: number;
  }) {
    const messageContainer = page
      .locator('[data-qa="virtual-list-item"], .c-virtual_list__item')
      .filter({ hasText: messageContent });

    const replyBarLocator = messageContainer.locator('[data-qa="reply_bar"]');
    const expectedReplyTextRegex = new RegExp(
      `^${repliesNumber} repl(?:y|ies)`,
    );
    await expect(replyBarLocator).toBeVisible();
    await expect(
      replyBarLocator.getByText(expectedReplyTextRegex),
    ).toBeVisible();
  }
}
