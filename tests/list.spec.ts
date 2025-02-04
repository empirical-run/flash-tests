import { test, expect } from "./fixtures";

test("should be able to open test-case from list page", async ({
  loggedInPage,
}) => {
  await loggedInPage.getByText("Flash").click();
  await loggedInPage.getByRole("link", { name: "has title" }).first().click();
});

test("scroll should work in master agent", async ({ loggedInPage }) => {
    await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
    if (
    await loggedInPage
      .getByRole("row", { name: "automation: click on the test case outside viewport" })
      .isVisible()
  ) {
    await loggedInPage
      .getByRole("row", { name: "automation: click on the test case outside viewport" })
      .getByRole("button")
      .click();
    await loggedInPage.getByRole("button", { name: "Close session" }).click();
  }
  await loggedInPage.getByRole('link', { name: 'Test Cases', exact: true }).click();
  await loggedInPage.waitForTimeout(4000);
  if (
    await loggedInPage
      .getByRole("row", { name: "automation: click on the test case outside viewport" })
      .isVisible()
  ) {
    await loggedInPage
      .getByRole("row", { name: "automation: click on the test case outside viewport" })
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
    .fill("automation: click on the test case outside viewport");
  await loggedInPage.getByPlaceholder("Choose file").fill("list.spec.ts");
  await loggedInPage.getByRole("button", { name: "Next" }).click();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();

  await loggedInPage.locator("button").filter({ hasText: "auto" }).click();
  await loggedInPage.getByLabel("master", { exact: true }).click();
  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill(
      "click the test case with name 'automation: fill action in case of multiple pages should work' from the test case list",
    );
  await loggedInPage.getByRole("button", { name: "Send" }).click();
  await expect(
    loggedInPage.getByText("Preparing file for master agent"),
  ).toBeVisible({ timeout: 60_000 });
    await expect(loggedInPage.getByText("Starting master agent.")).toBeVisible({
    timeout: 60_000,
  });
    await expect(loggedInPage.getByText("Test run started! ")).toBeVisible({
    timeout: 300_000,
  });
  await expect(
    loggedInPage.getByText("Success! The tests passed!"),
  ).toBeVisible({ timeout: 60_000 });
});
