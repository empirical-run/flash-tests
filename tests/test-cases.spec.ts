import { test, expect } from "./fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import {
  getTestCaseIdFromUrl,
  getTestCaseTags,
  navigateToTestCases,
  openTestCase,
  openTestCaseTagsEditor,
  saveTestCaseTags,
  setTestCaseTagsViaApi,
  TestCaseTagRestore,
} from "./pages/test-cases";

let tagRestore: TestCaseTagRestore | undefined;

test.afterEach(async ({ page }) => {
  if (!tagRestore) {
    return;
  }

  await setTestCaseTagsViaApi(page, tagRestore.testCaseId, tagRestore.tags);
  tagRestore = undefined;
});

test.describe("Test Cases Tests", () => {
  test('Edit test case should show new session screen instead of "session not found"', async ({
    page,
  }) => {
    await navigateToTestCases(page);
    await openTestCase(page, "has title");

    await expect(page.getByRole("heading", { name: "Tags" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Run History" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Metadata" })).toBeVisible();
    await expect(page.getByText("Test ID", { exact: true })).toBeVisible();
    await expect(page.getByText("Commits", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Last Run" })).toBeVisible();
    await expect(page.getByText("Session not found")).not.toBeVisible();
  });

  test("Test cases page shows run history for a test case", async ({
    page,
  }) => {
    setVideoLabel(page, "test-case-detail");

    await navigateToTestCases(page);
    await openTestCase(page, "search for auth shows only 1 card");

    await expect(
      page.getByText("search for auth shows only 1 card").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Run History" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Last Run" })).toBeVisible();
    await expect(page.getByText("Session not found")).not.toBeVisible();
  });

  test("add and remove a dated test case tag", async ({ page }) => {
    const datedTag = `e2e-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;

    await navigateToTestCases(page);
    await openTestCase(page, "has title");

    const testCaseId = getTestCaseIdFromUrl(page);
    const originalTags = await getTestCaseTags(page, testCaseId);
    tagRestore = { testCaseId, tags: originalTags };

    await openTestCaseTagsEditor(page);
    await saveTestCaseTags(page, testCaseId, [...originalTags, datedTag]);
    await expect(page.getByText(datedTag, { exact: true })).toBeVisible();
    await expect
      .poll(async () => await getTestCaseTags(page, testCaseId))
      .toContain(datedTag);

    await openTestCaseTagsEditor(page);
    await saveTestCaseTags(page, testCaseId, originalTags);
    await expect(page.getByText(datedTag, { exact: true })).not.toBeVisible();
    await expect
      .poll(async () => await getTestCaseTags(page, testCaseId))
      .toEqual(originalTags);
    tagRestore = undefined;
  });
});
