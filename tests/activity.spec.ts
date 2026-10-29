import { test, expect } from "./fixtures";
import { expectHomeLoaded } from "./pages/home";

test.describe("Activity page", () => {
  test("clicking the test run chart opens the test run list with matching filters", async ({
    page,
  }) => {
    await page.goto("/");
    await expectHomeLoaded(page);
    await expect(
      page.getByRole("heading", { name: "Activity", level: 1 }),
    ).toBeVisible();

    // Each day's test run chart has one row per environment: the environment
    // name, a stacked status bar, and per-status links scoped to that day and
    // environment. Pick the first environment-scoped "failed" link (any date).
    const chartLink = page
      .getByRole("main")
      .getByRole("link", { name: /^\d+ failed$/ })
      .and(page.locator('a[href*="environment="]'))
      .first();
    await expect(chartLink).toBeVisible();

    // The link sits inside the status-links span, whose parent is the
    // environment row; the row's first child is the environment name.
    const environmentName = (
      await chartLink
        .locator("xpath=../..")
        .locator("> span")
        .first()
        .innerText()
    ).trim();
    expect(environmentName).not.toBe("");

    const href = await chartLink.getAttribute("href");
    const expected = new URL(href!, page.url()).searchParams;
    const from = expected.get("from")!;
    const to = expected.get("to")!;
    const environmentId = expected.get("environment")!;
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    expect(environmentId).toMatch(/^\d+$/);
    expect(expected.get("status")).toBe("failed");

    await chartLink.click();

    // URL carries the same date range, environment and status filters.
    await expect(page).toHaveURL(/\/lorem-ipsum\/test-runs\?/);
    const actual = new URL(page.url()).searchParams;
    expect(actual.get("from")).toBe(from);
    expect(actual.get("to")).toBe(to);
    expect(actual.get("environment")).toBe(environmentId);
    expect(actual.get("status")).toBe("failed");

    // The filter controls reflect those filters.
    await expect(
      page.getByRole("heading", { name: "Test Runs", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Filter by environment" }),
    ).toHaveText(new RegExp(`^${escapeRegExp(environmentName)}$`, "i"));
    await expect(
      page.getByRole("combobox", { name: "Filter by status" }),
    ).toHaveText("Failed");
    const dayLabel = new Date(from).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    await expect(
      page.getByRole("button", { name: "Filter by date" }),
    ).toContainText(dayLabel);
    await expect(page.getByRole("button", { name: "Clear" })).toBeVisible();

    // And the listed runs match: every row is a failed run in that environment.
    const rows = page
      .getByRole("table")
      .getByRole("row")
      .filter({
        has: page.getByRole("link", { name: /^#\d+/ }),
      });
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      await expect(row.getByRole("cell").first()).toContainText(
        environmentName,
      );
      await expect(row.getByRole("cell").nth(1)).toContainText("Failed");
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
