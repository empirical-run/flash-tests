import { test, expect } from "./fixtures";

test.describe("TEMP: App Knowledge Cleanup", () => {
  test("delete all test-knowledge-* files", async ({ page }) => {
    await page.goto("/lorem-ipsum/app-knowledge");

    // Wait for sidebar links to load (skeletons replaced by real links)
    await expect(page.locator('a[href*="app-knowledge?file="]').first()).toBeVisible();

    let deletedCount = 0;

    // Loop until there are no more test-knowledge-* links
    while (true) {
      const testKnowledgeLink = page
        .getByRole("link", { name: /test-knowledge-/ })
        .first();

      const isVisible = await testKnowledgeLink.isVisible();
      if (!isVisible) break;

      // Get the file name from the link text to build the navigation URL
      const linkText = await testKnowledgeLink.textContent();
      const fileName = linkText?.trim();
      if (!fileName) break;

      // Navigate directly to the file so it is loaded in the content panel
      await page.goto(
        `/lorem-ipsum/app-knowledge?file=.empiricalrun%2F${fileName}.md`
      );

      // Verify the correct file loaded in the content panel
      await expect(
        page.locator("h2").filter({ hasText: fileName }).first()
      ).toBeVisible();

      // Click Delete in the content panel header
      await page.getByRole("button", { name: "Delete" }).click();

      // Confirm in the dialog
      await expect(page.getByText("Delete Knowledge File")).toBeVisible();
      await page.getByRole("button", { name: "Delete" }).click();

      // Wait for the sidebar link to disappear before looking for the next one
      await expect(
        page.getByRole("link", { name: new RegExp(fileName) })
      ).not.toBeVisible();

      deletedCount++;
      console.log(`✅ Deleted: ${fileName}`);
    }

    console.log(
      `\nCleanup complete. Total test-knowledge-* files deleted: ${deletedCount}`
    );
  });
});
