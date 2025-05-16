import { test, expect } from "./fixtures";

test("should be able to create a new session", async ({ loggedInPage }) => {
  await loggedInPage.getByRole('link', { name: 'Sessions', exact: true }).click();
  await loggedInPage.getByRole('button', { name: 'New Session' }).click();
  await loggedInPage.getByRole('button', { name: 'Create' }).click();
  await loggedInPage.getByPlaceholder('Type your message...').click();
  await loggedInPage.getByPlaceholder('Type your message...').fill("list all the files in the current dir");
  await loggedInPage.getByRole('button', { name: 'Send' }).click();
  await expect(loggedInPage.getByText('Assistant')).toBeVisible({ timeout: 60000 });
});
