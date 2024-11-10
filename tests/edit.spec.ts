import { test, expect } from "./fixtures";


// This is sample 1
test("test case session should be visible for already added test", async ({
  loggedInPage,
}) => {
  await loggedInPage
    .getByRole("link", { name: "Import new wallet using keplr" })
    .click();
  await expect(
    loggedInPage.getByText("Import new wallet using keplr"),
  ).toBeVisible();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();
});
