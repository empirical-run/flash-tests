import { scrollCodeEditorToTop } from "../pages/code-editor";

import { test, expect } from "./fixtures";

test("Imports should not have squigly lines after the imports are loaded", async ({
  loggedInPage,
}) => {
  await loggedInPage.getByRole("link", { name: "has title" }).first().click();
  await loggedInPage.getByRole("button", { name: "Edit" }).click();
  await loggedInPage.getByRole("tab", { name: "Code" }).click();

  // Wait for "Loading Imports" text to show
  await loggedInPage
    .locator("div")
    .filter({ hasText: /^Loading imports\.\.\.$/ })
    .waitFor({ state: "visible" });
  
  await scrollCodeEditorToTop(loggedInPage);
  await loggedInPage.waitForTimeout(2_000)
  await loggedInPage.getByText('"./fixtures"').hover();
  await expect(loggedInPage.getByText("Cannot find module")).toBeVisible();

  await loggedInPage.getByRole("tab", { name: "Code" }).hover();

  await loggedInPage
    .locator("div")
    .filter({ hasText: /^Loading imports\.\.\.$/ })
    .waitFor({ state: "hidden", timeout: 25_000 });


  await loggedInPage.getByText('"./fixtures"').hover();
  await expect(loggedInPage.getByText("module \"/tests/fixtures\"")).toBeVisible();
});
