import { test, expect } from "./fixtures";

test("check if API key is visible", async ({ loggedInPage }) => {
  await loggedInPage.getByRole("link", { name: "API Keys" }).click();
  await expect(
    loggedInPage.getByRole("cell", { name: "test key" }),
  ).toBeVisible();
  await loggedInPage.getByRole('link', { name: 'Environments' }).click();
});
