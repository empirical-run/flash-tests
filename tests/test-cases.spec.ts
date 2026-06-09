import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import { navigateToTestCases, openTestCase } from "./pages/test-cases";

test.describe('Test Cases Tests', () => {
  test('Edit test case should show new session screen instead of "session not found"', async ({ page }) => {
    await navigateToTestCases(page);
    await openTestCase(page, 'has title');

    await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Metadata' })).toBeVisible();
    await expect(page.getByText('Test ID', { exact: true })).toBeVisible();
    await expect(page.getByText('Commits', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Last Run' })).toBeVisible();
    await expect(page.getByText('Session not found')).not.toBeVisible();
  });

  test('Test cases page shows run history for a test case', async ({ page }) => {
    setVideoLabel(page, 'test-case-detail');

    await navigateToTestCases(page);
    await openTestCase(page, 'search for auth shows only 1 card');

    await expect(page.getByText('search for auth shows only 1 card').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Last Run' })).toBeVisible();
    await expect(page.getByText('Session not found')).not.toBeVisible();
  });
});
