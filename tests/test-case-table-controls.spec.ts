import { test, expect } from "@playwright/test";
import { expectTestCasesCount } from "./pages/test-runs";

const runId = 12345;
const caseId = "aaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbbbbbb";
const otherCaseId = "cccccccccccccccccccc-dddddddddddddddddddd";
const identity = { testRunId: runId, testCaseIds: [caseId] };

function table(testCaseId = caseId, count = 1): string {
  return `<table><thead><tr><th>Test cases (${count})</th></tr></thead>
    <tbody><tr><td><a href="/lorem-ipsum/test-runs/${runId}?test_id=${testCaseId}">Owned fixture</a></td></tr></tbody></table>`;
}

async function render(
  page: import("@playwright/test").Page,
  tables: string,
  headingRunId = runId,
): Promise<void> {
  await page.route("https://table-count-control.invalid/**", async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `<main><h1>Test run on SnoozeEnv #${headingRunId}</h1>${tables}</main>`,
    });
  });
  await page.goto(
    `https://table-count-control.invalid/lorem-ipsum/test-runs/${runId}`,
  );
}

// Synthetic documents only: no app requests, fixtures, snoozes or shared state.
test.describe("Test-case table boundary controls", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("accepts hidden S:0/S:2 fragments plus one accessible owned table", async ({
    page,
  }) => {
    await render(
      page,
      `<div hidden id="S:0">${table()}</div><div hidden id="S:2">${table()}</div>${table()}`,
    );
    await expectTestCasesCount(page, 1, identity);
  });

  test("accepts query-relative owned case links", async ({ page }) => {
    await render(
      page,
      table().replace(`/lorem-ipsum/test-runs/${runId}?`, "?"),
    );
    await expectTestCasesCount(page, 1, identity);
  });

  test("rejects duplicate accessible conflicting tables", async ({ page }) => {
    await render(page, table() + table(otherCaseId));
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toHaveCount/,
    );
  });

  test("rejects an accessible count mismatch", async ({ page }) => {
    await render(page, table(caseId, 2));
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toHaveCount/,
    );
  });

  test("rejects a different case despite the correct count", async ({
    page,
  }) => {
    await render(page, table(otherCaseId));
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toHaveCount/,
    );
  });

  test("rejects a case ID prefix collision", async ({ page }) => {
    await render(page, table(`${caseId}0`));
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toHaveAttribute/,
    );
  });

  test("rejects a different accessible run heading", async ({ page }) => {
    await render(page, table(), runId + 1);
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toHaveCount/,
    );
  });

  test("rejects a different run route despite the expected heading", async ({
    page,
  }) => {
    await render(page, table());
    await expect(
      expectTestCasesCount(page, 1, { ...identity, testRunId: runId + 1 }),
    ).rejects.toThrow(/toHaveURL/);
  });

  test("rejects an owned case link pointing at a different run", async ({
    page,
  }) => {
    await render(
      page,
      table().replace(`/test-runs/${runId}?`, `/test-runs/${runId + 1}?`),
    );
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toBe/,
    );
  });

  test("rejects an owned case link on a different origin", async ({ page }) => {
    await render(
      page,
      table().replace('href="/', 'href="https://other-control.invalid/'),
    );
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toBe/,
    );
  });

  test("rejects hidden-only tables", async ({ page }) => {
    await render(
      page,
      `<div hidden id="S:0">${table()}</div><div hidden id="S:2">${table()}</div>`,
    );
    await expect(expectTestCasesCount(page, 1, identity)).rejects.toThrow(
      /toHaveCount/,
    );
  });
});
