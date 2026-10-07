import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures";
import { navigateToUsage } from "./pages/usage";

const USAGE_ROWS = [
  { name: "Manager", description: "The project manager session" },
  {
    name: "Manager initiated sessions",
    description: "Sessions started by the manager",
  },
  {
    name: "User initiated sessions",
    description: "Sessions started directly by users",
  },
  { name: "Triage", description: "Automated test-failure triage sessions" },
];

function monthValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date, month: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat("en-US", {
    month,
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function readNumericCells(row: Locator): Promise<number[]> {
  const cells = await row.getByRole("cell").allTextContents();
  return cells.slice(-3).map((value) => Number(value.replaceAll(",", "")));
}

test.describe("Usage Settings Page", () => {
  test("shows categorized AI usage totals and switches the reporting month", async ({
    page,
  }) => {
    await navigateToUsage(page);

    await expect(
      page.getByRole("heading", { name: "Usage", level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText("Monthly cost, AI and run infrastructure usage.", {
        exact: true,
      }),
    ).toBeVisible();

    const costTitle = page
      .locator('[data-slot="card-title"]')
      .getByText("Cost", {
        exact: true,
      });
    const costSummary = page.locator('[data-slot="card"]').filter({
      has: costTitle,
    });
    await expect(costTitle).toBeVisible();
    await expect(
      costSummary.getByText("So far", { exact: true }),
    ).toBeVisible();
    await expect(
      costSummary.getByText("Month end", { exact: true }),
    ).toBeVisible();

    // Require visible monetary values, not just the labels or plan breakdown.
    await expect(costSummary.getByText(/^\$[\d,]+\.\d{2}$/)).toBeVisible();
    await expect(costSummary.getByText(/^≈ \$[\d,]+\.\d{2}$/)).toBeVisible();

    const aiTitle = page
      .locator('[data-slot="card-title"]')
      .getByText("AI usage", {
        exact: true,
      });
    const aiUsage = page.locator('[data-slot="card"]').filter({ has: aiTitle });
    await expect(aiTitle).toBeVisible();
    await expect(
      aiUsage.getByRole("progressbar", {
        name: "AI credits used of plan allowance",
      }),
    ).toBeVisible();

    const now = new Date();
    const monthPicker = page.getByRole("combobox", { name: "Usage month" });
    await expect(monthPicker).toContainText(
      `${monthLabel(now)} (month to date)`,
    );
    await expect(page).toHaveURL(
      new RegExp(`[?&]month=${monthValue(now)}(?:&|$)`),
    );

    // The summary chart is visible by default; the detailed breakdown is collapsed.
    const usageTable = aiUsage.getByRole("table");
    await expect(usageTable).toBeHidden();
    await aiUsage
      .getByRole("button", { name: "Show more details", exact: true })
      .click();
    await expect(
      aiUsage.getByRole("button", { name: "Hide details", exact: true }),
    ).toBeVisible();
    await expect(usageTable.getByRole("columnheader")).toHaveText([
      "AI usage type",
      "Sessions",
      "Tokens",
      "Credits",
    ]);

    for (const usage of USAGE_ROWS) {
      const row = usageTable
        .getByRole("row")
        .filter({ hasText: usage.description });
      await expect(row.getByText(usage.name, { exact: true })).toBeVisible();
      await expect(
        row.getByText(usage.description, { exact: true }),
      ).toBeVisible();
      const values = await readNumericCells(row);
      expect(values).toHaveLength(3);
      expect(values.every(Number.isFinite)).toBe(true);
    }

    const totalRow = usageTable
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: "Total" }) });
    const totalValues = await readNumericCells(totalRow);
    expect(totalValues).toHaveLength(3);
    expect(totalValues.every(Number.isFinite)).toBe(true);

    const previousMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
    );
    await monthPicker.click();
    await page
      .getByRole("option", { name: monthLabel(previousMonth), exact: true })
      .click();

    await expect(page).toHaveURL(
      new RegExp(`[?&]month=${monthValue(previousMonth)}(?:&|$)`),
    );
    await expect(monthPicker).toContainText(monthLabel(previousMonth));
  });
});
