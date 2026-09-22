import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

const branchPicker = (page: Page) =>
  page.getByRole("button", {
    name: /^Switch branch\. Current branch:/,
  });

test.describe("Repository branch picker", () => {
  test("finds slash-delimited branches and is available on standalone repository pages", async ({
    page,
  }) => {
    await page.goto("/lorem-ipsum/test-runs");
    await page
      .getByRole("banner")
      .getByRole("link", { name: "Repository", exact: true })
      .click();
    await expect(page).toHaveURL(/\/r\/empirical-run\/lorem-ipsum-tests$/);

    const projectBranchPicker = branchPicker(page);
    await expect(projectBranchPicker).toBeVisible();
    await projectBranchPicker.click();

    // The shared fixture repository is expected to retain branches under this
    // slash-delimited prefix; this specifically covers searching nested refs.
    await page.getByPlaceholder("Search branches...").fill("test-run/merge");
    await expect
      .soft(
        page.getByRole("option", { name: /test-run\/merge/ }).first(),
        "The branch picker should load a matching slash-delimited branch",
      )
      .toBeVisible();

    const matchingBranchOption = page
      .getByRole("option", { name: /test-run\/merge/ })
      .first();
    const fullBranchName = await matchingBranchOption.innerText();
    await matchingBranchOption.click();
    await expect(projectBranchPicker).toContainText(fullBranchName, {
      useInnerText: true,
    });

    await page.goto("/r/empirical-run/lorem-ipsum-tests");
    await expect(page).toHaveURL(/\/r\/empirical-run\/lorem-ipsum-tests$/);
    await expect
      .soft(
        branchPicker(page),
        "Standalone repository pages should expose the same branch picker",
      )
      .toBeVisible();
  });
});
