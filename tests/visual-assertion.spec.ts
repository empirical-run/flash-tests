import { test, expect } from "./fixtures";
import { expectAppLoaded } from "./pages/home";

test("test runs page looks visually correct @visual", async ({ page }) => {
  await page.goto("/lorem-ipsum/test-runs");
  await expectAppLoaded(page);

  await expect(page).toLookRight(
    "The Empirical test runs page for the Lorem Ipsum project, with a readable sidebar, header, filters, and test run content that do not overlap or appear cut off",
  );
});
