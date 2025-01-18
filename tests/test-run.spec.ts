import { test, expect } from "./fixtures";

test("Test run should work when making changes from code editor", async ({
  loggedInPage,
}) => {
  await loggedInPage
    .getByRole('link', { name: 'home.spec.ts describe 1 › describe 2 › has title' })
    .click();
  await loggedInPage.getByRole("button", { name: "Edit" }).click();
  await expect(
    loggedInPage.getByRole("button", { name: "Send" }),
  ).toBeVisible();
  await loggedInPage.waitForTimeout(10_000);
  await loggedInPage.getByRole("tab", { name: "Code" }).click();
  await loggedInPage.getByText('// Expect the text "Welcome').click();
  await loggedInPage.keyboard.type("  ");
  await loggedInPage.getByRole("button", { name: "Save changes" }).click();
  await expect(loggedInPage.getByText("Test run started! ")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    loggedInPage.getByText("Success! The tests passed!"),
  ).toBeVisible({ timeout: 90_000 });
  const href = await loggedInPage
    .getByText("Success! The tests passed!")
    .getByRole("link")
    .getAttribute("href");
  const resp = await fetch(href || "");
  expect(resp.status).toBe(200);
  await loggedInPage.goto(href || "");
  await expect(loggedInPage.getByText("has title")).toBeVisible();
});
