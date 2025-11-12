import { test, expect } from "./fixtures";

test.describe("Branches", () => {
  test("navigate to branches from sidebar and click new merge", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");
    
    // TODO(agent on page): Look for branches or merge in the sidebar navigation, click on it to navigate to branches page
  });
});
