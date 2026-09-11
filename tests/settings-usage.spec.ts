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
      page.getByText(
        "See monthly AI and run infrastructure usage for this project.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AI usage", level: 2 }),
    ).toBeVisible();
    await expect(
      page.getByText("Sessions, tokens, and credits used by AI activity."),
    ).toBeVisible();

    const now = new Date();
    const monthPicker = page.getByRole("combobox", { name: "Usage month" });
    await expect(monthPicker).toContainText(
      `${monthLabel(now)} (month to date)`,
    );
    await expect(page).toHaveURL(
      new RegExp(`[?&]month=${monthValue(now)}(?:&|$)`),
    );

    const usageTable = page.getByRole("table");
    await expect(usageTable.getByRole("columnheader")).toHaveText([
      "AI usage type",
      "Sessions",
      "Tokens",
      "Credits",
    ]);

    const categoryValues: number[][] = [];
    for (const usage of USAGE_ROWS) {
      const row = usageTable
        .getByRole("row")
        .filter({ hasText: usage.description });
      await expect(row.getByText(usage.name, { exact: true })).toBeVisible();
      await expect(
        row.getByText(usage.description, { exact: true }),
      ).toBeVisible();
      const values = await readNumericCells(row);
      expect(values.every(Number.isFinite)).toBe(true);
      categoryValues.push(values);
    }

    const totalRow = usageTable
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name: "Total" }) });
    const displayedTotals = await readNumericCells(totalRow);
    const calculatedTotals = categoryValues.reduce(
      (totals, values) => totals.map((total, index) => total + values[index]),
      [0, 0, 0],
    );
    expect(displayedTotals).toEqual(calculatedTotals);

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

    const lastDay = new Date(
      Date.UTC(
        previousMonth.getUTCFullYear(),
        previousMonth.getUTCMonth() + 1,
        0,
      ),
    ).getUTCDate();
    const shortMonth = monthLabel(previousMonth, "short").split(" ")[0];
    await expect(
      page.getByText(
        `${shortMonth} 1, ${previousMonth.getUTCFullYear()} – ${shortMonth} ${lastDay}, ${previousMonth.getUTCFullYear()}`,
        { exact: true },
      ),
    ).toBeVisible();
  });
});
