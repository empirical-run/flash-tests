import { test, expect } from "./fixtures";

test.describe("Repo Browser", () => {
  test("browse files and search in repository", async ({ page }) => {
    // Step 1: Navigate directly to the repository page. In the new layout,
    // Repository lives in the overflow navigation rather than as a top-level link.
    await page.goto("/lorem-ipsum/repo");
    await expect(page).toHaveURL(/\/lorem-ipsum\/repo$/);

    // Step 2: Open package.json and assert contents are visible
    await page.getByRole("treeitem", { name: "package.json" }).click();
    const fileContent = page.locator("code");
    await expect(fileContent).toContainText("devDependencies");

    // Step 3: Search for "login" - assert results are visible and package.json is NOT in the list
    const searchBox = page.getByRole("textbox", { name: "Search files" });
    await searchBox.fill("login");
    await expect(
      page.getByRole("treeitem", { name: "login.spec.ts" })
    ).toBeVisible();
    await expect(
      page.getByRole("treeitem", { name: "package.json" })
    ).not.toBeVisible();

    // Step 4: Click on login.spec.ts - assert content is visible
    await page.getByRole("treeitem", { name: "login.spec.ts" }).click();
    await expect(page.locator('bdi', { hasText: 'tests/login.spec.ts' })).toBeVisible();
    await expect(fileContent).toContainText("click login button and input dummy email");

    // Assert that the tree retains the search context
    // NOTE: This is a known bug - clicking a file resets the search, so this assertion fails
    await expect(searchBox).toHaveValue("login");
  });
});
