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
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();
  await expect(loggedInPage.getByText("sessions")).toBeVisible();
  await loggedInPage.getByRole("link", { name: "sessions" }).click();

  await loggedInPage
    .getByRole("row", { name: `random.spec.ts ${uniqueTestName}` })
    .getByRole("button")
    .click();
  await loggedInPage.getByRole("button", { name: "Close session" }).click();
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

test("Group preview code highlighter should work", async ({ loggedInPage }) => {
  await loggedInPage.getByRole("button", { name: "Add" }).click();
  await loggedInPage.getByPlaceholder("Choose file").fill("home.spec.ts");
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

test("create new test case", async ({ loggedInPage }) => {
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await loggedInPage.waitForTimeout(4000);
  if (
    await loggedInPage
      .getByRole("row", { name: "automation: go to google and search" })
      .isVisible()
  ) {
    await loggedInPage
      .getByRole("row", { name: "automation: go to google and search" })
      .getByRole("button")
      .click();
    await loggedInPage.getByRole("button", { name: "Close session" }).click();
  }
  await loggedInPage.getByRole("link", { name: "Test Cases" }).click();
  await loggedInPage.waitForTimeout(4000);
  if (
    await loggedInPage
      .getByRole("row", { name: "automation: go to google and search" })
      .isVisible()
  ) {
    await loggedInPage
      .getByRole("row", { name: "automation: go to google and search" })
      .getByRole("button")
      .click();
    await loggedInPage.getByRole("menuitem", { name: "Delete" }).click();
    await loggedInPage.getByRole("button", { name: "Delete" }).click();
    await expect(
      loggedInPage.getByText("Successfully deleted test case", { exact: true }),
    ).toBeVisible();
    await loggedInPage.reload();
  }
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await loggedInPage.getByRole("button", { name: "New Session" }).click();
  await loggedInPage
    .getByRole("button", { name: "Create new test case" })
    .click();
  await loggedInPage
    .getByPlaceholder("Enter testcase name")
    .fill("automation: go to google and search");
  await loggedInPage.getByPlaceholder("Choose file").fill("home.spec.ts");
  await loggedInPage.getByRole("button", { name: "Next" }).click();

  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill("go to google.com");
  await loggedInPage.getByRole("button", { name: "Send" }).click();
  await expect(
    loggedInPage.getByText("Preparing file for master agent"),
  ).toBeVisible({ timeout: 60_000 });
  await expect(loggedInPage.getByRole("button", { name: "Send" })).toBeVisible({
    timeout: 190_000,
  });
  await expect(loggedInPage.locator("#pr-link-button")).toBeVisible();
});
