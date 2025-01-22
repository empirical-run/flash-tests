import { test, expect } from "./fixtures";
import { scrollCodeEditorToBottom } from "../pages/code-editor";

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
  await expect(loggedInPage.getByText("Test run started! ")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    loggedInPage.getByText("Success! The tests passed!"),
  ).toBeVisible({ timeout: 30_000 });
});



test("code editor real time updates should work", async ({ loggedInPage }) => {
  const testName = "automation: test real time updates";
  await loggedInPage.waitForTimeout(5_000);
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
  await loggedInPage.getByRole("button", { name: "Add" }).click();
  await loggedInPage.getByPlaceholder("Enter testcase name").fill(testName);
  await loggedInPage.getByText("File").fill("create.spec.ts");
  await loggedInPage.getByRole("button", { name: "Next" }).click();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();

  await loggedInPage.getByRole("tab", { name: "Code" }).click();
  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill("navigate to google.com");
  await loggedInPage.getByRole("button", { name: "Send" }).click();
  await expect(loggedInPage.getByRole('button', { name: "Stop" })).toBeVisible();
  await expect(loggedInPage.getByRole("button", { name: "Send" })).toBeVisible({
    timeout: 190_000,
  });
  await expect(loggedInPage.locator("#pr-link-button")).toBeVisible();
  // added timeout for pr event to be received.
  await loggedInPage.waitForTimeout(5_000);
  await scrollCodeEditorToBottom(loggedInPage);
  await expect(
    loggedInPage.locator(".cm-editor").getByText(`test("${testName}"`),
  ).toBeVisible();
});

test("Preview should not be shown for new file", async ({ loggedInPage }) => {
  await loggedInPage.getByRole("link", { name: "Add", exact: true }).click();
  await loggedInPage.getByPlaceholder("Choose file").fill("home.spec.ts");
  await loggedInPage.getByText("Fetching preview").waitFor({ state: "hidden" });
  await loggedInPage.getByPlaceholder("Choose file").fill("");
  await loggedInPage
    .getByPlaceholder("Choose file")
    .fill("non-existent.spec.ts");
  await loggedInPage.getByText("Fetching preview").waitFor({ state: "hidden" });
  await expect(loggedInPage.getByText("New file")).toBeVisible({
    timeout: 25_000,
  });
});

test("repo edit should be working", async ({ loggedInPage }) => {
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await loggedInPage.getByRole("button", { name: "New Session" }).click();
  await loggedInPage
    .getByRole("button", { name: "Make changes across repository" })
    .click();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();

  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill("Remove the comment // added timeout for pr event to be received");
  await loggedInPage.getByRole("button", { name: "Send" }).click();
  await expect(loggedInPage.locator("#pr-link-button")).toBeVisible({
    timeout: 90_000,
  });
});

test("create test using coding agent", async ({ loggedInPage }) => {
  const testName = "automation: create new coding agent test";
  await loggedInPage.waitForTimeout(5_000);
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
  await loggedInPage.getByRole("link", { name: "Add", exact: true }).click();
  await loggedInPage.getByPlaceholder("Enter testcase name").fill(testName);
  await loggedInPage.getByPlaceholder("Choose file").fill("home.spec.ts");
  await loggedInPage.getByRole("button", { name: "Next" }).click();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();
  await loggedInPage.locator('button').filter({ hasText: 'auto' }).click();
  await loggedInPage.getByLabel('code', { exact: true }).click();
  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill("add a step console.log('hi')");
  await loggedInPage.getByRole("button", { name: "Send" }).click();
  await expect(loggedInPage.locator("#pr-link-button")).toBeVisible({
    timeout: 90_000,
  });
});
