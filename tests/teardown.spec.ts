import { test, expect } from "./fixtures";

test("Teardown: Close all automation test sessions", async ({
  loggedInPage,
}) => {
  await loggedInPage
    .getByRole("link", { name: "Sessions", exact: true })
    .click();
  await expect(
    loggedInPage.getByRole("tab", { name: "Active Sessions", exact: true }),
  ).toBeVisible();
  await loggedInPage.waitForTimeout(10_000);
  const sessionRow = loggedInPage
    .getByRole("row", { name: "automation-test@empirical.run" })
    .first();

  while (await sessionRow.isVisible()) {
    await sessionRow.getByRole("button").click();
    await loggedInPage.getByRole("button", { name: "Close session" }).click();
    await loggedInPage.waitForLoadState("networkidle");
  }
  // Added 10 seconds timeout for all APIs to resolve
  await loggedInPage.waitForTimeout(10_000);
});
