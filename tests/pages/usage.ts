import type { Page } from "@playwright/test";
import { getProjectSlug } from "./settings";

export async function navigateToUsage(page: Page): Promise<void> {
  await page.goto(`/${getProjectSlug()}/settings/usage`);
}
