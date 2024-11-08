import { test, expect } from "./fixtures";

test("test case session should be visible", async ({ loggedInPage }) => {
  await loggedInPage.goto("https://dash.empirical.run/flash-tests/test-cases");
  await loggedInPage.getByRole("button", { name: "Add" }).waitFor();
  await loggedInPage.getByRole("button", { name: "Add" }).click();
  const uniqueTestName = `test-${Date.now()}`;
  await loggedInPage
    .getByPlaceholder("Enter testcase name")
    .fill(uniqueTestName);
  await loggedInPage.getByPlaceholder("Choose file").fill("random.spec.ts");
  await loggedInPage.getByPlaceholder("Choose file").blur();
  await loggedInPage.getByRole("button", { name: "Next" }).click();
  await expect(loggedInPage.getByText(uniqueTestName)).toBeVisible();
  await loggedInPage.getByRole("link", { name: "Test Cases" }).click();
  await loggedInPage
    .getByRole("row", { name: `random.spec.ts ${uniqueTestName}` })
    .getByRole("button")
    .click();
  await loggedInPage.getByRole("menuitem", { name: "Delete" }).click();
  await loggedInPage.getByRole("button", { name: "Delete" }).click();
  await expect(
    loggedInPage.getByText("Successfully deleted test case", { exact: true }),
  ).toBeVisible();
});
