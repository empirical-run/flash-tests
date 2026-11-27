import { expect, Page } from "@playwright/test";
import { EmailClient } from "@empiricalrun/playwright-utils";
import { toDashboardUrl } from "./urls";

/**
 * Submits the email + password signup form. Assumes the page is on /signup.
 * Returns the time just before submission, so the confirmation email can be
 * told apart from earlier mail (e.g. an invite) in the same inbox.
 */
export async function submitPasswordSignup(
  page: Page,
  email: string,
  password: string,
): Promise<Date> {
  await page.getByRole("textbox", { name: "Email" }).fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  const submittedAt = new Date();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText(
      `We sent a confirmation link to ${email}. Click the link in the email to finish creating your account.`,
    ),
  ).toBeVisible();
  return submittedAt;
}

/** Opens the signup confirmation link from the inbox and confirms it, signing the user in. */
export async function confirmSignupFromEmail(
  page: Page,
  client: EmailClient,
  email: string,
  receivedAfter: Date,
): Promise<void> {
  const confirmation = await client.waitForEmail({ receivedAfter });
  const confirmLink = confirmation.links.find((link) =>
    link.href.includes("/magic-link-landing"),
  );
  expect(confirmLink, "Confirmation email has a confirm link").toBeTruthy();
  await page.goto(toDashboardUrl(confirmLink!.href));
  await page.getByRole("button", { name: "Confirm Signup" }).click();
  await expect(
    page.getByRole("button", { name: email, exact: true }),
  ).toBeVisible({ timeout: 15000 });
}
