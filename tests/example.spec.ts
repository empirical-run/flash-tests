
import { test, expect } from "./fixtures";

test("has title", async ({ page }) => {
  await page.goto("https://playwright.dev/");
  await expect(page).toHaveTitle(/Playwright/);
});

test("check str_replace_based_edit_tool: str_replace execution", async ({ page, trackCurrentSession }) => {
  // Navigate to the application
  await page.goto('/');
  
  // Wait for successful login
  await expect(page.getByText("Lorem Ipsum", { exact: true }).first()).toBeVisible();
  
  // Create a new session
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  
  // Wait for session to be created and track it for cleanup
  await expect(page).toHaveURL(/sessions/, { timeout: 10000 });
  trackCurrentSession(page);
  
  // Send a message that will trigger str_replace_based_edit_tool
  const messageInput = page.getByPlaceholder('Type your message here...');
  await expect(messageInput).toBeVisible();
  
  // Send a message that should trigger the str_replace tool
  const message = "Please modify the file 'test.txt' and replace the word 'hello' with 'hi' using str_replace command";
  await messageInput.fill(message);
  await messageInput.press('Enter');
  
  // Wait for the tool execution to appear
  await expect(page.getByText('str_replace_based_edit_tool', { exact: false })).toBeVisible({ timeout: 45000 });
  
  // Specifically check for str_replace command execution
  await expect(page.getByText('str_replace', { exact: false })).toBeVisible({ timeout: 15000 });
  
  // Wait for tool execution to complete
  await expect(page.getByText('Used str_replace_based_edit_tool: str_replace', { exact: false })).toBeVisible({ timeout: 60000 });
  
  // Verify the tool execution was successful
  await expect(page.getByText('tool completed', { exact: false }).or(page.getByText('successfully', { exact: false }))).toBeVisible({ timeout: 15000 });
});
