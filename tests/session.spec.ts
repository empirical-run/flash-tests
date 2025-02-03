import { test, expect } from "./fixtures";

let sessionName: string | undefined;

test.afterEach(async ({ loggedInPage }) => {
  if (sessionName) {
    await loggedInPage.getByRole("link", { name: "sessions" }).click();
    await loggedInPage
      .getByRole("row", { name: new RegExp(sessionName) })
      .last()
      .getByRole("button")
      .click();
    await loggedInPage.getByRole("button", { name: "Close session" }).click();
    sessionName = undefined;
  }
});

test("Session name falls back to test name", async ({ loggedInPage }) => {
  await loggedInPage
    .getByRole("row", { name: "login.spec.ts ability to" })
    .getByRole("button")
    .click();
  await loggedInPage.getByRole("menuitem", { name: "Edit" }).click();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();

  await expect(
    loggedInPage
      .getByRole("banner")
      .getByRole("link", { name: "ability to login with correct" }),
  ).toBeVisible();

  sessionName = "login.spec.ts ability to login with correct credentials";
});

test("Session should be ready to send", async ({ loggedInPage }) => {
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await loggedInPage.getByRole("button", { name: "New Session" }).click();
  await loggedInPage
    .getByRole("button", { name: "Make changes across repository" })
    .click();
  // Assert default environment is loaded
  await expect(
    loggedInPage.locator("button").filter({ hasText: "Production" }),
  ).toBeVisible();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeEnabled();

  sessionName = "automation-test@empirical.run - Awaiting request -";
});

test("switching files shouldnot be stuck if already fetched once", async ({
  loggedInPage,
}) => {
  // Reason: Case 2 was chosen because other tests in the same file start by navigating to the "Sessions" page using the "loggedInPage" fixture.

  await loggedInPage.getByRole("link", { name: "has title" }).first().click();

  await loggedInPage.getByRole("button", { name: "Edit" }).click();

  await loggedInPage.getByRole("tab", { name: "Code" }).click();

  // Wait for "Loading Imports" text to hide
  await loggedInPage.waitForTimeout(10_000);
  await loggedInPage
    .locator("div")
    .filter({ hasText: /^Loading imports\.\.\.$/ })
    .waitFor({ state: "hidden", timeout: 25_000 });

  // Click on button which contains text "tests/home"
  await loggedInPage
    .locator("button")
    .filter({ hasText: "tests/home.spec.ts" })
    .click();

  // Select "tests/fixtures.ts" from dropdown
  await loggedInPage.getByRole("option", { name: "tests/fixtures.ts" }).click();

  await loggedInPage
    .locator("div")
    .filter({ hasText: /^Loading imports\.\.\.$/ })
    .waitFor({ state: "hidden", timeout: 25_000 });

  await loggedInPage
    .locator("button")
    .filter({ hasText: "tests/fixtures.ts" })
    .click();

  await loggedInPage
    .getByRole("option", { name: "tests/home.spec.ts" })
    .click();

  expect(
    await loggedInPage
      .locator("button")
      .filter({ hasText: "tests/home.spec.ts" })
      .isDisabled(),
  ).toBe(false);
});

test("impacted test checkbox click should work", async ({ loggedInPage }) => {
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await loggedInPage.getByRole("button", { name: "New Session" }).click();
  await loggedInPage
    .getByRole("button", { name: "Make changes across repository" })
    .click();
  await loggedInPage
    .getByPlaceholder("Enter your message here")
    .fill(
      'Add console.log in scrollCodeEditorToTop method with log "Testing automation".',
    );
  await loggedInPage.getByRole("button", { name: "Send" }).click();
  await expect(
    loggedInPage.getByText("Successfully generated code for the given task."),
  ).toBeVisible({ timeout: 120000 });
  await expect(
    loggedInPage.getByText("Test successfully generated!"),
  ).toBeVisible({ timeout: 60_000 });
  await loggedInPage.waitForTimeout(20_000);

  await loggedInPage.getByText("impacted test").click({ timeout: 90_000 });
  const checkbox = loggedInPage.getByRole("dialog").getByRole("checkbox");

  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
});
