import { test, expect } from "./fixtures";

test.describe("Branches", () => {
  test("navigate to branches page, click new merge, and close modal", async ({ page }) => {
    // Navigate to the app
    await page.goto("/");
    
    // TODO(agent on page): Navigate to the branches page in the sidebar, then click on "New merge" button to open the modal, and close the modal
  });
});
