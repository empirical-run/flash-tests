import type { Page } from '@playwright/test';
import { getProjectSlug } from './settings';

export async function navigateToManager(page: Page): Promise<void> {
  await page.goto(`/${getProjectSlug()}/manager`);
}
