import {
  scrollCodeEditorToTop,
  scrollCodeEditorToBottom,
} from "../pages/code-editor";

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
  // Wait for hidden
  await loggedInPage
    .locator("div")
    .filter({ hasText: /^Loading imports\.\.\.$/ })
    .waitFor({ state: "hidden", timeout: 25_000 });
  await scrollCodeEditorToTop(loggedInPage);
  await loggedInPage.getByRole("tab", { name: "Code" }).hover();
  await loggedInPage.getByText('"./fixtures"').hover();
  await expect(
    loggedInPage.getByText('module "/tests/fixtures"'),
  ).toBeVisible();
});

test("local changes in the session editor should persist after pushing changes to server", async ({
  loggedInPage,
}) => {
  // Reason: Case 2 was chosen because other tests in the same file start by navigating to the "has title" test case using the "loggedInPage" fixture.

  await loggedInPage.getByRole("link", { name: "has title" }).first().click();
  await loggedInPage.getByRole("button", { name: "Edit" }).click();
  await loggedInPage.getByRole("tab", { name: "Code" }).click();

  // Click on first "Assert that the text" and type "Hello"
  await loggedInPage
    .locator(".cm-content")
    .getByText("Assert that the text")
    .first()
    .click();
  const text = "Hello World!"
  await loggedInPage.keyboard.type(` ${text} `);

  // Click on "Save changes" button and wait for 10 seconds
  await loggedInPage.getByRole("button", { name: "Save changes" }).click();
  await expect(loggedInPage.getByRole("button", { name: "Save changes" })).toBeVisible({ timeout: 30_000 });
  await loggedInPage.waitForTimeout(10000);

  // Assert that text "Assert that textHello" is visible
  await expect(
    loggedInPage.locator(".cm-content").getByText(text),
  ).toBeVisible();
});
