import { test, expect } from "../lib/fixtures";
import { EmailClient } from "@empiricalrun/playwright-utils";
import {
  addAllowedRecipientViaUi,
  claimInboxViaUi,
  emailClientOnAppBackend,
  openAddAllowedRecipientDialog,
  openInboxesFromMoreMenu,
  releaseOwnedInbox,
  removeOwnedAllowedRecipient,
  sendEmailAsLoremIpsum,
} from "../pages/inboxes";
import { randomSixDigitCode, uniqueSuffix } from "../lib/unique-id";
import { escapeRegExp } from "../lib/regex";

test.describe("Inboxes", () => {
  const ownedInboxIds: number[] = [];
  const ownedRecipientIds: number[] = [];

  test.afterEach(async ({ page }) => {
    // Clean up only what this test created, by the IDs captured from the app.
    for (const inboxId of ownedInboxIds.splice(0)) {
      await releaseOwnedInbox(page, inboxId);
    }
    for (const recipientId of ownedRecipientIds.splice(0)) {
      await removeOwnedAllowedRecipient(page, recipientId);
    }
  });

  test("claim an inbox and read an email sent to it with sendEmail", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const label = `E2E inbox ${suffix}`;

    await openInboxesFromMoreMenu(page);
    const inbox = await claimInboxViaUi(page, `e2e-read-${suffix}`, label);
    ownedInboxIds.push(inbox.id);
    const localPart = inbox.address.split("@")[0];

    // The new inbox is selected, listed with its label, and empty
    await expect(page).toHaveURL(
      new RegExp(`/lorem-ipsum/inboxes/${localPart}$`),
    );
    await expect(
      page.getByRole("link", { name: `${label} ${inbox.address}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: inbox.address, level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText("No mail since this address was claimed."),
    ).toBeVisible();

    // A test user sends mail to the claimed address with sendEmail
    const sender = new EmailClient({ provider: "inbox" });
    const code = randomSixDigitCode();
    const subject = `Verify your account ${suffix}`;
    const verifyUrl = `https://example.com/verify?token=${suffix}`;
    const sent = await sender.sendEmail({
      to: inbox.address,
      subject,
      text: `Your code is ${code}. Verify at ${verifyUrl}`,
      html: `<p>Your code is <b>${code}</b>.</p><p><a href="${verifyUrl}">Verify email</a></p>`,
    });

    // The message shows up in the open inbox without a reload
    const messageLink = page.getByRole("link", {
      name: new RegExp(escapeRegExp(subject)),
    });
    await expect(messageLink).toBeVisible({ timeout: 60_000 });
    await expect(messageLink).toContainText(sender.getAddress());
    await messageLink.click();
    await expect(page).toHaveURL(/\?message=[0-9a-f-]+$/);

    const message = page.getByRole("article");
    await expect(
      message.getByRole("heading", { name: subject, level: 3 }),
    ).toBeVisible();
    await expect(message).toContainText(`From ${sender.getAddress()}`);

    // Extracted code and link, the same ones tests read with waitForEmail
    const copyCode = message.getByRole("button", { name: `Copy code ${code}` });
    await expect(copyCode).toBeVisible();
    await expect(
      message.getByRole("link", { name: "Verify email" }),
    ).toHaveAttribute("href", verifyUrl);
    await copyCode.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(code);

    // The rendered HTML body
    await expect(
      message.frameLocator("iframe").getByText(`Your code is ${code}.`),
    ).toBeVisible();

    // Details carry the sender, recipient, DMARC result and the Message-ID
    // that sendEmail returned (what a test passes as inReplyTo)
    await message.getByRole("button", { name: "Details" }).click();
    const detailValue = (term: string) =>
      message
        .getByRole("term")
        .filter({ hasText: new RegExp(`^${escapeRegExp(term)}$`) })
        .locator("xpath=following-sibling::*[1]");
    await expect(detailValue("From")).toHaveText(sender.getAddress());
    await expect(detailValue("To")).toHaveText(inbox.address);
    await expect(detailValue("DMARC")).toHaveText("Pass");
    await expect(detailValue("Message-ID")).toContainText(sent.messageId);
  });

  test("a claimed inbox is private to its project and can reply to senders", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();

    await openInboxesFromMoreMenu(page);
    const inbox = await claimInboxViaUi(page, `e2e-private-${suffix}`);
    ownedInboxIds.push(inbox.id);

    // Another project (this test suite's own API key) can neither read nor
    // send from an address Lorem Ipsum claimed. It must use the same API
    // backend as the app (api-preview on preview), or the claim is invisible.
    const otherProjectClient = emailClientOnAppBackend(inbox.address, 60_000);
    await expect(otherProjectClient.waitForEmail()).rejects.toThrow(
      `${inbox.address} is claimed by another project`,
    );
    await expect(
      otherProjectClient.sendEmail({
        to: `e2e-nobody-${suffix}@empiricalrun.email`,
        subject: "Should not send",
        text: "Should not send",
      }),
    ).rejects.toThrow(/claimed by another project/);

    // A customer emails the claimed inbox
    const customer = new EmailClient({ provider: "inbox", timeout: 60_000 });
    const subject = `Support request ${suffix}`;
    const sent = await customer.sendEmail({
      to: inbox.address,
      subject,
      text: "Please help with my order",
    });
    const messageLink = page.getByRole("link", {
      name: new RegExp(escapeRegExp(subject)),
    });
    await expect(messageLink).toBeVisible({ timeout: 60_000 });

    // The owning project replies from the claimed inbox in the same thread,
    // and the reply reaches the customer
    const replyResponse = await sendEmailAsLoremIpsum(page, {
      from: inbox.address,
      to: [customer.getAddress()],
      subject: `Re: ${subject}`,
      text: `Reply ${suffix}: we are on it`,
      in_reply_to: sent.messageId,
    });
    await expect(replyResponse).toBeOK();
    const reply = await customer.waitForEmail({
      subject: `Re: ${subject}`,
    });
    expect(reply.text).toContain(`Reply ${suffix}: we are on it`);

    // Releasing the address frees it: the list no longer shows it
    await page.getByRole("button", { name: "Release", exact: true }).click();
    const releaseDialog = page.getByRole("alertdialog");
    await expect(
      releaseDialog.getByRole("heading", { name: `Release ${inbox.address}?` }),
    ).toBeVisible();
    await releaseDialog
      .getByRole("button", { name: "Release Address", exact: true })
      .click();
    await expect(page).toHaveURL(/\/lorem-ipsum\/inboxes$/);
    await expect(page.getByText(inbox.address)).toHaveCount(0);

    // ...and other projects can read new mail sent to it again
    const releasedSubject = `After release ${suffix}`;
    await customer.sendEmail({
      to: inbox.address,
      subject: releasedSubject,
      text: "Sent after release",
    });
    const afterRelease = await otherProjectClient.waitForEmail({
      subject: releasedSubject,
    });
    expect(afterRelease.subject).toBe(releasedSubject);
  });

  test("allowed recipients: validation, pending verification and removal", async ({
    page,
  }) => {
    const suffix = uniqueSuffix();
    const recipientAddress = `e2e-recipient-${suffix}@example.com`;

    await openInboxesFromMoreMenu(page);

    // Inputs that never need an allowed recipient are refused with a reason
    const dialog = await openAddAllowedRecipientDialog(page);
    const input = dialog.getByRole("textbox", { name: "Domain or address" });
    const addButton = dialog.getByRole("button", {
      name: "Add Recipient",
      exact: true,
    });
    await input.fill(`e2e-${suffix}@empiricalrun.email`);
    await addButton.click();
    await expect(
      dialog.getByText("@empiricalrun.email addresses are always allowed"),
    ).toBeVisible();
    await input.fill("gmail.com");
    await addButton.click();
    await expect(
      dialog.getByText(
        "gmail.com is a public mail provider. Add the exact address instead.",
      ),
    ).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();

    // Before it is allowed, sending to the address is refused
    const sender = `e2e-sender-${suffix}@empiricalrun.email`;
    const refused = await sendEmailAsLoremIpsum(page, {
      from: sender,
      to: [recipientAddress],
      subject: `Blocked ${suffix}`,
      text: "Should be refused",
    });
    expect(refused.status()).toBe(403);
    expect((await refused.json()).error.message).toContain(
      `Not allowed to send to ${recipientAddress}`,
    );

    // Add the address: it is listed as a pending address with instructions
    const recipient = await addAllowedRecipientViaUi(page, recipientAddress);
    ownedRecipientIds.push(recipient.id);
    await expect(
      page.getByRole("link", { name: `${recipientAddress} Address · Pending` }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: recipientAddress, level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText(`${recipientAddress} and its +tag variants`),
    ).toBeVisible();

    const verifyTo = page
      .getByRole("code")
      .filter({ hasText: /^verify-[a-z0-9]+@empiricalrun\.email$/ });
    const verifySubject = page
      .getByRole("code")
      .filter({ hasText: /^Verify EMP-[A-Z0-9]+$/ });
    await expect(verifyTo).toBeVisible();
    await expect(verifySubject).toBeVisible();
    const verificationAddress = (await verifyTo.textContent())!;
    const verificationSubject = (await verifySubject.textContent())!;
    await expect(
      page.getByRole("link", { name: "Compose Email" }),
    ).toHaveAttribute(
      "href",
      new RegExp(
        `^mailto:${escapeRegExp(verificationAddress)}\\?subject=${escapeRegExp(encodeURIComponent(verificationSubject))}`,
      ),
    );
    await expect(page.getByText("Waiting for the email")).toBeVisible();

    // A verification email from a different sender must not verify it
    const impostor = new EmailClient({ provider: "inbox" });
    await impostor.sendEmail({
      to: verificationAddress,
      subject: verificationSubject,
      text: "Trying to verify someone else's address",
    });
    await expect(
      page.getByText(
        `The latest email didn't count: Email from ${impostor.getAddress()} is not from ${recipientAddress}.`,
      ),
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("link", { name: `${recipientAddress} Address · Pending` }),
    ).toBeVisible();

    // The emailed-code path rejects a wrong code
    await page
      .getByRole("button", { name: "Email a Code", exact: true })
      .click();
    await expect(
      page.getByText(
        `Code sent to ${recipientAddress}. It expires in 60 minutes.`,
      ),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Code" }).fill("000000");
    await page
      .getByRole("button", { name: "Confirm Code", exact: true })
      .click();
    await expect(page.getByText("Wrong code", { exact: true })).toBeVisible();

    // Still pending, so sending is still refused
    const stillRefused = await sendEmailAsLoremIpsum(page, {
      from: sender,
      to: [recipientAddress],
      subject: `Still blocked ${suffix}`,
      text: "Should be refused",
    });
    expect(stillRefused.status()).toBe(403);

    // Remove it through the confirmation dialog
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    const removeDialog = page.getByRole("alertdialog");
    await expect(
      removeDialog.getByRole("heading", {
        name: `Remove ${recipientAddress}?`,
      }),
    ).toBeVisible();
    await removeDialog
      .getByRole("button", { name: "Remove Recipient", exact: true })
      .click();
    await expect(page).toHaveURL(/\/lorem-ipsum\/inboxes$/);
    await expect(page.getByText(recipientAddress)).toHaveCount(0);
  });
});
