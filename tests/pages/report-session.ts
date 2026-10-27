import { expect, Page } from "@playwright/test";

/** Report entrypoints open the floating session dock, not the Sessions creation dialog. */
export function getReportSessionDock(page: Page) {
  return page.getByRole("dialog", { name: "Session", exact: true });
}

export function getReportSessionPrompt(page: Page) {
  return getReportSessionDock(page).getByRole("textbox", {
    name: "What should the agent do?",
    exact: true,
  });
}

/** Use the canonical header entrypoint; it attaches the current report/case URL. */
export async function openHeaderSessionDock(page: Page): Promise<void> {
  await page
    .getByRole("banner")
    .getByRole("button", { name: "New session", exact: true })
    .click();
  await expect(getReportSessionDock(page)).toBeVisible();
  await expect(getReportSessionPrompt(page)).toBeEditable();
}
