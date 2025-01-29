import { test, expect } from "./fixtures";

test("multi page fill action should work", async ({ loggedInPage }) => {
  // Close existing session if it exists
  const testName =
    "automation: fill action in case of multiple pages should work";
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await loggedInPage.waitForTimeout(4000);
  if (await loggedInPage.getByRole("row", { name: testName }).isVisible()) {
    await loggedInPage
      .getByRole("row", { name: testName })
      .getByRole("button")
      .click();
    await loggedInPage.getByRole("button", { name: "Close session" }).click();
  }

  // Delete existing test case if it exists
  await loggedInPage.getByRole('link', { name: 'Test Cases', exact: true }).click();
  await loggedInPage.waitForTimeout(4000);
  if (await loggedInPage.getByRole("row", { name: testName }).isVisible()) {
    await loggedInPage
      .getByRole("row", { name: testName })
      .getByRole("button")
      .click();
    await loggedInPage.getByRole("menuitem", { name: "Delete" }).click();
    await loggedInPage.getByRole("button", { name: "Delete" }).click();
    await expect(
      loggedInPage.getByText("Successfully deleted test case", { exact: true }),
    ).toBeVisible();
    await loggedInPage.reload();
  }

  // Create new session and test case
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await loggedInPage.getByRole("button", { name: "New Session" }).click();
  await loggedInPage
    .getByRole("button", { name: "Create new test case" })
    .click();
  await loggedInPage.getByPlaceholder("Enter testcase name").fill(testName);
  await loggedInPage.getByPlaceholder("Choose file").fill("actions.spec.ts");
  await loggedInPage.getByPlaceholder("Choose file").blur();
  await loggedInPage.getByRole("button", { name: "Next" }).click();

  // Type the task and send
  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill("create two pages with name pageOne and pageTwo.");
  await loggedInPage.locator("button").filter({ hasText: "auto" }).click();
  await loggedInPage.getByLabel("code", { exact: true }).click();
  await loggedInPage.getByRole("button", { name: "Send" }).click();

  await expect(
    loggedInPage.getByText("Generating test using code agent."),
  ).toBeVisible({ timeout: 60000 });
  await expect(loggedInPage.getByText("Test run started! ")).toBeVisible({
    timeout: 300_000,
  });
  await expect(
    loggedInPage.getByText("Success! The tests passed!"),
  ).toBeVisible({ timeout: 60_000 });

  // Assert that the update message is visible
  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill(
      "Goto empirical.run on pageOne and goto google.com in pageTwo. Enter text empirical on pageTwo and click on search.",
    );
  await loggedInPage
    .locator("button")
    .filter({ hasText: "code" })
    .first()
    .click();
  await loggedInPage.getByLabel("master", { exact: true }).click();
  await loggedInPage.getByRole("button", { name: "Send" }).click();
  await expect(
    loggedInPage.getByText("Preparing file for master agent"),
  ).toBeVisible({ timeout: 60000 });
  await expect(loggedInPage.getByText("Starting master agent.")).toBeVisible({
    timeout: 45_000,
  });
  await loggedInPage.getByRole("tab", { name: "Browser" }).click();
  await expect(loggedInPage.getByText("pageTwo.getByLabel")).toBeVisible({ timeout: 180_000});
  await expect(loggedInPage.getByRole("button", { name: "Send" })).toBeVisible({
    timeout: 120_000,
  });
  await expect(loggedInPage.getByText("Test run started! ")).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    loggedInPage.getByText("Success! The tests passed!"),
  ).toBeVisible({ timeout: 60_000 });
});
