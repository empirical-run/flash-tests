import { test, expect } from "./fixtures";
import { expectHomeLoaded } from "./pages/home";
import type { Page } from "@playwright/test";
import {
  openCommandBar,
  recentGroupItems,
  visitAndRecord,
} from "./pages/command-bar";
import { getApiWorkerAuthHeaders } from "./pages/api-auth";
import { getApiBaseUrl } from "./pages/urls";

const PROJECT_SLUG = "lorem-ipsum";

/**
 * Fetches an accessible, completed test run for the Lorem Ipsum project so we
 * can exercise a project-scoped detail route in the Recent group.
 */
async function getAccessibleTestRunId(page: Page): Promise<number> {
  const headers = await getApiWorkerAuthHeaders(page);
  const response = await page.request.get(
    `${getApiBaseUrl()}/api/test-runs?project_id=${process.env.LOREM_IPSUM_PROJECT_ID}&per_page=100&page=1&interval_in_days=30`,
    { headers },
  );
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  const items = data.data.test_runs.items as any[];
  const run = items.find(
    (item) => item.state === "ended" && item.total_count > 0,
  );
  expect(
    run,
    "Expected an accessible completed test run for Lorem Ipsum",
  ).toBeTruthy();
  return run.id;
}

async function closeCommandBar(page: Page): Promise<void> {
  // Toggle the command bar itself; Escape is captured by the Settings modal underneath.
  await page.keyboard.press("Control+k");
  await expect(
    page.getByPlaceholder("Type a command or search..."),
  ).toBeHidden();
}

test.describe("Command Bar", () => {
  test("Search and navigate to settings via command bar", async ({ page }) => {
    await page.goto("/");
    await expectHomeLoaded(page);

    const input = await openCommandBar(page);
    await input.fill("lorem settings", { timeout: 45_000 });
    await page
      .getByLabel("Projects")
      .getByText("Lorem Ipsum › Settings", { exact: true })
      .click();

    await expect(page).toHaveURL(/settings/);
    await expect(
      page.getByRole("dialog").filter({
        has: page.getByRole("heading", { name: "Settings", exact: true }),
      }),
    ).toBeVisible();
  });
});

test.describe("Command Bar - Recent pages", () => {
  test("records visited destinations in the Recent group, newest-first, with useful labels", async ({
    page,
  }) => {
    await page.goto("/");
    await expectHomeLoaded(page);

    const testRunId = await getAccessibleTestRunId(page);

    // 1) Verify newest-first ordering from the two authoritative writes rather
    // than requiring both entries to coexist in the shared, capped UI list.
    const analyticsRecord = await visitAndRecord(
      page,
      `/${PROJECT_SLUG}/analytics`,
    );
    const memoriesRecord = await visitAndRecord(
      page,
      `/${PROJECT_SLUG}/memories`,
    );
    expect(memoriesRecord.path).toBe("/memories");
    expect(Date.parse(memoriesRecord.viewed_at)).toBeGreaterThan(
      Date.parse(analyticsRecord.viewed_at),
    );

    // 2) A nested settings page must be recorded under its specific registry
    // id/path and never persist or render the temporary generic "Empirical"
    // document title. Inspect the UI immediately after the authoritative write,
    // before the shared list has an extra dwell in which to evict this entry.
    const webhooksRecord = await visitAndRecord(
      page,
      `/${PROJECT_SLUG}/settings/webhooks`,
      { waitAfterRecord: false },
    );
    expect(webhooksRecord.page_id).toBe("settings-webhooks");
    expect(webhooksRecord.path).toBe("/settings/webhooks");
    expect(webhooksRecord.title).not.toBe("Empirical");
    await openCommandBar(page, { skipHydrationWait: true });
    const webhooks = recentGroupItems(page).filter({ hasText: /Webhooks/ });
    await expect(webhooks.first()).toBeVisible();
    await expect(webhooks).not.toContainText(["Empirical"]);
    await closeCommandBar(page);

    // 3) A test-run detail is recorded after Webhooks, with a useful label, and
    // is selectable straight from Recent. Ordering and label correctness come
    // from the PUT response, so neither assertion depends on the item surviving
    // concurrent eviction. We still open the command bar immediately (without
    // the normal post-write delay) to validate the fresh UI entry is clickable.
    const testRunRecord = await visitAndRecord(
      page,
      `/${PROJECT_SLUG}/test-runs/${testRunId}`,
      { waitAfterRecord: false },
    );
    expect(testRunRecord.path).toBe(`/test-runs/${testRunId}`);
    expect(testRunRecord.title).toContain(String(testRunId));
    expect(testRunRecord.title).not.toBe("Empirical");
    expect(Date.parse(testRunRecord.viewed_at)).toBeGreaterThan(
      Date.parse(webhooksRecord.viewed_at),
    );
    await openCommandBar(page, { skipHydrationWait: true });
    await recentGroupItems(page)
      .filter({ hasText: new RegExp(`\\b${testRunId}\\b`) })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${PROJECT_SLUG}/test-runs/${testRunId}(?:[/?#]|$)`),
    );
  });
});
