import { test, expect } from "./fixtures";
import { openReviewPanel } from "./pages/sessions";

// Global test configuration for a fixed, read-only session to verify diff view mode persistence
const TEST_SESSION_ID = "5634";

// This test verifies that the diff view mode selection persists after a page reload
// and re-opening the Review sheet. We focus on persistence across reloads, using a
// known session instead of creating a new one.
test("diff view preference persists across different components and page reloads", async ({
  page,
}) => {
  // Navigate directly to the specific session
  await page.goto(`/sessions/${TEST_SESSION_ID}`);

  // Open Review sheet from the top navigation
  const reviewDialog = await openReviewPanel(page);

  // Ensure the file-diff content tab is active.
  const filesChangedTab = reviewDialog.getByRole("tab", {
    name: "Files Changed",
    exact: true,
  });
  await filesChangedTab.click();
  await expect(filesChangedTab).toHaveAttribute("aria-selected", "true");

  // Select the Unified view mode and verify that the Split/Unified tab group changed state.
  const splitViewTab = reviewDialog.getByRole("tab", {
    name: "Split",
    exact: true,
  });
  const unifiedViewTab = reviewDialog.getByRole("tab", {
    name: "Unified",
    exact: true,
  });
  await unifiedViewTab.click();
  await expect(unifiedViewTab).toHaveAttribute("aria-selected", "true");
  await expect(splitViewTab).toHaveAttribute("aria-selected", "false");

  // Reload the page. The Review sheet's open state is persisted in the URL
  // (`?review=diff`), so it re-opens automatically after the reload — assert it
  // is shown rather than clicking to open it again.
  await page.reload();
  const reloadedReviewDialog = page.getByRole("dialog");
  await expect(reloadedReviewDialog).toBeVisible();
  await expect(
    reloadedReviewDialog.getByRole("tab", {
      name: "Files Changed",
      exact: true,
    }),
  ).toHaveAttribute("aria-selected", "true");

  // Verify the Unified selection persisted in the view-mode tab group.
  await expect(
    reloadedReviewDialog.getByRole("tab", { name: "Unified", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    reloadedReviewDialog.getByRole("tab", { name: "Split", exact: true }),
  ).toHaveAttribute("aria-selected", "false");
});
