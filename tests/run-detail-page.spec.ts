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

test("Failed run detail page should open", async ({ loggedInPage }) => {
  expect(failedRun).toBeDefined();
  expect(failedRun?.id).toBeDefined();
  expect(failedRun?.failed_count).toBeDefined();
  await loggedInPage.goto(
    `https://dash.empirical.run/flash-tests/test-runs/${failedRun?.id}`,
  );
  await expect(loggedInPage.getByText("Test run on Production")).toBeVisible();
});
