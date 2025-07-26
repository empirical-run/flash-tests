import { test, expect } from "./fixtures";

test.describe('Queue Investigation', () => {
  test('investigate queue functionality', async ({ page }) => {
    const page = await context.newPage();
    await page.goto('https://dash.empirical.run/lorem-ipsum-tests/sessions');
    await page.getByRole('button', { name: 'New' }).click();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill('execute: list_files');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).click();
    await page.getByRole('textbox', { name: 'Type your message here...' }).fill('What is 2 + 2?');
    await page.getByText('SendQueue').click();
  });
});