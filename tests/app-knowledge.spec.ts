import { test, expect } from "./fixtures";

test.describe("App Knowledge", () => {
  test("navigate to app knowledge page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
    // TODO(agent on page): Navigate to the App Knowledge section from the sidebar. Look for "Knowledge" or "App Knowledge" in the navigation links. Then take note of what the page looks like, what form elements exist to add a new knowledge file.
  });
});
