import { test, expect } from "./fixtures";

test.describe("Branches", () => {
  test("navigate to branches from sidebar and click new merge", async ({ page }) => {
    // Navigate to the app (using baseURL from config)
    await page.goto("/");
    
    // TODO(agent on page): Click on the branches link in the sidebar, then click on "new merge" button
  });
});
