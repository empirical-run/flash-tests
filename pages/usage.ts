import type { Locator, Page } from "@playwright/test";
import { getProjectSlug } from "./settings";

export async function navigateToUsage(page: Page): Promise<void> {
  await page.goto(`/${getProjectSlug()}/settings/usage`);
}

export async function readNumericCells(row: Locator): Promise<number[]> {
  const cells = await row.getByRole("cell").allTextContents();
  return cells.slice(-3).map((value) => Number(value.replaceAll(",", "")));
}
