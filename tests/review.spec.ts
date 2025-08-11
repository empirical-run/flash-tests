import { test, expect } from "./fixtures";

// This test verifies that the diff view mode selection persists after a page reload
// and re-opening the Review sheet. We focus on persistence across reloads.
test("diff view preference persists across different components and page reloads", async ({ page }) => {
  // Navigate to the app (using baseURL from config)
  await page.goto("/");

  // TODO(agent on page): Open the Review sheet from the top navigation by clicking the "Review" button, switch to the "Diff" tab, change the diff view mode (e.g., set it to "Split"), verify the selected view mode is active, then reload the page, open the Review sheet again, go to the "Diff" tab, and verify the previously selected diff view mode persists.
});
