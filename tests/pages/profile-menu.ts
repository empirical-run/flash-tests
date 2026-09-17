import { Page } from "@playwright/test";

/** Opens the signed-in user's profile menu from the dashboard header. */
export async function openProfileMenu(page: Page): Promise<void> {
  await page
    .getByRole("button", { name: process.env.AUTOMATED_USER_EMAIL!, exact: true })
    .click();
}
