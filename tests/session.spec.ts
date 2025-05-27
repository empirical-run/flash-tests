import { test, expect } from "./fixtures";

test("should be able to create a new session", async ({ loggedInPage }) => {
  await loggedInPage.getByRole('link', { name: 'Sessions', exact: true }).click();
  await loggedInPage.getByRole('button', { name: 'New' }).click();
  await loggedInPage.getByRole('button', { name: 'Create' }).click();
  await loggedInPage.getByPlaceholder('Type your message...').click();
  await loggedInPage.getByPlaceholder('Type your message...').fill("list all the files in the current dir");
  await loggedInPage.getByRole('button', { name: 'Send' }).click();
  await expect(loggedInPage.getByText('Assistant')).toBeVisible({ timeout: 60000 });
}); // This was the missing closing brace

test("should be able to create a new session with claude model and wait for tool message", async ({ loggedInPage }) => {
  await loggedInPage.getByRole('link', { name: 'Sessions', exact: true }).click();
  await loggedInPage.getByRole('button', { name: 'New' }).click();

  // Select Claude model
  await loggedInPage.getByRole('combobox').click();
  // Click the current model name (default GPT-3.5 Turbo) to open dropdown
await loggedInPage.getByRole('option', { name: 'Claude Sonnet 3.7', exact: true }).click();


  // Select 'Claude' from the dropdown options


  await loggedInPage.getByRole('button', { name: 'Create' }).click(); // Create the session

  await loggedInPage.getByPlaceholder('Type your message...').click();
  await loggedInPage.getByPlaceholder('Type your message...').fill("list all the files in the current dir and tell me their sizes");
  await loggedInPage.getByRole('button', { name: 'Send' }).click();
  // Wait for a message containing "tool" (case-insensitive)
  await expect(loggedInPage.getByText('Show Result')).toBeVisible({ timeout: 60000 });
});

// The extra closing brace that was at the end of the file has been removed.