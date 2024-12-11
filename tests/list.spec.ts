import { test } from "./fixtures";

test("should be able to open test-case from list page", async ({
  loggedInPage,
}) => {
  await loggedInPage.getByRole("combobox").click();
  await loggedInPage.getByLabel("Flash").click();
  await loggedInPage.getByRole("link", { name: "has title" }).first().click();
});
