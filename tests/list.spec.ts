import { test } from "./fixtures";

test("should be able to open test-case from list page", async ({
  page,
}) => {
  await page.goto("https://dash.empirical.run");

  await page
    .getByPlaceholder("m@example.com")
    .fill("automation-test@empirical.run");
  await page.getByLabel("Password").fill("xiYk85Mw.mZNLfg");
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.getByRole("combobox").click();
  await page.getByLabel("Flash").click();
  await page.getByRole("link", { name: "has title" }).click();
});
