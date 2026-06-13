import { expect, Page } from "@playwright/test";

export type TestCaseTagRestore = {
  testCaseId: string;
  tags: string[];
};

export function getTestCaseIdFromUrl(page: Page): string {
  const testCaseId = page.url().match(/\/test-cases\/([^?/#]+)/)?.[1];
  if (!testCaseId) {
    throw new Error(`Could not parse test case id from URL: ${page.url()}`);
  }
  return testCaseId;
}

export async function getTestCaseTags(
  page: Page,
  testCaseId: string,
): Promise<string[]> {
  const response = await page.request.get(`/api/v2/test-cases/${testCaseId}`);
  await expect(response).toBeOK();

  const body = await response.json();
  return body.data.test_case.tags ?? [];
}

export async function setTestCaseTagsViaApi(
  page: Page,
  testCaseId: string,
  tags: string[],
): Promise<void> {
  const response = await page.request.patch(
    `/api/v2/test-cases/${testCaseId}`,
    {
      data: { tags },
    },
  );
  await expect(response).toBeOK();
}

export async function openTestCaseTagsEditor(page: Page): Promise<void> {
  const tagsSection = page.getByRole("heading", { name: "Tags" }).locator("..");
  await tagsSection.locator(".cursor-pointer").first().click();
  await expect(page.getByPlaceholder("tag1, tag2, ...")).toBeVisible();
}

export async function saveTestCaseTags(
  page: Page,
  testCaseId: string,
  tags: string[],
): Promise<void> {
  await page.getByPlaceholder("tag1, tag2, ...").fill(tags.join(", "));

  const patchResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v2/test-cases/${testCaseId}`) &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Save" }).click();

  const patchResponse = await patchResponsePromise;
  expect(patchResponse.ok()).toBeTruthy();
  await expect(page.getByText("Tags updated", { exact: true })).toBeVisible();
}

export async function navigateToTestCases(page: Page): Promise<void> {
  await page.goto("/");
  await expect(
    page.getByText("Lorem Ipsum", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Test Cases", exact: true }).click();
  await expect(page).toHaveURL(/test-cases$/);
  await expect(page.getByRole("heading", { name: "Test Cases" })).toBeVisible();
}

export async function openTestCase(
  page: Page,
  testName: string,
): Promise<void> {
  await page.getByLabel("Search test cases").fill(testName);
  const testCaseLink = page
    .getByRole("link", { name: new RegExp(testName) })
    .first();
  await expect(testCaseLink).toBeVisible();
  await testCaseLink.click();
  await expect(page).toHaveURL(/test-cases\/.*$/);
}
