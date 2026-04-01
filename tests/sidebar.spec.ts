import { test, expect } from "./fixtures";

test.describe("Sidebar Navigation", () => {
  test("collapse sidebar and expand it by clicking expand button", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");

    // TODO(agent on page): Find the three-dot menu button next to the user email button at the bottom of the sidebar. Click it to open the menu, find and click the "Collapse sidebar" option. Then find and click the button to expand the sidebar again. After expanding, click Settings link and verify General link is visible.
  });
});
