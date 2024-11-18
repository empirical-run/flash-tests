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

test("Group preview code highlighter should work", async ({
  loggedInPage,
  userContext,
}) => {
  await loggedInPage.getByRole("combobox").click();
  await loggedInPage.getByLabel("Flash").click();
  await loggedInPage.getByRole("button", { name: "Add" }).click();
  await loggedInPage.getByPlaceholder('Choose file').fill("home.spec.ts");
  await loggedInPage
    .getByText("Fetching preview...")
    .waitFor({ state: "hidden" });
  await loggedInPage.waitForTimeout(2000);
  // Added 2 seconds wait
  const isHighLighted = await loggedInPage
    .getByRole("main")
    //@ts-ignore: code editor doesn't support query api type yet
    .query(
      "Contains code editor on the right. The code present in the view should be highlighted with different colors. Respond with 'yes' if highlighted and 'no' if its not highlighted",
    );
  expect(isHighLighted).toContain("yes");
});
