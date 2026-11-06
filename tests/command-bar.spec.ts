import { test, expect } from "../lib/fixtures";
import { expectHomeLoaded } from "../pages/home";
import {
  openCommandBar,
  recentGroupItems,
  visitAndRecord,
  closeCommandBar,
} from "../pages/command-bar";
import { getAccessibleTestRunId } from "../pages/test-runs";

const PROJECT_SLUG = "lorem-ipsum";

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
