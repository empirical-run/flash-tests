import { test, expect } from "./fixtures";
import { getBranchNameForDate } from "./pages/branch-name";
import { navigateToTestRuns, waitForTestRunRows } from "./pages/test-runs";

test.describe("Test Run List Filters", () => {
  test("filter test runs by environment - staging filter preserves all rows", async ({ page }) => {
    await navigateToTestRuns(page);
    const testRunRows = await waitForTestRunRows(page);
    const initialRowCount = await testRunRows.count();

    await page.getByRole('combobox').filter({ hasText: 'All environments' }).click();
    await page.getByRole('option', { name: 'Staging' }).click();

    await expect(testRunRows.first()).toBeVisible();
    const filteredRowCount = await testRunRows.count();

    // This assertion documents the expected behavior: selecting Staging should
    // preserve the visible rows for the seeded lorem-ipsum project data.
    expect(filteredRowCount).toBe(initialRowCount);
  });

  test("filter test runs by status - passed and failed", async ({ page }) => {
    await navigateToTestRuns(page);
    const testRunRows = await waitForTestRunRows(page);
    const initialRowCount = await testRunRows.count();

    await page.getByRole('combobox').filter({ hasText: 'All statuses' }).click();
    await page.getByRole('option', { name: 'Passed' }).click();
    await expect(testRunRows.first()).toBeVisible();
    await expect(page).toHaveURL(/status=passed/);

    const passedCount = await testRunRows.count();
    expect(passedCount).toBeGreaterThan(0);
    expect(passedCount).toBeLessThanOrEqual(initialRowCount);
    expect(await page.locator('main').getByText('Failed', { exact: true }).count()).toBe(0);

    await page.getByRole('combobox').filter({ hasText: 'Passed' }).click();
    await page.getByRole('option', { name: 'Failed' }).click();
    await expect(testRunRows.first()).toBeVisible();
    await expect(page).toHaveURL(/status=failed/);

    const failedCount = await testRunRows.count();
    expect(failedCount).toBeGreaterThan(0);
    expect(await page.locator('main').getByText('Passed', { exact: true }).count()).toBe(0);
  });

  test("filter test runs by branch", async ({ page }) => {
    await navigateToTestRuns(page);
    const testRunRows = await waitForTestRunRows(page);
    const initialRowCount = await testRunRows.count();

    await page.getByRole('combobox').filter({ hasText: 'All branches' }).click();

    const dropdown = page.getByRole('dialog');
    await expect(dropdown).toBeVisible();
    const searchInput = dropdown.getByRole('combobox');
    const branchOptions = dropdown.getByRole('option').filter({ hasNotText: 'All branches' });

    let branchName = '';
    const maxDaysToTry = 7;
    const searchingIndicator = dropdown.getByText('Searching...');

    for (let daysAgo = 0; daysAgo < maxDaysToTry; daysAgo++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const candidateBranch = getBranchNameForDate(targetDate);

      await searchInput.fill(candidateBranch);
      await expect(searchingIndicator).toBeHidden();

      if (await branchOptions.count() === 1) {
        branchName = candidateBranch;
        break;
      }
    }

    expect(branchName).not.toBe('');
    await expect(branchOptions).toHaveCount(1);
    await branchOptions.click();

    await expect(testRunRows.first()).toBeVisible();
    const filteredCount = await testRunRows.count();

    expect(filteredCount).toBeLessThanOrEqual(initialRowCount);
    expect(filteredCount).toBeGreaterThan(0);
    expect(await page.getByText(branchName).count()).toBeGreaterThanOrEqual(1);
    await expect(page).toHaveURL(/branch=/);

    await page.reload();
    await expect(testRunRows.first()).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: branchName })).toBeVisible();
    expect(await testRunRows.count()).toBe(filteredCount);
  });
});
