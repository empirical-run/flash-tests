import { test, expect } from "./fixtures";

test.describe("Repo Browser", () => {
  test("browse files and search in repository", async ({ page }) => {
    // Step 1: Navigate to the repository page from the sidebar
    await page.goto("/");
    await page.getByRole("link", { name: "Repository" }).click();
    await expect(page).toHaveURL(/\/repo$/);

    // Step 2: Open package.json and assert contents are visible
    await page.getByRole("treeitem", { name: "package.json" }).click();
    const fileContent = page.locator("code");
    await expect(fileContent).toContainText("devDependencies");

    // Step 3: Search for "example" - assert results are visible and package.json is NOT in the list
    const searchBox = page.getByRole("textbox", { name: "Search…" });
    await searchBox.fill("example");
    await expect(
      page.getByRole("treeitem", { name: "example.spec.ts" })
    ).toBeVisible();
    await expect(
      page.getByRole("treeitem", { name: "package.json" })
    ).not.toBeVisible();

    // Step 4: Click on example.spec.ts - assert content is visible
    await page.getByRole("treeitem", { name: "example.spec.ts" }).click();
    await expect(page.getByText("tests/example.spec.ts")).toBeVisible();
    await expect(fileContent).toContainText("has title");

    // Assert that the tree retains the search context
    // NOTE: This is a known bug - clicking a file resets the search, so this assertion fails
    await expect(searchBox).toHaveValue("example");
  });
});
