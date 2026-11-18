import { expect, Page } from "@playwright/test";
import { getApiWorkerAuthHeaders } from "./api-auth";
import { getApiBaseUrl } from "./urls";
import { escapeRegExp } from "../lib/regex";

export const INBOX_DOMAIN = "empiricalrun.email";

export interface ClaimedInbox {
  id: number;
  address: string;
}

export interface AddedRecipient {
  id: number;
  value: string;
}

/**
 * Opens the Inboxes page the way a user does: header "More" menu -> Inboxes.
 *
 * @param page The Playwright page object (Lorem Ipsum project selected)
 */
export async function openInboxesFromMoreMenu(page: Page): Promise<void> {
  await page.goto("/lorem-ipsum");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("menuitem", { name: "Inboxes", exact: true }).click();
  await expect(page).toHaveURL(/\/lorem-ipsum\/inboxes$/);
  await expect(
    page.getByRole("button", { name: "Claim Address", exact: true }),
  ).toBeVisible();
}

/**
 * Claims an address through the "Claim an address" dialog and returns the
 * inbox ID and address from the app's own create response, so cleanup can
 * target exactly this inbox.
 *
 * @param page The Playwright page object, on the Inboxes page
 * @param prefix Address prefix; the app appends a random 4-character suffix
 * @param label Optional label shown in the inbox list
 */
export async function claimInboxViaUi(
  page: Page,
  prefix: string,
  label?: string,
): Promise<ClaimedInbox> {
  await page
    .getByRole("button", { name: "Claim Address", exact: true })
    .click();
  const dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Claim an address" }),
  });
  await dialog.getByRole("textbox", { name: "Prefix" }).fill(prefix);
  if (label) {
    await dialog.getByRole("textbox", { name: "Label (optional)" }).fill(label);
  }

  const claimResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/inboxes"),
  );
  await dialog
    .getByRole("button", { name: "Claim Address", exact: true })
    .click();
  const response = await claimResponse;
  expect(response.ok(), `claim inbox failed: ${response.status()}`).toBe(true);
  const body = await response.json();
  const inbox = body.data.inbox as { id: number; address: string };
  expect(inbox.address).toMatch(
    new RegExp(
      `^${escapeRegExp(prefix)}-[a-z0-9]{4}@${escapeRegExp(INBOX_DOMAIN)}$`,
    ),
  );
  await expect(dialog).toBeHidden();
  return { id: inbox.id, address: inbox.address };
}

/**
 * Adds an allowed recipient (domain or address) through the dialog and returns
 * its ID from the URL the app navigates to (/inboxes/recipients/<id>).
 *
 * @param page The Playwright page object, on the Inboxes page
 * @param value Domain or address to allow
 */
export async function addAllowedRecipientViaUi(
  page: Page,
  value: string,
): Promise<AddedRecipient> {
  const dialog = await openAddAllowedRecipientDialog(page);
  await dialog.getByRole("textbox", { name: "Domain or address" }).fill(value);
  await dialog
    .getByRole("button", { name: "Add Recipient", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/lorem-ipsum\/inboxes\/recipients\/\d+$/);
  const id = Number(page.url().split("/").pop());
  return { id, value };
}

/**
 * Opens the "Add an allowed recipient" dialog and returns it.
 *
 * @param page The Playwright page object, on the Inboxes page
 */
export async function openAddAllowedRecipientDialog(page: Page) {
  await page
    .getByRole("button", { name: "Add Allowed Recipient", exact: true })
    .click();
  const dialog = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Add an allowed recipient" }),
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

/**
 * Sends an email as the Lorem Ipsum project (the project shown in the
 * dashboard) through POST /api/inboxes/send, with the signed-in user's token.
 * Returns the raw response so tests can assert both success and refusals.
 *
 * @param page The Playwright page object (authenticated)
 * @param body The send request body (from, to, subject, text, in_reply_to...)
 */
export async function sendEmailAsLoremIpsum(
  page: Page,
  body: {
    from: string;
    to: string[];
    subject: string;
    text: string;
    in_reply_to?: string;
  },
) {
  return page.request.post(`${getApiBaseUrl()}/api/inboxes/send`, {
    headers: await getApiWorkerAuthHeaders(page),
    data: body,
  });
}

/**
 * Releases an inbox this test claimed, by its exact ID, if it is still
 * claimed, then proves it is gone from the project's inbox list.
 *
 * @param page The Playwright page object (authenticated)
 * @param inboxId ID captured from the claim response
 */
export async function releaseOwnedInbox(
  page: Page,
  inboxId: number,
): Promise<void> {
  const headers = await getApiWorkerAuthHeaders(page);
  const listInboxIds = async () => {
    const response = await page.request.get(`${getApiBaseUrl()}/api/inboxes`, {
      headers,
    });
    await expect(response).toBeOK();
    const body = await response.json();
    return (body.data.inboxes as { id: number }[]).map((inbox) => inbox.id);
  };

  if ((await listInboxIds()).includes(inboxId)) {
    const response = await page.request.delete(
      `${getApiBaseUrl()}/api/inboxes/${inboxId}`,
      { headers },
    );
    expect([200, 404]).toContain(response.status());
  }
  expect(await listInboxIds()).not.toContain(inboxId);
}

/**
 * Removes an allowed recipient this test added, by its exact ID, if it still
 * exists, then proves it is gone from the project's list.
 *
 * @param page The Playwright page object (authenticated)
 * @param recipientId ID captured when the recipient was added
 */
export async function removeOwnedAllowedRecipient(
  page: Page,
  recipientId: number,
): Promise<void> {
  const headers = await getApiWorkerAuthHeaders(page);
  const listRecipientIds = async () => {
    const response = await page.request.get(
      `${getApiBaseUrl()}/api/allowed-recipients`,
      { headers },
    );
    await expect(response).toBeOK();
    const body = await response.json();
    return (body.data.recipients as { id: number }[]).map((r) => r.id);
  };

  if ((await listRecipientIds()).includes(recipientId)) {
    const response = await page.request.delete(
      `${getApiBaseUrl()}/api/allowed-recipients/${recipientId}`,
      { headers },
    );
    expect([200, 404]).toContain(response.status());
  }
  expect(await listRecipientIds()).not.toContain(recipientId);
}
