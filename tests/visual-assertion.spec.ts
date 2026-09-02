import { test, expect } from "./fixtures";
import { expectAppLoaded } from "./pages/home";
import { waitForTestRunRows } from "./pages/test-runs";

test(
  "test runs page looks visually correct",
  { tag: "@visual" },
  async ({ page }) => {
    await page.goto("/lorem-ipsum/test-runs");
    await expectAppLoaded(page);
    await waitForTestRunRows(page);

    await expect(page).toLookRight(
      "The Empirical test runs page for the Lorem Ipsum project, with a readable sidebar, header, filters, and test run content that do not overlap or appear cut off",
    );
  },
);
