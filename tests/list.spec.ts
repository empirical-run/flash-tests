import { test } from "./fixtures";

test("should be able to open test-case from list page", async ({
  loggedInPage,
}) => {
  await loggedInPage.getByText("Flash").click();
  await loggedInPage.getByRole("link", { name: "has title" }).first().click();
});
