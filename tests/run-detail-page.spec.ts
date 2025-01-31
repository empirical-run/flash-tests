import { test, expect } from "./fixtures";

interface FailedRun {
  id: number;
  failed_count: number;
}

let failedRun: FailedRun | undefined;

test.beforeAll(async () => {
  const response = await fetch(
    "https://dash.empirical.run/api/test-runs?project_id=3&limit=100&offset=0&branch=main",
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: "weQPMWKT",
      },
    },
  );
  const jsonResponse = await response.json();
  [failedRun] = jsonResponse.data.test_runs.items.filter(
    (r: FailedRun) => r.failed_count > 0,
  );
});

test("Update failure type of failed test case should work", async ({
  loggedInPage,
}) => {
  expect(failedRun).toBeDefined();
  expect(failedRun?.id).toBeDefined();
  expect(failedRun?.failed_count).toBeDefined();
  await loggedInPage.goto(
    `https://dash.empirical.run/flash-tests/test-runs/${failedRun?.id}`,
  );
  await expect(loggedInPage.getByText("Test run on Production")).toBeVisible();

  if (
    await loggedInPage
      .getByRole("button", { name: "Set failure type" })
      .first()
      .isVisible()
  ) {
    await loggedInPage
      .getByRole("button", { name: "Set failure type" })
      .first()
      .click();
  } else {
    await loggedInPage.getByRole("button", { name: "Edit" }).first().click();
  }

  await loggedInPage.getByRole("button", { name: "App issue" }).click();
  await loggedInPage.getByPlaceholder("Add any additional context").fill("");
  await loggedInPage.getByRole("button", { name: "Save for test" }).click();
  await expect(
    loggedInPage.getByRole("heading", { name: "Set failure type for test:" }),
  ).toBeHidden();
  await expect(loggedInPage.getByText("App issue").first()).toBeVisible();

  // Check if the failure type change works
  await loggedInPage.getByRole("button", { name: "Edit" }).first().click();
  await loggedInPage.getByRole("button", { name: "Test issue" }).click();
  await loggedInPage
    .getByPlaceholder("Add any additional context")
    .fill("Big test issue");
  await loggedInPage.getByRole("button", { name: "Save for test" }).click();
  await expect(
    loggedInPage.getByRole("heading", { name: "Set failure type for test:" }),
  ).toBeHidden();
  await expect(loggedInPage.getByText("Test issue").first()).toBeVisible();
  await expect(loggedInPage.getByText("Big test issue").first()).toBeVisible();

  // after page reload the update should be visible
  await loggedInPage.reload();
  await expect(loggedInPage.getByText("Test issue").first()).toBeVisible();
  await expect(loggedInPage.getByText("Big test issue").first()).toBeVisible();
});

test("error line should get highlighted simultaneously with test case selection", async ({
  loggedInPage,
}) => {
  await loggedInPage.goto(
    `https://dash.empirical.run/flash-tests/test-runs/${failedRun?.id}`,
  );
  await expect(loggedInPage.getByText("Test run on Production")).toBeVisible();
  await loggedInPage
    .getByRole("row", { name: "[chromium]" })
    .first()
    .getByRole("cell")
    .first()
    .getByRole("link")
    .first()
    .click();
  const codeView = loggedInPage.locator(".cm-theme");
  await codeView.scrollIntoViewIfNeeded();
  await loggedInPage.waitForTimeout(10_000);
  const response = await codeView
    //@ts-ignore
    .query("Is the code highlighted with red background? Respond yes or no");
  expect(response).toBe("yes");
});

test("test run page filters should be preserved", async ({
  loggedInPage,
}) => {
  await loggedInPage.goto(
    `https://dash.empirical.run/flash-tests/test-runs/${failedRun?.id}`,
  );
  await expect(loggedInPage.getByText("Test run on Production")).toBeVisible();
  await loggedInPage
    .locator("div")
    .filter({ hasText: /^Filter byNone$/ })
    .getByRole("combobox")
    .click();
  await loggedInPage.getByText("Failed tests").click();
  await loggedInPage.waitForTimeout(3_000);
  const url = await loggedInPage.url();
  const expectedStatusFilter = new URL(url).searchParams.get("status");
  await loggedInPage
    .getByRole("cell", { name: "[chromium]" })
    .first()
    .getByRole("link")
    .click();
  await expect(loggedInPage.getByRole('heading', { name: 'Visual Comparison' })).toBeVisible();
  await loggedInPage.getByText(String(failedRun?.id) || "").click();
  await loggedInPage.waitForTimeout(3_000);
  const newUrl = await loggedInPage.url();
  const newStatusFilter = new URL(newUrl).searchParams.get("status");
  expect(newStatusFilter).toBe(expectedStatusFilter);
  await loggedInPage.getByRole('cell', { name: '[chromium]' }).first().getByRole('link').first()
    .click();
  await expect(loggedInPage.getByRole('heading', { name: 'Visual Comparison' })).toBeVisible();
  await loggedInPage.getByText(String(failedRun?.id) || "").click();
  await loggedInPage.waitForTimeout(3_000);
  const finalUrl = await loggedInPage.url();
  const finalStatusFilter = new URL(finalUrl).searchParams.get("status");
  expect(finalStatusFilter).toBe(expectedStatusFilter);
});
