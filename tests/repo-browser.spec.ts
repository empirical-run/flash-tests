import { test, expect } from "./fixtures";

test.describe("Repo Browser", () => {
  test("browse files and search in repository", async ({ page }) => {
    // Step 1: Open the populated repository at its canonical route.
    await page.goto("/r/empirical-run/lorem-ipsum-tests");
    await expect(page).toHaveURL(/\/r\/empirical-run\/lorem-ipsum-tests$/);

    // Step 2: Open package.json and assert contents are visible
    await page.getByRole("treeitem", { name: "package.json" }).click();
    const fileContent = page.locator("code");
    await expect(fileContent).toContainText("devDependencies");

    // Step 3: Search for "login" - assert results are visible and package.json is NOT in the list
    const searchBox = page.getByRole("textbox", { name: "Search files" });
    await searchBox.fill("login");
    await expect(
      page.getByRole("treeitem", { name: "login.spec.ts" }),
    ).toBeVisible();
    await expect(
      page.getByRole("treeitem", { name: "package.json" }),
    ).not.toBeVisible();

    // Step 4: Click on login.spec.ts - assert content is visible
    await page.getByRole("treeitem", { name: "login.spec.ts" }).click();
    await expect(page.getByTitle("tests/login.spec.ts")).toHaveText(
      "tests/login.spec.ts",
    );
    await expect(fileContent).toContainText(
      "click login button and input dummy email",
    );

    // Assert that opening a file retains the tree's search context.
    await expect(searchBox).toHaveValue("login");
  });
});
