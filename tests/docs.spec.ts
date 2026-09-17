import { test, expect } from "./fixtures";
import { isPreviewEnvironment } from "./pages/urls";

const DOCS_URL = "https://empirical.run/docs";

test.describe("Public documentation", () => {
  test.skip(
    () => isPreviewEnvironment(),
    "The public documentation site is a production-only surface",
  );

  test("loads documentation and finds the delete snooze API reference", async ({
    page,
  }) => {
    await page.goto(DOCS_URL);

    await expect(
      page.getByRole("heading", { level: 1, name: "Introduction" }),
    ).toBeVisible();
    await expect(page.getByText("Welcome to Empirical docs")).toBeVisible();

    await page.getByRole("button", { name: "Open search" }).click();
    await page.getByRole("combobox", { name: "Search..." }).fill("snoozes");

    await expect(
      page.getByRole("option", { name: /Delete a snooze/ }),
    ).toBeVisible();
  });
});
