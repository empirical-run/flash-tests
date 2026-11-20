import { test as base, expect } from "../lib/fixtures";
import { setVideoLabel } from "@empiricalrun/playwright-utils/test";
import {
  getTestCaseIdFromUrl,
  getTestCaseTags,
  navigateToTestCases,
  openTestCase,
  openTestCaseTagsEditor,
  saveTestCaseTags,
  leaseTagEditTestCase,
  LeasedTestCase,
  releaseTagEditTestCase,
  setTestCaseTagsViaApi,
  waitForTagSyncToSettle,
} from "../pages/test-cases";

type TagEditFixtures = {
  /** Lorem Ipsum tag-store lease; teardown releases it even if the settle wait fails. */
  tagEditLease: LeasedTestCase;
  /** The dedicated test case, with Lorem Ipsum tag edits leased to this attempt. */
  tagEditTestCase: LeasedTestCase;
  /** Tags this attempt added; teardown removes them before releasing the lease. */
  addedTags: string[];
};

const test = base.extend<TagEditFixtures>({
  addedTags: async ({}, use) => {
    await use([]);
  },
  tagEditLease: async ({ page, kv }, use) => {
    const leased = await leaseTagEditTestCase(page, kv);
    await use(leased);
    // Runs even when tagEditTestCase setup (the settle wait) or teardown fails.
    await releaseTagEditTestCase(kv, leased);
  },
  tagEditTestCase: async ({ page, tagEditLease, addedTags }, use) => {
    await waitForTagSyncToSettle(page, tagEditLease.id);
    await use(tagEditLease);

    if (addedTags.length > 0) {
      const currentTags = await getTestCaseTags(page, tagEditLease.id);
      await setTestCaseTagsViaApi(
        page,
        tagEditLease.id,
        currentTags.filter((tag) => !addedTags.includes(tag)),
      );
    }
  },
});

test.describe("Test Cases Tests", () => {
  test('Edit test case should show new session screen instead of "session not found"', async ({
    page,
  }) => {
    await navigateToTestCases(page);
    await openTestCase(page, "click login button and input dummy email");

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

  test("add and remove a dated test case tag", async ({
    page,
    tagEditTestCase,
    addedTags,
  }) => {
    const datedTag = `e2e-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;

    await navigateToTestCases(page);
    await openTestCase(page, tagEditTestCase.name);
    expect(getTestCaseIdFromUrl(page)).toBe(tagEditTestCase.id);

    const testCaseId = tagEditTestCase.id;
    const originalTags = await getTestCaseTags(page, testCaseId);
    addedTags.push(datedTag);

    await openTestCaseTagsEditor(page);
    await saveTestCaseTags(page, testCaseId, [...originalTags, datedTag]);
    await expect(page.getByText(datedTag, { exact: true })).toBeVisible();

    await openTestCaseTagsEditor(page);
    await saveTestCaseTags(page, testCaseId, originalTags);
    await expect(page.getByText(datedTag, { exact: true })).not.toBeVisible();
    addedTags.length = 0;
  });
});
