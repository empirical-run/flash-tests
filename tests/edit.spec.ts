import { test, expect } from "./fixtures";

// This is sample 1

test("test case session should be visible for already added test", async ({
  loggedInPage,
}) => {
  await loggedInPage.getByRole("link", { name: "has title" }).first().click();
  await expect(loggedInPage.getByText("has title").first()).toBeVisible();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();
});
