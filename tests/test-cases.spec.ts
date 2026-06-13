import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";

function getTestCaseIdFromUrl(page: any): string {
  const testCaseId = page.url().match(/\/test-cases\/([^?/#]+)/)?.[1];
  if (!testCaseId) {
    throw new Error(`Could not parse test case id from URL: ${page.url()}`);
  }
  return testCaseId;
}

async function getTestCaseTags(page: any, testCaseId: string): Promise<string[]> {
  const response = await page.request.get(`/api/v2/test-cases/${testCaseId}`);
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  return body.data.test_case.tags ?? [];
}

function formatTags(tags: string[]): string {
  return tags.join(', ');
}

async function openTagsEditor(page: any, currentTags: string[]) {
  const tagsSection = page.getByRole('heading', { name: 'Tags' }).locator('..');

  if (currentTags.length === 0) {
    await tagsSection.getByText('Add tags').click();
  } else {
    await tagsSection.getByText(currentTags[0], { exact: true }).click();
  }

  await expect(page.getByPlaceholder('tag1, tag2, ...')).toBeVisible();
}

async function saveTags(page: any, testCaseId: string, tags: string[]) {
  await page.getByPlaceholder('tag1, tag2, ...').fill(formatTags(tags));

  const patchResponsePromise = page.waitForResponse(response =>
    response.url().includes(`/api/v2/test-cases/${testCaseId}`) &&
    response.request().method() === 'PATCH'
  );
  await page.getByRole('button', { name: 'Save' }).click();

  const patchResponse = await patchResponsePromise;
  expect(patchResponse.ok()).toBeTruthy();
  await expect(page.getByText('Tags updated')).toBeVisible();
}

async function navigateToTestCases(page: any) {
  await page.goto('/');
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'Test Cases', exact: true }).click();
  await expect(page).toHaveURL(/test-cases$/);
  await expect(page.getByRole('heading', { name: 'Test Cases' })).toBeVisible();
}

async function openTestCase(page: any, testName: string) {
  await page.getByLabel('Search test cases').fill(testName);
  const testCaseLink = page.getByRole('link', { name: new RegExp(testName) }).first();
  await expect(testCaseLink).toBeVisible();
  await testCaseLink.click();
  await expect(page).toHaveURL(/test-cases\/.*$/);
}

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
