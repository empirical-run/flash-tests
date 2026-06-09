import { expect, type Page } from '@playwright/test';

/**
 * Navigates to the Test Cases page from the home page.
 * Assumes the user is already logged in via auth setup.
 */
export async function navigateToTestCases(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Lorem Ipsum', { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
  await expect(page).toHaveURL(/test-cases$/);
  await expect(page.getByRole('heading', { name: 'Test Cases' })).toBeVisible();
}

/**
 * Searches for and opens a test case by name from the Test Cases page.
 */
export async function openTestCase(page: Page, testName: string): Promise<void> {
  await page.getByLabel('Search test cases').fill(testName);
  const testCaseLink = page.getByRole('link', { name: new RegExp(testName) }).first();
  await expect(testCaseLink).toBeVisible();
  await testCaseLink.click();
  await expect(page).toHaveURL(/test-cases\/.*$/);
}
