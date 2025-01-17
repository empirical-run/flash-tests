import { Page } from "@playwright/test";

export async function scrollCodeEditorToTop(page: Page): Promise<void> {
  await page.locator(".cm-theme").evaluate((e) => e.scrollTo(0, 0));
}

export async function scrollCodeEditorToBottom(page: Page): Promise<void> {
  await page
    .locator(".cm-theme")
    .evaluate((e) => e.scrollTo(0, e.scrollHeight));
}
