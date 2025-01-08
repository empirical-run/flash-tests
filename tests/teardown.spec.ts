import { test } from "./fixtures";

test("Teardown: Close all automation test sessions", async ({
  loggedInPage,
}) => {
  await loggedInPage.getByRole("link", { name: "Sessions" }).click();

  while (true) {
    const sessionRow = await loggedInPage
      .getByRole("row", { name: /^automation-test@empirical.run/ })
      .first();
    if (!(await sessionRow.isVisible())) break;

    await sessionRow.getByRole("button").click();
    await loggedInPage.getByRole("button", { name: "Close session" }).click();
    await loggedInPage.waitForLoadState("networkidle");
  }
});
