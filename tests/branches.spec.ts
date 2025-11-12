import { test, expect } from "./fixtures";

test.describe("Branches", () => {
  test("navigate to branches from sidebar and click new merge", async ({ page }) => {
    // Navigate directly to branches page
    await page.goto("/branches");
    
    // TODO(agent on page): Click on "new merge" button
  });
});
